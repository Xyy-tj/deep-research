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
const verificationCodes = new Map<string, { code: string, timestamp: number }>();

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

// Initialize admin user when the module loads
(async () => {
    try {
        console.log('Initializing admin user...');
        const db = await DB.getInstance();
        await initAdminUser(db);
    } catch (error) {
        console.error('Failed to initialize admin user:', error);
    }
})();

// Cookie settings
const COOKIE_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

// 发送验证码
router.post('/send-verification', async (req, res) => {
    const { email } = req.body;
    
    try {
        const db = await DB.getInstance();

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
            timestamp: Date.now()
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
        
        // Check invitation code if required
        if (INVITATION_CODE_REQUIRED) {
            if (!invitationCode) {
                return res.status(400).json({ error: 'Invitation code is required' });
            }
            
            if (invitationCode !== VALID_INVITATION_CODE) {
                return res.status(400).json({ error: 'Invalid invitation code' });
            }
        }

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

        // 检查用户名是否已存在
        const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            console.log('Registration failed: Username or email already exists');
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 创建新用户
        db.run(
            'INSERT INTO users (username, email, password, credits, is_verified) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, 100, true]
        );

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
    // Get the token from the cookie
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    
    // Verify the token
    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
        if (err) {
            return res.status(401).json({ authenticated: false });
        }
        
        try {
            // Get user credits from database
            const db = await DB.getInstance();
            const userData = await db.get('SELECT credits FROM users WHERE id = ?', [user.id]);
            const credits = userData ? userData.credits : 0;
            
            // Token is valid, return user info
            return res.json({
                authenticated: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    credits: credits
                }
            });
        } catch (error) {
            console.error('Error fetching user credits:', error);
            // Still return user info without credits
            return res.json({
                authenticated: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            });
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

export default router;
