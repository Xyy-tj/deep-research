import initSqlJs, { Database } from 'sql.js';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

// Migration class to handle SQLite to MySQL data transfer
class DatabaseMigration {
    private sqliteDb: Database;
    private mysqlPool: mysql.Pool;
    private sqliteDbPath: string;

    constructor() {
        // SQLite database path
        this.sqliteDbPath = path.join(process.cwd(), 'research.db');
        
        // MySQL connection pool for root (for initial setup)
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = parseInt(process.env.DB_PORT || '3306');
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'deep_research';
        
        console.log(`Connecting to MySQL at ${dbHost}:${dbPort} with user ${dbUser}`);
        
        // MySQL connection pool
        this.mysqlPool = mysql.createPool({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: dbName,  // Specify the database directly
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            multipleStatements: true
        });
    }

    // Initialize SQLite database
    async initSqlite(): Promise<void> {
        console.log('Initializing SQLite database...');
        
        if (!fs.existsSync(this.sqliteDbPath)) {
            throw new Error(`SQLite database file not found at: ${this.sqliteDbPath}`);
        }
        
        const SQL = await initSqlJs();
        const data = fs.readFileSync(this.sqliteDbPath);
        this.sqliteDb = new SQL.Database(data);
        
        console.log('SQLite database initialized successfully');
    }

    // Setup MySQL database and ensure it exists with proper permissions
    async setupMysqlDatabase(): Promise<void> {
        console.log('Setting up MySQL database...');
        
        try {
            // Check database connection
            await this.mysqlPool.query('SELECT 1');
            console.log('MySQL connection successful');
            
            // Load schema
            await this.loadMysqlSchema();
            
        } catch (error) {
            console.error('Error setting up MySQL database:', error);
            throw error;
        }
    }
    
    // Load MySQL schema
    async loadMysqlSchema(): Promise<void> {
        console.log('Loading MySQL schema...');
        
        try {
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
                try {
                    await this.mysqlPool.query(statement);
                } catch (error) {
                    console.warn(`Warning executing schema statement: ${error.message}`);
                    console.warn(`Statement was: ${statement}`);
                }
            }
            
            console.log('MySQL schema loaded successfully');
        } catch (error) {
            console.error('Error loading MySQL schema:', error);
            throw error;
        }
    }

    // Get all tables from SQLite database
    getTables(): string[] {
        const result = this.sqliteDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        
        if (result.length === 0 || !result[0].values) {
            return [];
        }
        
        return result[0].values.map(row => row[0] as string);
    }

    // Get column information for a table
    getTableColumns(tableName: string): { name: string; type: string }[] {
        const result = this.sqliteDb.exec(`PRAGMA table_info(${tableName});`);
        
        if (result.length === 0 || !result[0].values) {
            return [];
        }
        
        return result[0].values.map(row => ({
            name: row[1] as string,
            type: row[2] as string
        }));
    }

    // Get all data from a SQLite table
    getTableData(tableName: string): any[] {
        const result = this.sqliteDb.exec(`SELECT * FROM ${tableName};`);
        
        if (result.length === 0 || !result[0].values) {
            return [];
        }
        
        const columns = this.getTableColumns(tableName).map(col => col.name);
        
        return result[0].values.map(row => {
            const rowData: Record<string, any> = {};
            columns.forEach((col, index) => {
                rowData[col] = row[index];
            });
            return rowData;
        });
    }

    // Format date values to MySQL compatible format
    formatDateValue(value: any): any {
        if (value === null || value === undefined) {
            return null;
        }
        
        // Check if value is a date string
        if (typeof value === 'string' && (
            value.includes('T') || 
            value.includes('Z') || 
            value.match(/^\d{4}-\d{2}-\d{2}/)
        )) {
            try {
                // Try to parse as date
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    // Format as MySQL datetime: YYYY-MM-DD HH:MM:SS
                    return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
                }
            } catch (e) {
                console.warn(`Failed to parse date: ${value}`, e);
            }
        }
        
        return value;
    }

    // Insert data into MySQL table
    async insertDataToMysql(tableName: string, data: any[]): Promise<void> {
        if (data.length === 0) {
            console.log(`No data to insert for table: ${tableName}`);
            return;
        }
        
        const columns = Object.keys(data[0]);
        const placeholders = columns.map(() => '?').join(', ');
        
        const connection = await this.mysqlPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Disable foreign key checks temporarily
            await connection.query('SET FOREIGN_KEY_CHECKS=0;');
            
            // Clear existing data
            await connection.query(`TRUNCATE TABLE ${tableName};`);
            
            // Prepare the insert statement
            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
            
            // Insert data in batches
            const batchSize = 100;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                
                // Format date values for MySQL
                const formattedBatch = batch.map(row => {
                    const formattedRow: Record<string, any> = {};
                    for (const col in row) {
                        formattedRow[col] = this.formatDateValue(row[col]);
                    }
                    return formattedRow;
                });
                
                const values = formattedBatch.map(row => columns.map(col => row[col]));
                
                for (const rowValues of values) {
                    await connection.query(sql, rowValues);
                }
            }
            
            // Re-enable foreign key checks
            await connection.query('SET FOREIGN_KEY_CHECKS=1;');
            
            await connection.commit();
            console.log(`Successfully migrated ${data.length} rows to table: ${tableName}`);
        } catch (error) {
            await connection.rollback();
            console.error(`Error migrating data for table ${tableName}:`, error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Main migration function
    async migrate(): Promise<void> {
        try {
            // Setup MySQL database first
            await this.setupMysqlDatabase();
            
            // Initialize SQLite database
            await this.initSqlite();
            
            // Get all tables
            const tables = this.getTables();
            console.log(`Found ${tables.length} tables to migrate: ${tables.join(', ')}`);
            
            // Process tables in order to respect foreign key constraints
            const tableOrder = [
                'users',
                'system_settings',
                'credit_packages',
                'invitation_codes',
                'usage_records',
                'research_records',
                'payment_records'
            ];
            
            // Sort tables based on predefined order
            const sortedTables = tableOrder.filter(table => tables.includes(table));
            
            // Add any tables not in the predefined order
            tables.forEach(table => {
                if (!sortedTables.includes(table)) {
                    sortedTables.push(table);
                }
            });
            
            // Migrate each table
            for (const tableName of sortedTables) {
                console.log(`Migrating table: ${tableName}`);
                const data = this.getTableData(tableName);
                console.log(`Found ${data.length} rows in table: ${tableName}`);
                await this.insertDataToMysql(tableName, data);
            }
            
            console.log('Migration completed successfully');
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        } finally {
            // Close connections
            if (this.sqliteDb) {
                this.sqliteDb.close();
            }
            await this.mysqlPool.end();
        }
    }
}

// Run the migration
async function runMigration() {
    console.log('Starting SQLite to MySQL migration...');
    
    const migration = new DatabaseMigration();
    
    try {
        await migration.migrate();
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Execute migration
runMigration();
