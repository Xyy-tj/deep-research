import { Router } from 'express';
import { Database } from '../db/sqlite';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { EmailService, generateVerificationCode } from '../services/email-service';

const DB_PATH = path.resolve(__dirname, '../../research.db');
const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const emailService = new EmailService();

// 用于存储验证码
const verificationCodes = new Map<string, { code: string, timestamp: number }>();

// 用户表初始化
async function initUserTable(db: Database) {
    console.log('Database path:', DB_PATH);
    await db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            credits INTEGER DEFAULT 100,
            is_verified BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 检查是否已存在管理员账号
    const admin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
        await db.run(
            'INSERT INTO users (username, email, password, is_admin, is_verified) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@example.com', hashedPassword, true, true]
        );
    }
}

// Initialize the database when the module loads
(async () => {
    try {
        console.log('Initializing database...');
        const db = new Database(DB_PATH);
        await db.open();
        await initUserTable(db);
        await db.close();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
})();

// 发送验证码
router.post('/send-verification', async (req, res) => {
    const { email } = req.body;
    
    try {
        const db = new Database(DB_PATH);
        await db.open();

        // 检查邮箱是否已被使用
        const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser) {
            await db.close();
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

        await db.close();
        res.json({ message: 'Verification code sent' });
    } catch (error) {
        console.error('Send verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 注册路由
router.post('/register', async (req, res) => {
    const { username, email, password, verificationCode } = req.body;
    
    try {
        console.log('Registration attempt:', { username, email });
        const db = new Database(DB_PATH);
        await db.open();

        // 验证验证码
        const storedVerification = verificationCodes.get(email);
        if (!storedVerification) {
            await db.close();
            return res.status(400).json({ error: 'Please request a verification code first' });
        }

        // 检查验证码是否过期（10分钟有效期）
        if (Date.now() - storedVerification.timestamp > 10 * 60 * 1000) {
            verificationCodes.delete(email);
            await db.close();
            return res.status(400).json({ error: 'Verification code expired' });
        }

        // 检查验证码是否正确
        if (storedVerification.code !== verificationCode) {
            await db.close();
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // 检查用户名是否已存在
        const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            console.log('Registration failed: Username or email already exists');
            await db.close();
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 创建新用户
        await db.run(
            'INSERT INTO users (username, email, password, credits, is_verified) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, 100, true]
        );

        // 清除验证码
        verificationCodes.delete(email);

        console.log('User registered successfully:', { username, email });
        await db.close();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 登录路由
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        console.log('Login attempt:', { username });
        const db = new Database(DB_PATH);
        await db.open();

        // 查找用户
        const user = await db.get('SELECT id, username, email, password, is_admin, credits FROM users WHERE username = ?', [username]);
        if (!user) {
            console.log('Login failed: User not found');
            await db.close();
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Login failed: Invalid password');
            await db.close();
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('User logged in successfully:', { username });
        // 生成 JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await db.close();
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

export default router;
