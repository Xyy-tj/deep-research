import { Router } from 'express';
import { DB } from '../db/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { EmailService, generateVerificationCode } from '../services/email-service';

const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const emailService = new EmailService();
const INVITATION_CODE_REQUIRED = process.env.INVITATION_CODE_REQUIRED === 'true';
const VALID_INVITATION_CODE = process.env.VALID_INVITATION_CODE || 'default-invitation-code';

// Store verification codes in memory
const verificationCodes = new Map<string, { code: string, timestamp: number, invitationCode: string }>();

// Generate a random invitation code
function generateInvitationCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Initialize admin user if not exists
async function initAdminUser(db: DB) {
    const admin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
        db.run(
            'INSERT INTO users (username, email, password, is_admin, is_verified) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@example.com', hashedPassword, true, true]
        );
    }
}

// Initialize admin user and default invitation codes when the module loads
(async () => {
    try {
        console.log('Initializing admin user and invitation codes...');
        const db = await DB.getInstance();
        await initAdminUser(db);
        
        // Check if there are any invitation codes
        const existingCodes = await db.all('SELECT * FROM invitation_codes');
        if (existingCodes.length === 0) {
            console.log('No invitation codes found, creating default ones...');
            // Create some default invitation codes
            for (let i = 0; i < 5; i++) {
                const code = generateInvitationCode();
                await db.run(
                    'INSERT INTO invitation_codes (code) VALUES (?)',
                    [code]
                );
                console.log(`Created invitation code: ${code}`);
            }
        }
    } catch (error) {
        console.error('Failed to initialize admin user or invitation codes:', error);
    }
})();

// Cookie settings
const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

