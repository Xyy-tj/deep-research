import { DB } from '../db/database';
import { CreditManager } from '../user/credit-manager';
import { generateOrderId, CREDIT_PRICING } from '../utils/payment-utils';

// Payment record interface
export interface PaymentRecord {
  id?: number;
  user_id: number;
  order_id: string;
  amount: number;
  credits: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  payment_data?: string;
  created_at?: string;
  updated_at?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private db?: DB;

  private constructor() {}

  static async getInstance(): Promise<PaymentService> {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
      PaymentService.instance.db = await DB.getInstance();
    }
    return PaymentService.instance;
  }

  /**
   * Create a new payment record
   */
  async createPaymentRecord(
    userId: number,
    amount: number,
    credits: number,
    paymentMethod: string,
    paymentData?: any
  ): Promise<PaymentRecord> {
    if (!this.db) throw new Error('Database not initialized');

    const orderId = generateOrderId();
    
    const result = await this.db.run(
      `INSERT INTO payment_records 
       (user_id, order_id, amount, credits, status, payment_method, payment_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        orderId,
        amount,
        credits,
        'pending',
        paymentMethod,
        paymentData ? JSON.stringify(paymentData) : null
      ]
    );

    console.log(`Created payment record with ID: ${result.lastID}`);

    return {
      id: result.lastID,
      user_id: userId,
      order_id: orderId,
      amount,
      credits,
      status: 'pending',
      payment_method: paymentMethod,
      payment_data: paymentData ? JSON.stringify(paymentData) : undefined
    };
  }

  /**
   * Get payment record by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<PaymentRecord | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.get<PaymentRecord>(
      'SELECT * FROM payment_records WHERE order_id = ?',
      [orderId]
    );
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: string,
    status: 'pending' | 'completed' | 'failed',
    paymentData?: any
  ): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Get payment record before updating
      const payment = await this.getPaymentByOrderId(orderId);
      
      if (!payment) {
        throw new Error(`Payment record not found for order ID: ${orderId}`);
      }
      
      // Check if payment was previously pending
      const wasPending = payment.status === 'pending';
      
      // Update payment record
      await this.db.run(
        `UPDATE payment_records 
         SET status = ?, payment_data = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = ?`,
        [
          status,
          paymentData ? JSON.stringify(paymentData) : null,
          orderId
        ]
      );

      // If payment is completed and was previously pending, add credits to user
      if (status === 'completed' && wasPending) {
        const creditManager = await CreditManager.getInstance();
        await creditManager.addCredits(payment.user_id, payment.credits);
        console.log(`Added ${payment.credits} credits to user ${payment.user_id}`);
      }

      return true;
    } catch (error) {
      console.error('Error updating payment status:', error);
      return false;
    }
  }

  /**
   * Get user payment history
   */
  async getUserPaymentHistory(userId: number): Promise<PaymentRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.all<PaymentRecord>(
      'SELECT * FROM payment_records WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
  }

  /**
   * Calculate credits for a given amount
   */
  calculateCreditsForAmount(amount: number): number {
    return CREDIT_PRICING.calculateCredits(amount);
  }

  /**
   * Get credit packages
   */
  getCreditPackages() {
    return CREDIT_PRICING.packages;
  }

  /**
   * Get credit package by ID
   */
  getCreditPackage(packageId: number) {
    return CREDIT_PRICING.getPackage(packageId);
  }

  /**
   * Get all payments (for admin use)
   */
  async getAllPayments(): Promise<PaymentRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.all<PaymentRecord>(
      'SELECT * FROM payment_records ORDER BY created_at DESC'
    );
  }
}
