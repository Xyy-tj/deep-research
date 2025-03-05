import { DB } from '../db/database';

interface SystemSettings {
    baseCredits: number;
    depthMultiplier: number;
    breadthMultiplier: number;
}

export class SystemSettingsService {
    private static instance: SystemSettingsService;
    private db?: DB;

    private constructor() {}

    static async getInstance(): Promise<SystemSettingsService> {
        if (!SystemSettingsService.instance) {
            SystemSettingsService.instance = new SystemSettingsService();
            SystemSettingsService.instance.db = await DB.getInstance();
        }
        return SystemSettingsService.instance;
    }

    /**
     * Initialize the system settings table if it doesn't exist
     */
    public async initSettings(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Create settings table if it doesn't exist
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);

            // Check if settings exist
            const baseCredits = await this.getSetting('baseCredits');
            const depthMultiplier = await this.getSetting('depthMultiplier');
            const breadthMultiplier = await this.getSetting('breadthMultiplier');

            // Insert default settings if they don't exist
            if (baseCredits === null) {
                await this.setSetting('baseCredits', '2');
            }
            if (depthMultiplier === null) {
                await this.setSetting('depthMultiplier', '1');
            }
            if (breadthMultiplier === null) {
                await this.setSetting('breadthMultiplier', '0.5');
            }
        } catch (error) {
            console.error('Error initializing system settings:', error);
            throw error;
        }
    }

    /**
     * Get a specific setting by key
     * @param key Setting key
     * @returns Setting value or null if not found
     */
    public async getSetting(key: string): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            const result = await this.db.get(
                'SELECT value FROM system_settings WHERE key = ?',
                [key]
            );
            return result ? result.value : null;
        } catch (error) {
            console.error(`Error getting setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Set a specific setting
     * @param key Setting key
     * @param value Setting value
     */
    public async setSetting(key: string, value: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            await this.db.run(
                'INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)',
                [key, value]
            );
        } catch (error) {
            console.error(`Error setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get all system settings
     * @returns SystemSettings object with all settings
     */
    public async getSettings(): Promise<SystemSettings> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Make sure settings are initialized
            await this.initSettings();

            // Get all settings
            const baseCredits = await this.getSetting('baseCredits');
            const depthMultiplier = await this.getSetting('depthMultiplier');
            const breadthMultiplier = await this.getSetting('breadthMultiplier');

            return {
                baseCredits: parseFloat(baseCredits || '2'),
                depthMultiplier: parseFloat(depthMultiplier || '1'),
                breadthMultiplier: parseFloat(breadthMultiplier || '0.5')
            };
        } catch (error) {
            console.error('Error getting system settings:', error);
            throw error;
        }
    }

    /**
     * Update all system settings
     * @param settings SystemSettings object with new settings
     * @returns Updated SystemSettings
     */
    public async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Make sure settings are initialized
            await this.initSettings();

            // Update settings
            if (settings.baseCredits !== undefined) {
                await this.setSetting('baseCredits', settings.baseCredits.toString());
            }
            if (settings.depthMultiplier !== undefined) {
                await this.setSetting('depthMultiplier', settings.depthMultiplier.toString());
            }
            if (settings.breadthMultiplier !== undefined) {
                await this.setSetting('breadthMultiplier', settings.breadthMultiplier.toString());
            }

            // Return updated settings
            return await this.getSettings();
        } catch (error) {
            console.error('Error updating system settings:', error);
            throw error;
        }
    }
}
