import { Database } from '../database/database';
import { UserService } from './user-service';
import { SystemSettingsService } from './system-settings-service';

interface CreditTransaction {
    id: number;
    user_id: number;
    amount: number;
    type: string;
    description: string;
    created_at: string;
}

export class CreditManager {
    private db: Database;
    private userService: UserService;
    private systemSettingsService: SystemSettingsService;

    constructor() {
        this.db = new Database();
        this.userService = new UserService();
        this.systemSettingsService = new SystemSettingsService();
    }

    /**
     * Initialize the credit transactions table if it doesn't exist
     */
    public async initTable(): Promise<void> {
        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS credit_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount REAL NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
        } catch (error) {
            console.error('Error initializing credit transactions table:', error);
            throw error;
        }
    }

    /**
     * Calculate the cost of a research query
     * @param depth The depth of the research
     * @param breadth The breadth of the research
     * @returns The cost in credits
     */
    public async calculateResearchCost(depth: number, breadth: number): Promise<number> {
        try {
            const settings = await this.systemSettingsService.getSettings();
            
            const baseCredits = settings.baseCredits;
            const depthMultiplier = settings.depthMultiplier;
            const breadthMultiplier = settings.breadthMultiplier;
            
            const cost = baseCredits + (depth * depthMultiplier) + (breadth * breadthMultiplier);
            return Math.max(1, Math.round(cost * 10) / 10); // Round to 1 decimal place, minimum 1 credit
        } catch (error) {
            console.error('Error calculating research cost:', error);
            // Default calculation if settings can't be retrieved
            const cost = 2 + (depth * 1) + (breadth * 0.5);
            return Math.max(1, Math.round(cost * 10) / 10);
        }
    }

    /**
     * Check if a user has enough credits for a research query
     * @param userId The user ID
     * @param depth The depth of the research
     * @param breadth The breadth of the research
     * @returns True if the user has enough credits, false otherwise
     */
    public async hasEnoughCredits(userId: number, depth: number, breadth: number): Promise<boolean> {
        try {
            const user = await this.userService.getUserById(userId);
            if (!user) {
                return false;
            }

            const cost = await this.calculateResearchCost(depth, breadth);
            return user.credits >= cost;
        } catch (error) {
            console.error('Error checking if user has enough credits:', error);
            throw error;
        }
    }

    /**
     * Deduct credits from a user for a research query
     * @param userId The user ID
     * @param depth The depth of the research
     * @param breadth The breadth of the research
     * @param description Optional description for the transaction
     * @returns The new credit balance
     */
    public async deductCreditsForResearch(userId: number, depth: number, breadth: number, description?: string): Promise<number> {
        try {
            const cost = await this.calculateResearchCost(depth, breadth);
            return await this.subtractCredits(userId, cost, description || `Research (depth: ${depth}, breadth: ${breadth})`);
        } catch (error) {
            console.error('Error deducting credits for research:', error);
            throw error;
        }
    }

    /**
     * Add credits to a user
     * @param userId The user ID
     * @param amount The amount of credits to add
     * @param description Optional description for the transaction
     * @returns The new credit balance
     */
    public async addCredits(userId: number, amount: number, description?: string): Promise<number> {
        try {
            await this.initTable();
            
            // Get current user credits
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Calculate new balance
            const newBalance = user.credits + amount;
            
            // Update user credits
            await this.userService.updateUserCredits(userId, newBalance);
            
            // Record transaction
            await this.db.run(
                'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                [userId, amount, 'add', description || 'Credit addition']
            );
            
            return newBalance;
        } catch (error) {
            console.error('Error adding credits:', error);
            throw error;
        }
    }

    /**
     * Subtract credits from a user
     * @param userId The user ID
     * @param amount The amount of credits to subtract
     * @param description Optional description for the transaction
     * @returns The new credit balance
     */
    public async subtractCredits(userId: number, amount: number, description?: string): Promise<number> {
        try {
            await this.initTable();
            
            // Get current user credits
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Check if user has enough credits
            if (user.credits < amount) {
                throw new Error('Insufficient credits');
            }
            
            // Calculate new balance
            const newBalance = user.credits - amount;
            
            // Update user credits
            await this.userService.updateUserCredits(userId, newBalance);
            
            // Record transaction
            await this.db.run(
                'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                [userId, amount, 'subtract', description || 'Credit deduction']
            );
            
            return newBalance;
        } catch (error) {
            console.error('Error subtracting credits:', error);
            throw error;
        }
    }

    /**
     * Set a user's credits to a specific amount
     * @param userId The user ID
     * @param amount The new credit amount
     * @param description Optional description for the transaction
     * @returns The new credit balance
     */
    public async setCredits(userId: number, amount: number, description?: string): Promise<number> {
        try {
            await this.initTable();
            
            // Get current user credits
            const user = await this.userService.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Calculate difference for transaction record
            const difference = amount - user.credits;
            
            // Update user credits
            await this.userService.updateUserCredits(userId, amount);
            
            // Record transaction
            await this.db.run(
                'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                [userId, Math.abs(difference), difference >= 0 ? 'set_add' : 'set_subtract', description || 'Credit adjustment']
            );
            
            return amount;
        } catch (error) {
            console.error('Error setting credits:', error);
            throw error;
        }
    }

    /**
     * Get credit transactions for a user
     * @param userId The user ID
     * @param limit Optional limit on the number of transactions to return
     * @param offset Optional offset for pagination
     * @returns Array of credit transactions
     */
    public async getUserTransactions(userId: number, limit?: number, offset?: number): Promise<CreditTransaction[]> {
        try {
            await this.initTable();
            
            let query = 'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC';
            const params: any[] = [userId];
            
            if (limit !== undefined) {
                query += ' LIMIT ?';
                params.push(limit);
                
                if (offset !== undefined) {
                    query += ' OFFSET ?';
                    params.push(offset);
                }
            }
            
            const transactions = await this.db.all(query, params);
            return transactions;
        } catch (error) {
            console.error('Error getting user transactions:', error);
            throw error;
        }
    }

    /**
     * Get all credit transactions
     * @param limit Optional limit on the number of transactions to return
     * @param offset Optional offset for pagination
     * @returns Array of credit transactions
     */
    public async getAllTransactions(limit?: number, offset?: number): Promise<CreditTransaction[]> {
        try {
            await this.initTable();
            
            let query = 'SELECT * FROM credit_transactions ORDER BY created_at DESC';
            const params: any[] = [];
            
            if (limit !== undefined) {
                query += ' LIMIT ?';
                params.push(limit);
                
                if (offset !== undefined) {
                    query += ' OFFSET ?';
                    params.push(offset);
                }
            }
            
            const transactions = await this.db.all(query, params);
            return transactions;
        } catch (error) {
            console.error('Error getting all transactions:', error);
            throw error;
        }
    }
}
