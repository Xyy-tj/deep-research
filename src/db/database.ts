import initSqlJs, { Database } from 'sql.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';

export class DB {
    private static instance: DB;
    private db: Database;
    private dbPath: string;

    private constructor() {
        // Use absolute path for database file
        this.dbPath = path.join(process.cwd(), 'research.db');
    }

    private async initializeDatabase() {
        if (this.db) {
            return; // Already initialized
        }
        
        const SQL = await initSqlJs();
        
        let data: Buffer | null = null;
        if (existsSync(this.dbPath)) {
            data = readFileSync(this.dbPath);
        }
        
        this.db = new SQL.Database(data);

        // Initialize schema if new database
        if (!data) {
            // Use absolute path for schema file, looking in both source and compiled locations
            const possibleSchemaLocations = [
                path.join(process.cwd(), 'src', 'db', 'schema.sql'),
                path.join(process.cwd(), 'dist', 'db', 'schema.sql'),
                path.join(__dirname, 'schema.sql')
            ];
            
            let schemaContent: string | null = null;
            for (const schemaPath of possibleSchemaLocations) {
                if (existsSync(schemaPath)) {
                    console.log('Found schema at:', schemaPath);
                    schemaContent = readFileSync(schemaPath, 'utf-8');
                    break;
                }
            }
            
            if (!schemaContent) {
                throw new Error('Could not find schema.sql file in any expected location');
            }

            this.db.exec(schemaContent);
            this.saveDatabase();
        } else {
            // Check if 'updated_at' column exists in users table
            const result = this.db.exec('PRAGMA table_info(users);');
            let hasUpdatedAt = false;
            if (result.length && result[0].values) {
                for (const row of result[0].values) {
                    // row structure: [cid, name, type, notnull, dflt_value, pk]
                    if (row[1] === 'updated_at') {
                        hasUpdatedAt = true;
                        break;
                    }
                }
            }
            if (!hasUpdatedAt) {
                // Add column without default value first
                this.db.run('ALTER TABLE users ADD COLUMN updated_at DATETIME;');
                // Update existing rows with current timestamp
                this.db.run('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;');
                console.log("Migration: 'updated_at' column added to users table and initialized.");
                this.saveDatabase();
            }

            // Check if usage_records table exists
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_records';");
            if (!tableCheck.length) {
                // Create usage_records table if it doesn't exist
                const usageRecordsSchema = `
                    CREATE TABLE usage_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        query TEXT NOT NULL,
                        query_depth INTEGER NOT NULL,
                        query_breadth INTEGER NOT NULL,
                        credits_used INTEGER NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    );`;
                this.db.exec(usageRecordsSchema);
                console.log("Migration: 'usage_records' table created.");
                this.saveDatabase();
            }
        }
    }

    private saveDatabase() {
        const data = Buffer.from(this.db.export());
        writeFileSync(this.dbPath, data);
    }

    static async getInstance(): Promise<DB> {
        if (!DB.instance) {
            DB.instance = new DB();
            await DB.instance.initializeDatabase();
        } else if (!DB.instance.db) {
            await DB.instance.initializeDatabase();
        }
        return DB.instance;
    }

    async run(sql: string, params: any[] = []): Promise<{ lastID?: number }> {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql, 'with params:', params);
        const result = this.db.run(sql, params);
        this.saveDatabase();
        
        // Return an object with lastID if it's an INSERT statement
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            return { lastID: this.db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
        }
        
        return {};
    }

    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql, 'with params:', params);
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const result = stmt.step();
        if (!result) {
            stmt.free();
            return undefined;
        }
        const row = stmt.getAsObject();
        stmt.free();
        console.log('SQL result:', row);
        return row as T;
    }

    async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql, 'with params:', params);
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results: T[] = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject() as T);
        }
        stmt.free();
        console.log('SQL results:', results);
        return results;
    }

    async exec(sql: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql);
        this.db.run(sql);
        this.saveDatabase();
    }

    runSync(sql: string, params: any[] = []): { lastID?: number } {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql, 'with params:', params);
        const result = this.db.run(sql, params);
        
        // Return an object with lastID if it's an INSERT statement
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            return { lastID: this.db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
        }
        
        return {};
    }

    getSync<T = any>(sql: string, params: any[] = []): T | undefined {
        if (!this.db) throw new Error('Database not initialized');
        console.log('Executing SQL:', sql, 'with params:', params);
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const result = stmt.step();
        if (!result) {
            stmt.free();
            return undefined;
        }
        const row = stmt.getAsObject();
        stmt.free();
        console.log('SQL result:', row);
        return row as T;
    }

    async transaction<T>(fn: () => T): Promise<T> {
        if (!this.db) throw new Error('Database not initialized');
        
        this.runSync('BEGIN TRANSACTION');
        try {
            const result = fn(); // Synchronous execution
            this.runSync('COMMIT');
            this.saveDatabase();
            return result;
        } catch (error) {
            console.error('Transaction error:', error);
            try {
                this.runSync('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
            throw error;
        }
    }
}
