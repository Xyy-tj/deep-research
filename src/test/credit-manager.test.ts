import { CreditManager } from '../user/credit-manager';
import { DB } from '../db/database';
import { expect } from 'chai';
import { before, beforeEach, describe, it } from 'mocha';

describe('CreditManager', () => {
    let creditManager: CreditManager;
    let testUserId = 999;
    const initialCredits = 12;

    before(async () => {
        // Get instance and ensure test user exists
        creditManager = await CreditManager.getInstance();
        const db = await DB.getInstance();
        
        // Clean up any existing test data
        await db.run('DELETE FROM usage_records WHERE user_id = ?', [testUserId]);
        await db.run('DELETE FROM users WHERE id = ?', [testUserId]);
        
        // Create test user
        await db.run(
            'INSERT INTO users (id, username, email, password, credits, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, 'test_user', 'test@example.com', 'password', initialCredits, 1]
        );
    });

    beforeEach(async () => {
        // Reset credits before each test
        const db = await DB.getInstance();
        await db.run('UPDATE users SET credits = ? WHERE id = ?', [initialCredits, testUserId]);
        await db.run('DELETE FROM usage_records WHERE user_id = ?', [testUserId]);
    });

    describe('deductCredits', () => {
        it('should successfully deduct credits in a transaction', async () => {
            const query = 'test query';
            const depth = 2;
            const breadth = 3;
            
            // Calculate expected cost
            const expectedCost = Math.ceil(1 + depth * 0.5 + breadth * 0.3);
            
            // Deduct credits
            const cost = await creditManager.deductCredits(testUserId, query, depth, breadth);
            
            // Verify cost calculation
            expect(cost).to.equal(expectedCost);
            
            // Verify credits were deducted
            const user = await creditManager.getUser(testUserId);
            expect(user).to.not.be.undefined;
            expect(user!.credits).to.equal(initialCredits - expectedCost);
            
            // Verify usage record was created
            const db = await DB.getInstance();
            const record = await db.get(
                'SELECT * FROM usage_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
                [testUserId]
            );
            expect(record).to.not.be.undefined;
            expect(record.query).to.equal(query);
            expect(record.query_depth).to.equal(depth);
            expect(record.query_breadth).to.equal(breadth);
            expect(record.credits_used).to.equal(expectedCost);
        });

        it('should fail when user has insufficient credits', async () => {
            const query = 'expensive query';
            const depth = 100; // Very high depth to ensure cost exceeds remaining credits
            const breadth = 100;
            
            try {
                await creditManager.deductCredits(testUserId, query, depth, breadth);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message).to.equal('Insufficient credits');

                // Verify no credits were deducted
                const user = await creditManager.getUser(testUserId);
                expect(user).to.not.be.undefined;
                expect(user!.credits).to.equal(initialCredits);
                
                // Verify no usage record was created
                const db = await DB.getInstance();
                const record = await db.get(
                    'SELECT * FROM usage_records WHERE user_id = ? AND query = ?',
                    [testUserId, query]
                );
                expect(record).to.be.undefined;
            }
        });

        it('should handle concurrent credit deductions correctly', async () => {
            const cost = Math.ceil(1 + 2 * 0.5 + 3 * 0.3); // Calculate cost once
            const maxDeductions = Math.floor(initialCredits / cost);
            const numAttempts = maxDeductions + 2; // Try a few more than possible
            
            // Try to deduct credits concurrently
            const deductions = Array(numAttempts).fill(null).map((_, index) => 
                creditManager.deductCredits(testUserId, `concurrent test ${index}`, 2, 3)
                    .catch(err => {
                        // Catch and return errors to prevent Promise.allSettled from failing
                        return Promise.reject(err);
                    })
            );
            
            // Wait for all deductions to complete or fail
            const results = await Promise.allSettled(deductions);
            
            // Count successful and failed deductions
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => 
                r.status === 'rejected' && 
                (r.reason.message === 'Insufficient credits' || r.reason.message.includes('transaction'))
            ).length;
            
            // Get final user state
            const user = await creditManager.getUser(testUserId);
            expect(user).to.not.be.undefined;
            
            // Verify final credits
            const expectedCredits = Math.max(0, initialCredits - (successful * cost));
            expect(user!.credits).to.equal(expectedCredits);
            
            // Verify all attempts were either successful or failed with insufficient credits
            expect(successful + failed).to.equal(numAttempts);
            expect(successful).to.be.at.most(maxDeductions);
            
            // Verify usage records
            const db = await DB.getInstance();
            const records = await db.all(
                'SELECT * FROM usage_records WHERE user_id = ? ORDER BY timestamp DESC',
                [testUserId]
            );
            
            expect(records.length).to.equal(successful);
            records.forEach(record => {
                expect(record.credits_used).to.equal(cost);
                expect(record.query_depth).to.equal(2);
                expect(record.query_breadth).to.equal(3);
            });
        });
    });
});
