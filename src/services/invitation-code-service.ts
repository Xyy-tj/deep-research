import { DB } from '../db/database';

interface InvitationCode {
    id: number;
    code: string;
    is_used: boolean;
    used_by: number | null;
    created_at: string;
    used_at: string | null;
}

export class InvitationCodeService {
    private static instance: InvitationCodeService;
    private db?: DB;

    private constructor() {}

    static async getInstance(): Promise<InvitationCodeService> {
        if (!InvitationCodeService.instance) {
            InvitationCodeService.instance = new InvitationCodeService();
            InvitationCodeService.instance.db = await DB.getInstance();
            await InvitationCodeService.instance.initTable();
        }
        return InvitationCodeService.instance;
    }

    /**
     * Initialize the invitation codes table if it doesn't exist
     */
    public async initTable(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS invitation_codes (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    code VARCHAR(255) NOT NULL UNIQUE,
                    is_used BOOLEAN NOT NULL DEFAULT 0,
                    used_by INT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    used_at DATETIME,
                    FOREIGN KEY (used_by) REFERENCES users(id)
                )
            `);
        } catch (error) {
            console.error('Error initializing invitation codes table:', error);
            throw error;
        }
    }

    /**
     * Create a new invitation code
     * @param code The invitation code
     * @returns The created invitation code ID
     */
    public async createCode(code: string): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'INSERT INTO invitation_codes (code) VALUES (?)',
                [code]
            );
            
            return result.lastID;
        } catch (error) {
            console.error('Error creating invitation code:', error);
            throw error;
        }
    }

    /**
     * Get an invitation code by its code
     * @param code The invitation code
     * @returns The invitation code object or null if not found
     */
    public async getCodeByCode(code: string): Promise<InvitationCode | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.get(
                'SELECT * FROM invitation_codes WHERE code = ?',
                [code]
            );
            
            return result || null;
        } catch (error) {
            console.error('Error getting invitation code:', error);
            throw error;
        }
    }

    /**
     * Mark an invitation code as used
     * @param code The invitation code
     * @param userId The ID of the user who used the code
     * @returns True if the code was marked as used, false otherwise
     */
    public async useCode(code: string, userId: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const invitationCode = await this.getCodeByCode(code);
            
            if (!invitationCode) {
                return false;
            }
            
            if (invitationCode.is_used) {
                return false;
            }
            
            const result = await this.db.run(
                'UPDATE invitation_codes SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?',
                [userId, code]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error using invitation code:', error);
            throw error;
        }
    }

    /**
     * Get all invitation codes
     * @returns Array of all invitation codes
     */
    public async getAllCodes(): Promise<InvitationCode[]> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.all(
                'SELECT * FROM invitation_codes ORDER BY created_at DESC'
            );
            
            return result;
        } catch (error) {
            console.error('Error getting all invitation codes:', error);
            throw error;
        }
    }

    /**
     * Delete an invitation code
     * @param id The ID of the invitation code to delete
     * @returns True if the code was deleted, false otherwise
     */
    public async deleteCode(id: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.initTable();
            
            const result = await this.db.run(
                'DELETE FROM invitation_codes WHERE id = ?',
                [id]
            );
            
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting invitation code:', error);
            throw error;
        }
    }
}
