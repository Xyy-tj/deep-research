import { CreditConfig, User, UsageRecord } from './types';
import { DB } from '../db/database';

export class CreditManager {
  private static instance: CreditManager;
  private db?: DB;
  
  private config: CreditConfig = {
    baseCredits: process.env.CREDITS_BASE_PRICE ? Number(process.env.CREDITS_BASE_PRICE) : 2,
    depthMultiplier: process.env.CREDITS_DEPTH_MULTIPLIER ? Number(process.env.CREDITS_DEPTH_MULTIPLIER) : 1,
    breadthMultiplier: process.env.CREDITS_BREADTH_MULTIPLIER ? Number(process.env.CREDITS_BREADTH_MULTIPLIER) : 0.5,
  };

  private constructor() {}

  static async getInstance(): Promise<CreditManager> {
    if (!CreditManager.instance) {
      CreditManager.instance = new CreditManager();
      CreditManager.instance.db = await DB.getInstance();
    }
    return CreditManager.instance;
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

  updateConfig(config: Partial<CreditConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
