import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

export class DB {
    private static instance: DB;
    private pool: mysql.Pool;
    private transactionActive: boolean = false;
    private transactionQueue: Promise<any> = Promise.resolve();

    private constructor() {
        // Create a connection pool using environment variables
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'deep_research',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    private async initializeDatabase() {
        if (this.pool) {
            return; // Already initialized
        }
        
        // Create a connection pool using environment variables
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'deep_research',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Check if we need to initialize the schema
        try {
            const connection = await this.pool.getConnection();
            
            // Check if users table exists
            const [rows] = await connection.query("SHOW TABLES LIKE 'users'");
            const tablesExist = Array.isArray(rows) && rows.length > 0;
            
            if (!tablesExist) {
                console.log('Initializing database schema...');
                
                // Use absolute path for schema file, looking in both source and compiled locations
                const possibleSchemaLocations = [
                    path.join(process.cwd(), 'src', 'db', 'mysql_schema.sql'),
                    path.join(process.cwd(), 'dist', 'db', 'mysql_schema.sql'),
                    path.join(__dirname, 'mysql_schema.sql')
                ];
                
                let schemaContent: string | null = null;
                for (const schemaPath of possibleSchemaLocations) {
                    if (fs.existsSync(schemaPath)) {
                        console.log('Found schema at:', schemaPath);
                        schemaContent = fs.readFileSync(schemaPath, 'utf-8');
                        break;
                    }
                }
                
                if (!schemaContent) {
                    throw new Error('Could not find mysql_schema.sql file in any expected location');
                }

                // Split schema into individual statements and execute them
                const statements = schemaContent
                    .split(';')
                    .map(statement => statement.trim())
                    .filter(statement => statement.length > 0);

                for (const statement of statements) {
                    await connection.query(statement);
                }
                
                console.log('Database schema initialized successfully');
            }
            
            connection.release();
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    static async getInstance(): Promise<DB> {
        if (!DB.instance) {
            DB.instance = new DB();
            await DB.instance.initializeDatabase();
        } else if (!DB.instance.pool) {
            await DB.instance.initializeDatabase();
        }
        return DB.instance;
    }

    /**
     * Helper function to convert MySQL results to proper types
     * MySQL2 returns some numeric fields as strings, this converts them back to numbers
     */
    private convertTypes<T>(rows: any[]): T[] {
        return rows.map(row => {
            const converted: any = {};
            for (const key in row) {
                // Convert numeric strings to numbers
                if (typeof row[key] === 'string' && !isNaN(Number(row[key])) && 
                    // Don't convert IDs that are strings or dates
                    !key.includes('_id') && 
                    !key.includes('id') && 
                    !key.includes('_at') && 
                    !key.includes('time')) {
                    converted[key] = Number(row[key]);
                } else {
                    converted[key] = row[key];
                }
            }
            return converted as T;
        });
    }

    async run(sql: string, params: any[] = []): Promise<{ lastID?: number }> {
        try {
            console.log('Executing SQL:', sql, 'with params:', params);
            const [result] = await this.pool.execute(sql, params);
            
            // Return an object with lastID if it's an INSERT statement
            let lastID;
            if (sql.trim().toUpperCase().startsWith('INSERT')) {
                if ('insertId' in result) {
                    lastID = result.insertId;
                    console.log('Generated last insert ID:', lastID);
                }
            }
            
            if (lastID !== undefined) {
                return { lastID };
            }
            return {};
        } catch (error) {
            console.error('Error executing SQL:', error);
            throw error;
        }
    }

    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        try {
            console.log('Executing SQL:', sql, 'with params:', params);
            const [rows] = await this.pool.execute(sql, params);
            
            if (Array.isArray(rows) && rows.length > 0) {
                return this.convertTypes<T>(rows)[0];
            }
            return undefined;
        } catch (error) {
            console.error('Error executing SQL:', error);
            throw error;
        }
    }

    async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        try {
            console.log('Executing SQL:', sql, 'with params:', params);
            const [rows] = await this.pool.execute(sql, params);
            
            if (Array.isArray(rows)) {
                return this.convertTypes<T>(rows);
            }
            return [];
        } catch (error) {
            console.error('Error executing SQL:', error);
            throw error;
        }
    }

    async beginTransaction(): Promise<void> {
        if (this.transactionActive) {
            throw new Error('Transaction already active');
        }
        
        this.transactionActive = true;
        this.transactionQueue = this.transactionQueue.then(async () => {
            const connection = await this.pool.getConnection();
            await connection.beginTransaction();
            return connection;
        });
    }

    async commitTransaction(): Promise<void> {
        if (!this.transactionActive) {
            throw new Error('No active transaction to commit');
        }
        
        this.transactionQueue = this.transactionQueue.then(async (connection) => {
            await connection.commit();
            connection.release();
            this.transactionActive = false;
        });
    }

    async rollbackTransaction(): Promise<void> {
        if (!this.transactionActive) {
            throw new Error('No active transaction to rollback');
        }
        
        this.transactionQueue = this.transactionQueue.then(async (connection) => {
            await connection.rollback();
            connection.release();
            this.transactionActive = false;
        });
    }

    /**
     * Execute a callback function within a transaction
     * @param callback Function to execute within the transaction
     * @returns Result of the callback function
     */
    async transaction<T>(callback: () => Promise<T>): Promise<T> {
        try {
            await this.beginTransaction();
            const result = await callback();
            await this.commitTransaction();
            return result;
        } catch (error) {
            if (this.transactionActive) {
                await this.rollbackTransaction();
            }
            throw error;
        }
    }
}
