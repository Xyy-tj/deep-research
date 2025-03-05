import express from 'express';
import { UserService } from '../services/user-service';
import { PaymentService } from '../services/payment-service';
import { CreditManager } from '../user/credit-manager';
import { authenticateJWT, isAdmin } from '../middleware/auth-middleware';
import { InvitationCodeService } from '../services/invitation-code-service';
import { SystemSettingsService } from '../services/system-settings-service';
import { generateRandomCode } from '../utils/string-utils';

const router = express.Router();

// Middleware to ensure only admins can access these routes
router.use(authenticateJWT, isAdmin);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const userService = await UserService.getInstance();
        const users = await userService.getAllUsers();
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user credits
router.post('/users/credits', async (req, res) => {
    try {
        const { userId, operation, amount, note } = req.body;
        
        if (!userId || !operation || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        console.log('Processing credit update:', { userId, operation, amount, note });

        const userService = await UserService.getInstance();
        const creditManager = await CreditManager.getInstance();
        
        // Get current user
        const user = await userService.getUserById(userId);
        if (!user) {
            console.error('User not found:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('Current user credits:', user.credits);
        let newBalance = user.credits;
        
        try {
            // Perform credit operation
            switch (operation) {
                case 'add':
                    await creditManager.addCredits(userId, amount);
                    newBalance = user.credits + amount;
                    console.log('Credits added, new balance:', newBalance);
                    break;
                case 'subtract':
                    if (user.credits < amount) {
                        return res.status(400).json({ error: 'Insufficient credits' });
                    }
                    // 使用UserService更新积分
                    await userService.updateUserCredits(userId, user.credits - amount);
                    newBalance = user.credits - amount;
                    console.log('Credits subtracted, new balance:', newBalance);
                    break;
                case 'set':
                    // 直接设置用户积分
                    await userService.updateUserCredits(userId, amount);
                    newBalance = amount;
                    console.log('Credits set to new value:', newBalance);
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid operation' });
            }
        } catch (error) {
            console.error('Error performing credit operation:', error);
            return res.status(500).json({ error: 'Failed to update credits: ' + error.message });
        }

        // 获取最新的用户信息
        const updatedUser = await userService.getUserById(userId);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found after update' });
        }

        res.json({ 
            success: true, 
            userId, 
            operation, 
            amount, 
            previousBalance: user.credits,
            newBalance: updatedUser.credits
        });
    } catch (error) {
        console.error('Error updating user credits:', error);
        res.status(500).json({ error: 'Failed to update user credits' });
    }
});

// Get all invitation codes
router.get('/invitation-codes', async (req, res) => {
    try {
        const invitationCodeService = await InvitationCodeService.getInstance();
        const codes = await invitationCodeService.getAllCodes();
        
        // Get usernames for used codes
        const userService = await UserService.getInstance();
        const codesWithUsernames = await Promise.all(codes.map(async (code) => {
            if (code.used_by) {
                const user = await userService.getUserById(code.used_by);
                return {
                    ...code,
                    used_by_username: user ? user.username : 'Unknown'
                };
            }
            return {
                ...code,
                used_by_username: null
            };
        }));
        
        res.json({ codes: codesWithUsernames });
    } catch (error) {
        console.error('Error fetching invitation codes:', error);
        res.status(500).json({ error: 'Failed to fetch invitation codes' });
    }
});

// Generate invitation codes
router.post('/generate-invitation-codes', async (req, res) => {
    try {
        const { count = 1 } = req.body;
        
        if (isNaN(count) || count < 1 || count > 50) {
            return res.status(400).json({ error: 'Count must be between 1 and 50' });
        }

        const invitationCodeService = await InvitationCodeService.getInstance();
        const codes = [];

        for (let i = 0; i < count; i++) {
            const code = generateRandomCode(8);
            await invitationCodeService.createCode(code);
            codes.push(code);
        }

        res.json({ success: true, count, codes });
    } catch (error) {
        console.error('Error generating invitation codes:', error);
        res.status(500).json({ error: 'Failed to generate invitation codes' });
    }
});

// Get all payments
router.get('/payments', async (req, res) => {
    try {
        const paymentService = await PaymentService.getInstance();
        const payments = await paymentService.getAllPayments();
        
        // Get usernames for payments
        const userService = await UserService.getInstance();
        const paymentsWithUsernames = await Promise.all(payments.map(async (payment) => {
            const user = await userService.getUserById(payment.user_id);
            return {
                ...payment,
                username: user ? user.username : 'Unknown'
            };
        }));
        
        res.json({ payments: paymentsWithUsernames });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get system settings
router.get('/system/settings', async (req, res) => {
    try {
        const systemSettingsService = await SystemSettingsService.getInstance();
        const settings = await systemSettingsService.getSettings();
        res.json({ settings });
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({ error: 'Failed to fetch system settings' });
    }
});

// Update system settings
router.post('/system/settings', async (req, res) => {
    try {
        const { baseCredits, depthMultiplier, breadthMultiplier } = req.body;
        
        if (isNaN(baseCredits) || isNaN(depthMultiplier) || isNaN(breadthMultiplier)) {
            return res.status(400).json({ error: 'All settings must be valid numbers' });
        }

        const systemSettingsService = await SystemSettingsService.getInstance();
        const settings = await systemSettingsService.updateSettings({
            baseCredits,
            depthMultiplier,
            breadthMultiplier
        });
        
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ error: 'Failed to update system settings' });
    }
});

export default router;
