import { DB } from '../db/database';

export interface CreditPackage {
    id?: number;
    credits: number;
    price: number;
    description?: string;
    is_active: boolean;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

export class CreditPackageService {
    private static instance: CreditPackageService;
    private db?: DB;

    private constructor() {}

    static async getInstance(): Promise<CreditPackageService> {
        if (!CreditPackageService.instance) {
            CreditPackageService.instance = new CreditPackageService();
            CreditPackageService.instance.db = await DB.getInstance();
            await CreditPackageService.instance.initDefaultPackages();
        }
        return CreditPackageService.instance;
    }

    /**
     * Initialize default credit packages if none exist
     */
    private async initDefaultPackages(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            // Check if any packages exist
            const existingPackages = await this.getAllPackages();
            
            if (existingPackages.length === 0) {
                console.log('No credit packages found, initializing defaults');
                
                // Default packages from the original configuration
                const defaultPackages = [
                    { credits: 1, price: 0.1, description: '10 元 = 100 credits', display_order: 1 },
                    { credits: 5, price: 10, description: '25 元 = 300 credits (16.7% discount)', display_order: 2 },
                    { credits: 20, price: 30, description: '45 元 = 600 credits (25% discount)', display_order: 3 },
                    { credits: 50, price: 50, description: '80 元 = 1200 credits (33.3% discount)', display_order: 4 },
                ];
                
                // Insert default packages
                for (const pkg of defaultPackages) {
                    await this.createPackage(pkg);
                }
                
                console.log('Default credit packages initialized');
            }
        } catch (error) {
            console.error('Error initializing default credit packages:', error);
        }
    }

    /**
     * Get all credit packages
     */
    async getAllPackages(): Promise<CreditPackage[]> {
        if (!this.db) throw new Error('Database not initialized');

        return this.db.all<CreditPackage>(
            'SELECT * FROM credit_packages ORDER BY display_order ASC'
        );
    }

    /**
     * Get active credit packages
     */
    async getActivePackages(): Promise<CreditPackage[]> {
        if (!this.db) throw new Error('Database not initialized');

        return this.db.all<CreditPackage>(
            'SELECT * FROM credit_packages WHERE is_active = 1 ORDER BY display_order ASC'
        );
    }

    /**
     * Get a credit package by ID
     */
    async getPackageById(id: number): Promise<CreditPackage | undefined> {
        if (!this.db) throw new Error('Database not initialized');

        return this.db.get<CreditPackage>(
            'SELECT * FROM credit_packages WHERE id = ?',
            [id]
        );
    }

    /**
     * Create a new credit package
     */
    async createPackage(packageData: Omit<CreditPackage, 'id' | 'created_at' | 'updated_at'>): Promise<CreditPackage> {
        if (!this.db) throw new Error('Database not initialized');

        const { credits, price, description = '', is_active = true, display_order = 0 } = packageData;
        
        const result = await this.db.run(
            `INSERT INTO credit_packages 
             (credits, price, description, is_active, display_order) 
             VALUES (?, ?, ?, ?, ?)`,
            [credits, price, description, is_active ? 1 : 0, display_order]
        );

        return {
            id: result.lastID,
            credits,
            price,
            description,
            is_active,
            display_order
        };
    }

    /**
     * Update a credit package
     */
    async updatePackage(id: number, packageData: Partial<CreditPackage>): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        const existingPackage = await this.getPackageById(id);
        if (!existingPackage) {
            throw new Error(`Credit package with ID ${id} not found`);
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (packageData.credits !== undefined) {
            updates.push('credits = ?');
            values.push(packageData.credits);
        }

        if (packageData.price !== undefined) {
            updates.push('price = ?');
            values.push(packageData.price);
        }

        if (packageData.description !== undefined) {
            updates.push('description = ?');
            values.push(packageData.description);
        }

        if (packageData.is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(packageData.is_active ? 1 : 0);
        }

        if (packageData.display_order !== undefined) {
            updates.push('display_order = ?');
            values.push(packageData.display_order);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length === 0) {
            return true; // Nothing to update
        }

        values.push(id);

        await this.db.run(
            `UPDATE credit_packages SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return true;
    }

    /**
     * Delete a credit package
     */
    async deletePackage(id: number): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            'DELETE FROM credit_packages WHERE id = ?',
            [id]
        );

        return true;
    }

    /**
     * Calculate credits for a custom amount
     */
    calculateCreditsForAmount(amount: number): number {
        // Base rate: 10 credits per yuan
        return Math.floor(amount * 10);
    }
}
