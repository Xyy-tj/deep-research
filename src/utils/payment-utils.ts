import axios from 'axios';
import md5 from 'md5';
import { v4 as uuidv4 } from 'uuid';
import { CreditPackageService } from '../services/credit-package-service';
import { SystemSettingsService } from '../services/system-settings-service';

// Payment configuration
const PAYMENT_CONFIG = {
  wxpay: {
    appId: process.env.XUNHUPAY_APPID || '',
    appSecret: process.env.XUNHUPAY_SECRET || '',
    apiUrl: 'https://api.xunhupay.com/payment/do.html',
    queryUrl: 'https://api.xunhupay.com/payment/query.html',
    notifyUrl: '/api/payment/wxnotify',
  }
};

// Credit pricing configuration
const CREDIT_PRICING = {
  // Calculate credits for custom amount
  calculateCredits: async (amount: number) => {
    // Get the current exchange rate from system settings
    const settingsService = await SystemSettingsService.getInstance();
    const exchangeRate = await settingsService.getCreditExchangeRate();
    
    // Calculate credits based on the exchange rate
    return Math.floor(amount * exchangeRate);
  },
  
  // Get all active packages
  getPackages: async () => {
    const service = await CreditPackageService.getInstance();
    return service.getActivePackages();
  },
  
  // Get package by ID
  getPackage: async (id: number) => {
    const service = await CreditPackageService.getInstance();
    return service.getPackageById(id);
  },
  
  // Get current credit exchange rate
  getExchangeRate: async () => {
    const settingsService = await SystemSettingsService.getInstance();
    return settingsService.getCreditExchangeRate();
  },
  
  // Update credit exchange rate
  updateExchangeRate: async (rate: number) => {
    const settingsService = await SystemSettingsService.getInstance();
    await settingsService.updateSettings({ creditExchangeRate: rate });
    return rate;
  }
};

// Generate current timestamp in the format required by the payment API
function nowDate(): number {
  return Math.floor(Date.now() / 1000);
}

// Generate a hash for payment verification
function getHash(params: Record<string, any>, appSecret: string): string {
  const sortedParams = Object.keys(params)
    .filter(key => params[key] && key !== 'hash') // Filter out empty values and hash itself
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const stringSignTemp = sortedParams + appSecret;
  return md5(stringSignTemp);
}

// Generate a unique order ID
function generateOrderId(): string {
  const timestamp = Date.now().toString();
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DR${timestamp}${randomPart}`;
}

// Interface for payment options
interface PaymentOptions {
  orderId: string;
  amount: number;
  title: string;
  userId: number;
  backendUrl: string;
}

// Interface for payment response
interface PaymentResponse {
  success: boolean;
  message: string;
  data?: {
    payUrl?: string;
    orderId: string;
    [key: string]: any;
  };
}

// Process WeChat payment
async function wxPay(options: PaymentOptions): Promise<PaymentResponse> {
  try {
    const { appId, appSecret, apiUrl } = PAYMENT_CONFIG.wxpay;
    
    if (!appId || !appSecret) {
      throw new Error('WeChat Pay configuration is missing');
    }

    const params = {
      version: '1.1',
      appid: appId,
      trade_order_id: options.orderId,
      total_fee: options.amount.toFixed(2), // Format to 2 decimal places
      title: options.title,
      time: nowDate(),
      notify_url: `${options.backendUrl}${PAYMENT_CONFIG.wxpay.notifyUrl}`,
      nonce_str: uuidv4().replace(/-/g, ''),
      type: 'WAP',
      wap_url: 'https://deep-research.ai',
      wap_name: 'Deep Research AI',
    };

    console.log('Payment request params:', params);

    const hash = getHash(params, appSecret);
    
    // Prepare request parameters
    const requestParams = new URLSearchParams({
      ...params,
      hash,
    });

    // Send POST request to payment gateway
    const response = await axios.post(apiUrl, requestParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Payment API response:', response.data);

    if (response.data.errcode === 0 && response.data.url) {
      return {
        success: true,
        message: 'Payment URL generated successfully',
        data: {
          payUrl: response.data.url,
          orderId: options.orderId,
          rawResponse: response.data
        }
      };
    } else {
      throw new Error(response.data.errmsg || 'Unknown payment error');
    }
  } catch (error: any) {
    console.error('WeChat Pay error:', error);
    return {
      success: false,
      message: error.message || 'Payment processing failed',
      data: { orderId: options.orderId }
    };
  }
}

// Query payment status from Xunhupay
async function queryPaymentStatus(orderId: string): Promise<{
  success: boolean;
  status?: 'OD' | 'WP' | 'CD';
  message: string;
  data?: any;
}> {
  try {
    const { appId, appSecret, queryUrl } = PAYMENT_CONFIG.wxpay;
    
    if (!appId || !appSecret) {
      throw new Error('WeChat Pay configuration is missing');
    }

    const params = {
      appid: appId,
      out_trade_order: orderId,
      time: Math.floor(Date.now() / 1000).toString(),
      nonce_str: uuidv4().replace(/-/g, ''),
    };

    console.log('Query payment status params:', params);

    const hash = getHash(params, appSecret);
    
    // Prepare request parameters
    const requestParams = new URLSearchParams({
      ...params,
      hash,
    });

    // Send POST request to payment gateway
    const response = await axios.post(queryUrl, requestParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('Payment status query response:', response.data);

    if (response.data.errcode === 0 && response.data.data) {
      return {
        success: true,
        status: response.data.data.status,
        message: 'Payment status query successful',
        data: response.data.data
      };
    } else {
      throw new Error(response.data.errmsg || 'Unknown payment query error');
    }
  } catch (error: any) {
    console.error('Payment status query error:', error);
    return {
      success: false,
      message: error.message || 'Payment status query failed',
    };
  }
}

// Verify payment notification from WeChat Pay
function verifyWxPayNotification(data: Record<string, any>): boolean {
  try {
    const { appSecret } = PAYMENT_CONFIG.wxpay;
    
    if (!appSecret) {
      throw new Error('WeChat Pay configuration is missing');
    }

    // Verify hash
    const calculatedHash = getHash(data, appSecret);
    return data.hash === calculatedHash;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
}

export {
  wxPay,
  queryPaymentStatus,
  verifyWxPayNotification,
  generateOrderId,
  CREDIT_PRICING,
  PaymentOptions,
  PaymentResponse
};
