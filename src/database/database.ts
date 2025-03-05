import sqlite3 from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import path from 'path';
import fs from 'fs';

interface RunResult {
    lastID: number;
    changes: number;
}

export class Database {
    private static instance: Database;
    private db: SQLiteDatabase | null = null;
    private dbPath: string;

    constructor() {
        // Ensure the data directory exists
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        this.dbPath = path.join(dataDir, 'database.sqlite');
    }

    /**
     * Get the database instance
     */
    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    /**
     * Initialize the database connection
     */
    private async init(): Promise<SQLiteDatabase> {
        if (!this.db) {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });
            
            // Enable foreign keys
            await this.db.exec('PRAGMA foreign_keys = ON');
        }
        return this.db;
    }

    /**
     * Run a SQL query with parameters
     * @param sql SQL query
     * @param params Query parameters
     * @returns RunResult object with lastID and changes
     */
    public async run(sql: string, params: any[] = []): Promise<RunResult> {
        const db = await this.init();
        return await db.run(sql, ...params);
    }

    /**
     * Get a single row from a SQL query
     * @param sql SQL query
     * @param params Query parameters
     * @returns Single row or undefined if not found
     */
    public async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
        const db = await this.init();
        return await db.get<T>(sql, ...params);
    }

    /**
     * Get all rows from a SQL query
     * @param sql SQL query
     * @param params Query parameters
     * @returns Array of rows
     */
    public async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        const db = await this.init();
        return await db.all<T>(sql, ...params);
    }

    /**
     * Execute a SQL query
     * @param sql SQL query
     */
    public async exec(sql: string): Promise<void> {
        const db = await this.init();
        await db.exec(sql);
    }

    /**
     * Close the database connection
     */
    public async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}
