import { Router } from 'express';
import { Database } from '../db/sqlite';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../../research.db');
const router = Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // 请在生产环境中使用环境变量

// 用户表初始化
async function initUserTable(db: Database) {
    console.log('Database path:', DB_PATH);
    await db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            credits INTEGER DEFAULT 100,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 检查是否已存在管理员账号
    const admin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!admin) {
        // 创建默认管理员账号 (用户名: admin, 密码: admin123)
        const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
        await db.run(
            'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
            ['admin', hashedPassword, true]
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

// 注册路由
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        console.log('Registration attempt:', { username });
        const db = new Database(DB_PATH);
        await db.open();

        // 检查用户名是否已存在
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            console.log('Registration failed: Username already exists');
            await db.close();
            return res.status(400).json({ error: 'Username already exists' });
        }

        // 密码加密
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // 创建新用户
        await db.run(
            'INSERT INTO users (username, password, credits) VALUES (?, ?, ?)',
            [username, hashedPassword, 100]
        );

        console.log('User registered successfully:', { username });
        await db.close();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Registration error details:', error);
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
        const user = await db.get('SELECT id, username, password, is_admin, credits FROM users WHERE username = ?', [username]);
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
            { userId: user.id, username: user.username, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await db.close();
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                isAdmin: user.is_admin,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error('Login error details:', error);
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
