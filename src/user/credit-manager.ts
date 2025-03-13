import { CreditConfig, User, UsageRecord } from './types';
import { DB } from '../db/database';
import { SystemSettingsService } from '../services/system-settings-service';

export class CreditManager {
  private static instance: CreditManager;
  private db?: DB;
  private systemSettingsService?: SystemSettingsService;
  
  private config: CreditConfig = {
    baseCredits: 2,
    depthMultiplier: 1,
    breadthMultiplier: 0.5,
  };

  private constructor() {}

  static async getInstance(): Promise<CreditManager> {
    if (!CreditManager.instance) {
      CreditManager.instance = new CreditManager();
      CreditManager.instance.db = await DB.getInstance();
      CreditManager.instance.systemSettingsService = await SystemSettingsService.getInstance();
      await CreditManager.instance.loadSettingsFromDatabase();
    }
    return CreditManager.instance;
  }

  /**
   * Load credit configuration settings from the database
   */
  private async loadSettingsFromDatabase(): Promise<void> {
    try {
      if (!this.systemSettingsService) {
        throw new Error('SystemSettingsService not initialized');
      }
      
      const settings = await this.systemSettingsService.getSettings();
      this.config = {
        baseCredits: settings.baseCredits,
        depthMultiplier: settings.depthMultiplier,
        breadthMultiplier: settings.breadthMultiplier
      };
      
      console.log('[CreditManager] Loaded settings from database:', this.config);
    } catch (error) {
      console.error('[CreditManager] Error loading settings from database:', error);
      // Keep default values if there's an error
    }
  }

  calculateQueryCost(depth: number, breadth: number): number {
    const { baseCredits, depthMultiplier, breadthMultiplier } = this.config;
    return Math.ceil(
      baseCredits + 
      depth * depthMultiplier + 
      breadth * breadthMultiplier
    );
  }

  async checkUserCredits(userId: string | number, depth: number, breadth: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cost = this.calculateQueryCost(depth, breadth);
    console.log('Checking credits for user:', { userId, cost });
    const user = await this.db.get<{ credits: number }>(
      'SELECT credits FROM users WHERE id = ?',
      [Number(userId)] // Convert userId to number since our DB uses INTEGER PRIMARY KEY
    );
    
    if (!user) {
      console.error('User not found:', userId);
      throw new Error('User not found');
    }

    console.log('Found user credits:', user.credits);
    return user.credits >= cost;
  }

  async deductCredits(userId: string | number, query: string, depth: number, breadth: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cost = this.calculateQueryCost(depth, breadth);
    const numericUserId = Number(userId);
    console.log('Deducting credits:', { userId: numericUserId, cost });
    
    // Run all operations inside a transaction
    await this.db.transaction(async () => {
      // Get the original credits within the transaction
      const user = await this.db.get<{ credits: number }>(
        'SELECT credits FROM users WHERE id = ?',
        [numericUserId]
      );
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.credits < cost) {
        throw new Error('Insufficient credits');
      }
      
      // Update credits
      await this.db.run(
        'UPDATE users SET credits = credits - ? WHERE id = ?',
        [cost, numericUserId]
      );
      
      // Record usage
      await this.db.run(
        'INSERT INTO usage_records (user_id, query, query_depth, query_breadth, credits_used) VALUES (?, ?, ?, ?, ?)',
        [numericUserId, query, depth, breadth, cost]
      );
    });

    console.log('Credits deducted successfully');
    return cost;
  }

  async addUser(userId: string | number, initialCredits: number = 12): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT INTO users (id, credits) VALUES (?, ?)',
      [Number(userId), initialCredits]
    );
  }

  async getUser(userId: string | number): Promise<User | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const user = await this.db.get<{ id: number; credits: number }>(
      'SELECT id, credits FROM users WHERE id = ?',
      [Number(userId)]
    );
    
    if (!user) {
      return undefined;
    }

    const usageHistory = await this.db.all<UsageRecord>(
      'SELECT query, query_depth as queryDepth, query_breadth as queryBreadth, credits_used as creditsUsed, timestamp FROM usage_records WHERE user_id = ? ORDER BY timestamp DESC',
      [Number(userId)]
    );

    return {
      id: user.id,
      credits: user.credits,
      usageHistory
    };
  }

  async getBalance(userId: string | number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log(`[CreditManager] Getting balance for user ID: ${userId}`);
    
    try {
      const user = await this.db.get<{ credits: number }>(
        'SELECT credits FROM users WHERE id = ?',
        [Number(userId)]
      );
      
      if (!user) {
        console.error(`[CreditManager] User not found: ${userId}`);
        throw new Error('User not found');
      }
      
      console.log(`[CreditManager] Found balance for user ${userId}: ${user.credits}`);
      return user.credits;
    } catch (error) {
      console.error(`[CreditManager] Error getting balance for user ${userId}:`, error);
      throw error;
    }
  }

  async addCredits(userId: string | number, credits: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'UPDATE users SET credits = credits + ? WHERE id = ?',
      [credits, Number(userId)]
    );
  }

  /**
   * Update the credit configuration
   * This method is primarily used for testing or manual overrides
   */
  updateConfig(config: Partial<CreditConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reload settings from the database
   * This can be called when settings are updated in the admin panel
   */
  async reloadSettings(): Promise<void> {
    await this.loadSettingsFromDatabase();
  }

  /**
   * Refund credits to a user when research fails
   * @param userId The user ID
   * @param query The original query
   * @param depth The research depth
   * @param breadth The research breadth
   * @param reason The reason for the refund
   * @returns The number of credits refunded
   */
  async refundCredits(userId: string | number, query: string, depth: number, breadth: number, reason: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cost = this.calculateQueryCost(depth, breadth);
    const numericUserId = Number(userId);
    console.log(`[CreditManager] Refunding ${cost} credits to user ${numericUserId} due to: ${reason}`);
    
    // Run all operations inside a transaction
    await this.db.transaction(async () => {
      // Update credits
      await this.db.run(
        'UPDATE users SET credits = credits + ? WHERE id = ?',
        [cost, numericUserId]
      );
      
      // Record refund
      await this.db.run(
        'INSERT INTO usage_records (user_id, query, query_depth, query_breadth, credits_used, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [numericUserId, query, depth, breadth, -cost, `Refund: ${reason}`]
      );
    });

    console.log(`[CreditManager] Credits refunded successfully to user ${numericUserId}`);
    return cost;
  }
}
