import { CreditConfig, User, UsageRecord } from './types';
import { DB } from '../db/database';

export class CreditManager {
  private static instance: CreditManager;
  private db?: DB;
  
  private config: CreditConfig = {
    baseCredits: 1,
    depthMultiplier: 0.5,
    breadthMultiplier: 0.3,
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

  async checkUserCredits(userId: string, depth: number, breadth: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cost = this.calculateQueryCost(depth, breadth);
    const user = await this.db.get<{ credits: number }>(
      'SELECT credits FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      throw new Error('User not found');
    }

    return user.credits >= cost;
  }

  async deductCredits(userId: string, query: string, depth: number, breadth: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const creditsUsed = this.calculateQueryCost(depth, breadth);
    
    return this.db.transaction(async () => {
      const user = await this.db.get<{ credits: number }>(
        'SELECT credits FROM users WHERE id = ?',
        [userId]
      );

      if (!user || user.credits < creditsUsed) {
        throw new Error('Insufficient credits');
      }

      await this.db.run(
        'UPDATE users SET credits = credits - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [creditsUsed, userId]
      );

      await this.db.run(
        'INSERT INTO usage_records (user_id, query, query_depth, query_breadth, credits_used) VALUES (?, ?, ?, ?, ?)',
        [userId, query, depth, breadth, creditsUsed]
      );

      return creditsUsed;
    });
  }

  async addUser(userId: string, initialCredits: number = 100): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'INSERT INTO users (id, credits) VALUES (?, ?)',
      [userId, initialCredits]
    );
  }

  async getUser(userId: string): Promise<User | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    
    const user = await this.db.get<{ id: string; credits: number }>(
      'SELECT id, credits FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return undefined;
    }

    const usageHistory = await this.db.all<UsageRecord>(
      'SELECT query, query_depth as queryDepth, query_breadth as queryBreadth, credits_used as creditsUsed, timestamp FROM usage_records WHERE user_id = ? ORDER BY timestamp DESC',
      [userId]
    );

    return {
      id: user.id,
      credits: user.credits,
      usageHistory
    };
  }

  async addCredits(userId: string, credits: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run(
      'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [credits, userId]
    );
  }

  updateConfig(config: Partial<CreditConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
