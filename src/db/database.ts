import initSqlJs, { Database } from 'sql.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';

export class DB {
    private static instance: DB;
    private db: Database;
    private dbPath: string;

    private constructor() {
        this.dbPath = 'research.db';
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

        // Initialize schema if new database or run migrations if database already exists
        if (!data) {
            const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
            this.db.exec(schema);
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

    run(sql: string, params: any[] = []): void {
        if (!this.db) throw new Error('Database not initialized');
        this.db.run(sql, params);
        this.saveDatabase();
    }

    get<T = any>(sql: string, params: any[] = []): T | undefined {
        if (!this.db) throw new Error('Database not initialized');
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const result = stmt.step() ? stmt.getAsObject() as T : undefined;
        stmt.free();
        return result;
    }

    all<T = any>(sql: string, params: any[] = []): T[] {
        if (!this.db) throw new Error('Database not initialized');
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results: T[] = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject() as T);
        }
        stmt.free();
        return results;
    }

    transaction<T>(fn: () => T): T {
        try {
            this.db.exec('BEGIN TRANSACTION');
            const result = fn();
            this.db.exec('COMMIT');
            this.saveDatabase();
            return result;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
}
