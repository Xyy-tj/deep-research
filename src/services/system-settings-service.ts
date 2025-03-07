import { DB } from '../db/database';

interface SystemSettings {
    baseCredits: number;
    depthMultiplier: number;
    breadthMultiplier: number;
    creditExchangeRate: number;
}

export class SystemSettingsService {
    private static instance: SystemSettingsService;
    private db?: DB;

    private constructor() {}

    static async getInstance(): Promise<SystemSettingsService> {
        if (!SystemSettingsService.instance) {
            SystemSettingsService.instance = new SystemSettingsService();
            SystemSettingsService.instance.db = await DB.getInstance();
            await SystemSettingsService.instance.initSettings();
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
                    \`key\` VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);

            // Check if settings exist
            const baseCredits = await this.getSetting('baseCredits');
            const depthMultiplier = await this.getSetting('depthMultiplier');
            const breadthMultiplier = await this.getSetting('breadthMultiplier');
            const creditExchangeRate = await this.getSetting('creditExchangeRate');

            // Insert default settings if they don't exist
            if (baseCredits === null) {
                await this.setSetting('baseCredits', '1');
            }
            if (depthMultiplier === null) {
                await this.setSetting('depthMultiplier', '1');
            }
            if (breadthMultiplier === null) {
                await this.setSetting('breadthMultiplier', '1');
            }
            if (creditExchangeRate === null) {
                await this.setSetting('creditExchangeRate', '10'); // 10 credits per yuan
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
                'SELECT value FROM system_settings WHERE `key` = ?',
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
            // Use MySQL's INSERT ... ON DUPLICATE KEY UPDATE instead of SQLite's INSERT OR REPLACE
            await this.db.run(
                'INSERT INTO system_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                [key, value, value]
            );
        } catch (error) {
            console.error(`Error setting ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get credit exchange rate
     * @returns Credit exchange rate (credits per yuan)
     */
    public async getCreditExchangeRate(): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Make sure settings are initialized
            await this.initSettings();

            const exchangeRate = await this.getSetting('creditExchangeRate');
            return parseFloat(exchangeRate || '10');
        } catch (error) {
            console.error('Error getting credit exchange rate:', error);
            return 10; // Default value if error
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
            const creditExchangeRate = await this.getSetting('creditExchangeRate');

            return {
                baseCredits: parseFloat(baseCredits || '2'),
                depthMultiplier: parseFloat(depthMultiplier || '1'),
                breadthMultiplier: parseFloat(breadthMultiplier || '0.5'),
                creditExchangeRate: parseFloat(creditExchangeRate || '10')
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
            if (settings.creditExchangeRate !== undefined) {
                await this.setSetting('creditExchangeRate', settings.creditExchangeRate.toString());
            }

            // Return updated settings
            return await this.getSettings();
        } catch (error) {
            console.error('Error updating system settings:', error);
            throw error;
        }
    }
}
