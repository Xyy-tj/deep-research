import { Router } from 'express';
import { PaymentService } from '../services/payment-service';
import { wxPay, queryPaymentStatus, verifyWxPayNotification, PaymentOptions } from '../utils/payment-utils';

const router = Router();
export const notifyRouter = Router();

// Logger for payment routes
const logger = {
  debug: (...args: any[]) => console.debug('[Payment]', ...args),
  info: (...args: any[]) => console.info('[Payment]', ...args),
  error: (...args: any[]) => console.error('[Payment]', ...args)
};

// Get credit packages
router.get('/packages', async (req, res) => {
  try {
    const paymentService = await PaymentService.getInstance();
    const packages = paymentService.getCreditPackages();
    res.json({ packages });
  } catch (error: any) {
    logger.error('Error fetching credit packages:', error);
    res.status(500).json({ error: 'Failed to fetch credit packages' });
  }
});

// Create a payment order
router.post('/create-order', async (req, res) => {
  try {
    const { packageId, customAmount, paymentMethod } = req.body;
    const userId = (req as any).user.id;
    
    logger.info(`Creating payment order for user ${userId}:`, { packageId, customAmount, paymentMethod });
    
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    
    if (paymentMethod !== 'wxpay') {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }
    
    const paymentService = await PaymentService.getInstance();
    
    let amount = 0;
    let credits = 0;
    
    // Determine amount and credits based on package or custom amount
    if (packageId) {
      const creditPackage = paymentService.getCreditPackage(Number(packageId));
      if (!creditPackage) {
        return res.status(400).json({ error: 'Invalid package ID' });
      }
      amount = creditPackage.price;
      credits = creditPackage.credits;
    } else if (customAmount) {
      amount = Number(customAmount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      credits = paymentService.calculateCreditsForAmount(amount);
    } else {
      return res.status(400).json({ error: 'Either packageId or customAmount is required' });
    }
    
    // Create payment record in database
    const paymentRecord = await paymentService.createPaymentRecord(
      userId,
      amount,
      credits,
      paymentMethod
    );
    
    // Get backend URL from request
    const backendUrl = `${req.protocol}://${req.get('host')}`;
    
    // Create payment options
    const paymentOptions: PaymentOptions = {
      orderId: paymentRecord.order_id,
      amount: amount,
      title: `Deep Research Credits: ${credits}`,
      userId: userId,
      backendUrl: backendUrl
    };
    
    // Process payment based on method
    if (paymentMethod === 'wxpay') {
      const paymentResult = await wxPay(paymentOptions);
      
      if (paymentResult.success) {
        // Update payment record with payment data
        await paymentService.updatePaymentStatus(
          paymentRecord.order_id,
          'pending',
          paymentResult.data
        );
        
        res.json({
          success: true,
          orderId: paymentRecord.order_id,
          payUrl: paymentResult.data?.payUrl,
          amount: amount,
          credits: credits
        });
      } else {
        // Update payment record as failed
        await paymentService.updatePaymentStatus(
          paymentRecord.order_id,
          'failed',
          { error: paymentResult.message }
        );
        
        res.status(400).json({
          success: false,
          error: paymentResult.message
        });
      }
    }
  } catch (error: any) {
    logger.error('Error creating payment order:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Check payment status
router.get('/check-status/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = (req as any).user.id;
    
    logger.info(`Checking payment status for order ${orderId}, user ${userId}`);
    
    const paymentService = await PaymentService.getInstance();
    const payment = await paymentService.getPaymentByOrderId(orderId);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment order not found' });
    }
    
    // Ensure user can only check their own payments
    if (payment.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // If payment is still pending, query the payment provider for the latest status
    if (payment.status === 'pending') {
      logger.info(`Payment is pending, querying provider for order ${orderId}`);
      
      const queryResult = await queryPaymentStatus(orderId);
      
      if (queryResult.success && queryResult.status) {
        logger.info(`Payment provider returned status ${queryResult.status} for order ${orderId}`);
        
        // Update payment status if it's completed
        if (queryResult.status === 'OD') {
          logger.info(`Updating payment status to completed for order ${orderId}`);
          
          await paymentService.updatePaymentStatus(
            orderId,
            'completed',
            queryResult.data
          );
          
          // Get updated payment record
          const updatedPayment = await paymentService.getPaymentByOrderId(orderId);
          if (updatedPayment) {
            return res.json({
              orderId: updatedPayment.order_id,
              status: updatedPayment.status,
              amount: updatedPayment.amount,
              credits: updatedPayment.credits,
              createdAt: updatedPayment.created_at
            });
          }
        } else if (queryResult.status === 'CD') {
          // Payment was cancelled
          logger.info(`Updating payment status to failed for order ${orderId}`);
          
          await paymentService.updatePaymentStatus(
            orderId,
            'failed',
            queryResult.data
          );
          
          // Get updated payment record
          const updatedPayment = await paymentService.getPaymentByOrderId(orderId);
          if (updatedPayment) {
            return res.json({
              orderId: updatedPayment.order_id,
              status: updatedPayment.status,
              amount: updatedPayment.amount,
              credits: updatedPayment.credits,
              createdAt: updatedPayment.created_at
            });
          }
        }
      } else {
        logger.warn(`Failed to query payment status from provider for order ${orderId}: ${queryResult.message}`);
      }
    }
    
    // Return current payment status
    res.json({
      orderId: payment.order_id,
      status: payment.status,
      amount: payment.amount,
      credits: payment.credits,
      createdAt: payment.created_at
    });
  } catch (error: any) {
    logger.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Get user payment history
router.get('/history', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    logger.info(`Fetching payment history for user ${userId}`);
    
    const paymentService = await PaymentService.getInstance();
    const payments = await paymentService.getUserPaymentHistory(userId);
    
    // Format payment history for client
    const formattedPayments = payments.map(payment => ({
      orderId: payment.order_id,
      amount: payment.amount,
      credits: payment.credits,
      status: payment.status,
      paymentMethod: payment.payment_method,
      createdAt: payment.created_at
    }));
    
    res.json({ payments: formattedPayments });
  } catch (error: any) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// WeChat Pay notification endpoint
notifyRouter.post('/', async (req, res) => {
  try {
    logger.info('Received WeChat Pay notification');
    const data = req.body;
    
    logger.debug('Notification data:', data);
    
    // Verify notification signature
    if (!verifyWxPayNotification(data)) {
      logger.error('Invalid notification signature');
      return res.status(200).send('success'); // Return success to prevent retries
    }
    
    // Check payment status
    if (data.status === 'OD') {
      logger.info(`Payment successful for order ${data.trade_order_id}`);
      
      const paymentService = await PaymentService.getInstance();
      const payment = await paymentService.getPaymentByOrderId(data.trade_order_id);
      
      if (!payment) {
        logger.error(`Payment record not found for order ${data.trade_order_id}`);
        return res.status(200).send('success'); // Return success to prevent retries
      }
      
      // Update payment status and add credits to user
      await paymentService.updatePaymentStatus(
        data.trade_order_id,
        'completed',
        data
      );
      
      logger.info(`Payment completed for order ${data.trade_order_id}`);
    } else {
      logger.info(`Payment not successful for order ${data.trade_order_id}, status: ${data.status}`);
    }
    
    // Always return success to the payment provider
    res.status(200).send('success');
  } catch (error: any) {
    logger.error('Error processing payment notification:', error);
    // Always return success to the payment provider to prevent retries
    res.status(200).send('success');
  }
});

export default router;
