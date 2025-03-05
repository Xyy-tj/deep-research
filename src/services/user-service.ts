import { DB } from '../db/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

interface User {
    id: number;
    username: string;
    email: string;
    password: string;
    credits: number;
    is_admin: boolean;
    is_verified: boolean;
    created_at: string;
    last_login: string | null;
}

export class UserService {
    private static instance: UserService;
    private db?: DB;
    private JWT_SECRET: string;

    private constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    }

    static async getInstance(): Promise<UserService> {
        if (!UserService.instance) {
            UserService.instance = new UserService();
            UserService.instance.db = await DB.getInstance();
        }
        return UserService.instance;
    }

    /**
     * Initialize the users table if it doesn't exist
     */
    public async initTable(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    credits REAL NOT NULL DEFAULT 0,
                    is_admin BOOLEAN NOT NULL DEFAULT 0,
                    is_verified BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            `);
        } catch (error) {
            console.error('Error initializing users table:', error);
            throw error;
        }
    }

    /**
     * Create a new user
     * @param username Username
     * @param email Email address
     * @param password Plain text password
     * @param isAdmin Whether the user is an admin
     * @returns The created user ID
     */
    public async createUser(username: string, email: string, password: string, isAdmin: boolean = false): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await this.db.run(
                'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, isAdmin ? 1 : 0]
            );
            
            return result.lastID;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Get a user by ID
     * @param id User ID
     * @returns User object or null if not found
     */
    public async getUserById(id: number): Promise<User | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const user = await this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [id]
            );
            
            return user || null;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            throw error;
        }
    }

    /**
     * Get a user by username
     * @param username Username
     * @returns User object or null if not found
     */
    public async getUserByUsername(username: string): Promise<User | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const user = await this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            
            return user || null;
        } catch (error) {
            console.error('Error getting user by username:', error);
            throw error;
        }
    }

    /**
     * Get a user by email
     * @param email Email address
     * @returns User object or null if not found
     */
    public async getUserByEmail(email: string): Promise<User | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const user = await this.db.get(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
            
            return user || null;
        } catch (error) {
            console.error('Error getting user by email:', error);
            throw error;
        }
    }

    /**
     * Authenticate a user
     * @param username Username or email
     * @param password Plain text password
     * @returns JWT token if authentication is successful, null otherwise
     */
    public async authenticate(username: string, password: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            // Check if username is an email
            const isEmail = username.includes('@');
            
            // Get user by username or email
            const user = isEmail 
                ? await this.getUserByEmail(username)
                : await this.getUserByUsername(username);
            
            if (!user) {
                return null;
            }
            
            // Compare passwords
            const passwordMatch = await bcrypt.compare(password, user.password);
            
            if (!passwordMatch) {
                return null;
            }
            
            // Update last login time
            await this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    username: user.username, 
                    email: user.email,
                    isAdmin: user.is_admin,
                    isVerified: user.is_verified
                },
                this.JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            return token;
        } catch (error) {
            console.error('Error authenticating user:', error);
            throw error;
        }
    }

    /**
     * Update user credits
     * @param userId User ID
     * @param credits New credit balance
     * @returns True if the update was successful, false otherwise
     */
    public async updateUserCredits(userId: number, credits: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'UPDATE users SET credits = ? WHERE id = ?',
                [credits, userId]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user credits:', error);
            throw error;
        }
    }

    /**
     * Update user password
     * @param userId User ID
     * @param password New plain text password
     * @returns True if the update was successful, false otherwise
     */
    public async updateUserPassword(userId: number, password: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const result = await this.db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, userId]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user password:', error);
            throw error;
        }
    }

    /**
     * Update user verification status
     * @param userId User ID
     * @param isVerified Verification status
     * @returns True if the update was successful, false otherwise
     */
    public async updateUserVerification(userId: number, isVerified: boolean): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'UPDATE users SET is_verified = ? WHERE id = ?',
                [isVerified ? 1 : 0, userId]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user verification:', error);
            throw error;
        }
    }

    /**
     * Update user admin status
     * @param userId User ID
     * @param isAdmin Admin status
     * @returns True if the update was successful, false otherwise
     */
    public async updateUserAdminStatus(userId: number, isAdmin: boolean): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'UPDATE users SET is_admin = ? WHERE id = ?',
                [isAdmin ? 1 : 0, userId]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user admin status:', error);
            throw error;
        }
    }

    /**
     * Get all users
     * @returns Array of all users
     */
    public async getAllUsers(): Promise<User[]> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const users = await this.db.all('SELECT * FROM users ORDER BY id ASC');
            return users;
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    /**
     * Delete a user
     * @param userId User ID
     * @returns True if the deletion was successful, false otherwise
     */
    public async deleteUser(userId: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
}