// 发送验证码
router.post('/send-verification', async (req, res) => {
    const { email, invitationCode } = req.body;
    
    try {
        const db = await DB.getInstance();

        // 检查邀请码是否有效
        if (!invitationCode) {
            return res.status(400).json({ error: 'Invitation code is required' });
        }

        // 查询数据库中是否存在该邀请码且未被使用
        const validInvitation = await db.get(
            'SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0',
            [invitationCode]
        );

        if (!validInvitation) {
            return res.status(400).json({ error: 'Invalid or already used invitation code' });
        }

        // 检查邮箱是否已被使用
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // 生成验证码
        const verificationCode = generateVerificationCode();
        
        // 存储验证码（10分钟有效期）
        verificationCodes.set(email, {
            code: verificationCode,
            timestamp: Date.now(),
            invitationCode // 存储邀请码与验证码的关联
        });

        // 发送验证码邮件
        const sent = await emailService.sendVerificationEmail(email, verificationCode);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send verification email' });
        }

        res.json({ message: 'Verification code sent' });
    } catch (error) {
        console.error('Send verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 注册路由
router.post('/register', async (req, res) => {
    const { username, email, password, verificationCode, invitationCode } = req.body;
    
    try {
        console.log('Registration attempt:', { username, email });
        const db = await DB.getInstance();
        
        // 验证验证码
        const storedVerification = verificationCodes.get(email);
        if (!storedVerification) {
            return res.status(400).json({ error: 'Please request a verification code first' });
        }

        // 检查验证码是否过期（10分钟有效期）
        if (Date.now() - storedVerification.timestamp > 10 * 60 * 1000) {
            verificationCodes.delete(email);
            return res.status(400).json({ error: 'Verification code expired' });
        }

        // 检查验证码是否正确
        if (storedVerification.code !== verificationCode) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // 检查邀请码是否匹配
        if (storedVerification.invitationCode !== invitationCode) {
            return res.status(400).json({ error: 'Invitation code does not match the one used for verification' });
        }

        // 检查邀请码是否有效
        const validInvitation = await db.get(
            'SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0',
            [invitationCode]
        );

        if (!validInvitation) {
            return res.status(400).json({ error: 'Invalid or already used invitation code' });
        }

        // 检查用户名是否已存在
        const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            console.log('Registration failed: Username or email already exists');
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 创建新用户
        const result = await db.run(
            'INSERT INTO users (username, email, password, credits, is_verified) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, 100, true]
        );

        // 确保我们有有效的用户ID
        if (!result.lastID) {
            console.error('Failed to get lastID after user insertion');
            return res.status(500).json({ error: 'Failed to create user' });
        }

        console.log('User created with ID:', result.lastID);

        // 标记邀请码为已使用
        try {
            const updateResult = await db.run(
                'UPDATE invitation_codes SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?',
                [result.lastID, invitationCode]
            );
            console.log('Invitation code updated successfully for user ID:', result.lastID);
        } catch (error) {
            console.error('Error updating invitation code:', error);
            // We don't want to fail the registration if the invitation code update fails
            // The user is already created, so we'll just log the error
        }

        // 清除验证码
        verificationCodes.delete(email);

        console.log('User registered successfully:', { username, email });
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug route to check users
router.get('/debug/users', async (req, res) => {
    try {
        const db = await DB.getInstance();
        const users = await db.all('SELECT id, username, email, credits FROM users');
        res.json({ users });
    } catch (error) {
        console.error('Debug users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 登录路由
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        console.log('Login attempt:', { username });
        const db = await DB.getInstance();

        // 查找用户
        const user = await db.get('SELECT id, username, email, password, is_admin, credits FROM users WHERE username = ?', [username]);
        if (!user) {
            console.log('Login failed: User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Login failed: Invalid password');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('User logged in successfully:', { username });
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '3d' }  // Changed from 24h to 3d to match cookie expiration
        );

        // Set the token as an HTTP-only cookie that expires in 3 days
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_MAX_AGE,
            sameSite: 'strict'
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: user.is_admin,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token endpoint
router.get('/verify-token', async (req, res) => {
    // Get the token from the cookie or Authorization header
    let token = req.cookies.auth_token;
    
    // Also check Authorization header for Bearer token
    const authHeader = req.headers['authorization'];
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    
    // Verify the token
    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
        if (err) {
            console.error('Token verification failed:', err.message);
            return res.status(401).json({ authenticated: false });
        }
        
        try {
            // Get full user data from database
            const db = await DB.getInstance();
            const userData = await db.get(
                'SELECT id, username, email, is_admin, credits FROM users WHERE id = ?', 
                [user.id]
            );
            
            if (!userData) {
                console.error('User not found in database:', user.id);
                return res.status(401).json({ authenticated: false });
            }
            
            // Generate a fresh token to extend session
            const newToken = jwt.sign(
                { 
                    id: userData.id, 
                    username: userData.username, 
                    email: userData.email, 
                    isAdmin: userData.is_admin 
                },
                JWT_SECRET,
                { expiresIn: '3d' }
            );
            
            // Set the new token as a cookie
            res.cookie('auth_token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: COOKIE_MAX_AGE,
                sameSite: 'strict'
            });
            
            // Token is valid, return user info and new token
            return res.json({
                authenticated: true,
                token: newToken, // Send the token back for local storage
                user: {
                    id: userData.id,
                    username: userData.username,
                    email: userData.email,
                    isAdmin: userData.is_admin,
                    credits: userData.credits
                }
            });
        } catch (error) {
            console.error('Error fetching user data:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
});

// Logout route to clear the cookie
router.post('/logout', (req, res) => {
    // Clear the auth token cookie
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    
    res.json({ message: 'Logged out successfully' });
});

// Admin route to generate invitation codes
router.post('/admin/generate-invitation-codes', async (req, res) => {
    try {
        // Verify admin token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Check if user is admin
        const db = await DB.getInstance();
        const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [decodedToken.id]);
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        // Generate requested number of codes
        const { count = 1 } = req.body;
        const codes = [];
        
        for (let i = 0; i < count; i++) {
            const code = generateInvitationCode();
            await db.run(
                'INSERT INTO invitation_codes (code) VALUES (?)',
                [code]
            );
            codes.push(code);
        }
        
        res.json({ codes });
    } catch (error) {
        console.error('Generate invitation codes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin route to list invitation codes
router.get('/admin/invitation-codes', async (req, res) => {
    try {
        // Verify admin token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Check if user is admin
        const db = await DB.getInstance();
        const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [decodedToken.id]);
        
        if (!user || !user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        // Get all invitation codes
        const codes = await db.all(`
            SELECT ic.*, u.username as used_by_username 
            FROM invitation_codes ic
            LEFT JOIN users u ON ic.used_by = u.id
            ORDER BY ic.created_at DESC
        `);
        
        res.json({ codes });
    } catch (error) {
        console.error('List invitation codes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
