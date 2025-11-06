import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PayOS } from '@payos/node';

export interface PayOSPaymentLinkRequest {
  orderCode: number; // Unique order code (6-8 digits)
  amount: number; // Amount in VND
  description: string; // Order description
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  returnUrl: string; // URL to redirect after payment
  cancelUrl: string; // URL to redirect if cancel
  expiredAt?: number; // Expiration timestamp (optional)
}

export interface PayOSPaymentLinkResponse {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  qrCode: string;
  checkoutUrl: string;
  status: string;
}

export interface PayOSWebhookData {
  code: string; // Order code
  desc: string; // Description
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId?: string;
    counterAccountBankName?: string;
    counterAccountName?: string;
    counterAccountNumber?: string;
    virtualAccountName?: string;
    virtualAccountNumber?: string;
  };
  signature: string;
}

@Injectable()
export class PayOSService {
  private readonly payOS: PayOS;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly checksumKey: string;
  private readonly baseUrl: string;
  private readonly returnUrl: string;
  private readonly cancelUrl: string;

  constructor(private configService: ConfigService) {
    // Debug: Log all PayOS related env vars (without showing values)
    const clientIdRaw = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKeyRaw = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKeyRaw = this.configService.get<string>('PAYOS_CHECKSUM_KEY');
    
    console.log('🔍 PayOS Config Check:');
    console.log('  - PAYOS_CLIENT_ID:', clientIdRaw ? `✅ Set (length: ${clientIdRaw.length})` : '❌ Missing');
    console.log('  - PAYOS_API_KEY:', apiKeyRaw ? `✅ Set (length: ${apiKeyRaw.length})` : '❌ Missing');
    console.log('  - PAYOS_CHECKSUM_KEY:', checksumKeyRaw ? `✅ Set (length: ${checksumKeyRaw.length})` : '❌ Missing');
    
    this.clientId = clientIdRaw || '';
    this.apiKey = apiKeyRaw || '';
    this.checksumKey = checksumKeyRaw || '';
    this.baseUrl = this.configService.get<string>('PAYOS_BASE_URL') || 'https://api-merchant.payos.vn';
    // Get base URL from config or use default
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.returnUrl = this.configService.get<string>('PAYOS_RETURN_URL') || `${baseUrl}/payment/callback`;
    this.cancelUrl = this.configService.get<string>('PAYOS_CANCEL_URL') || `${baseUrl}/payment/callback?status=CANCELLED`;

    if (!this.clientId || !this.apiKey || !this.checksumKey) {
      console.error('❌ PayOS credentials not fully configured!');
      console.error('   Please check your .env file in the agoda/ directory.');
      console.error('   Required variables: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY');
      console.error('   See PAYOS_SETUP.md or ENV_SETUP.md for configuration details.');
      // Initialize with empty values to avoid runtime errors
      this.payOS = new PayOS({
        clientId: '',
        apiKey: '',
        checksumKey: '',
      });
    } else {
      // Initialize PayOS SDK with options object
      try {
        this.payOS = new PayOS({
          clientId: this.clientId,
          apiKey: this.apiKey,
          checksumKey: this.checksumKey,
          baseURL: this.baseUrl,
        });
        console.log('✅ PayOS SDK initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize PayOS SDK:', error);
        // Fallback to empty initialization
        this.payOS = new PayOS({
          clientId: '',
          apiKey: '',
          checksumKey: '',
        });
      }
    }
  }

  /**
   * Generate unique order code (6-8 digits)
   */
  private generateOrderCode(): number {
    // Generate 8-digit number from timestamp + random
    const timestamp = Date.now() % 10000000; // Last 7-8 digits
    const random = Math.floor(Math.random() * 1000);
    return parseInt(`${timestamp}${random}`.slice(-8));
  }

  /**
   * Create HMAC signature for webhook verification
   */
  private createSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.checksumKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(webhookData: PayOSWebhookData): boolean {
    try {
      const { code, desc, data } = webhookData;
      const dataString = JSON.stringify({ code, desc, data });
      const signature = this.createSignature(dataString);
      return signature === webhookData.signature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Create payment link via PayOS API
   */
  async createPaymentLink(
    request: Omit<PayOSPaymentLinkRequest, 'returnUrl' | 'cancelUrl'> & {
      returnUrl?: string;
      cancelUrl?: string;
    }
  ): Promise<PayOSPaymentLinkResponse> {
    if (!this.clientId || !this.apiKey) {
      throw new BadRequestException('PayOS credentials not configured');
    }

    const orderCode = request.orderCode || this.generateOrderCode();
    
    // Validate orderCode: must be 6-8 digits
    if (!Number.isInteger(orderCode) || orderCode < 100000 || orderCode > 99999999) {
      throw new BadRequestException(
        `Order code must be 6-8 digits. Received: ${orderCode}`
      );
    }
    
    // Validate amount: must be positive
    if (!request.amount || request.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }
    
    // Validate items
    if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
      throw new BadRequestException('Items array is required and cannot be empty');
    }
    
    // Validate each item
    for (const item of request.items) {
      if (!item.name || !item.quantity || !item.price) {
        throw new BadRequestException(
          'Each item must have name, quantity, and price fields'
        );
      }
      if (item.quantity <= 0 || item.price <= 0) {
        throw new BadRequestException(
          'Item quantity and price must be greater than 0'
        );
      }
    }
    
    // PayOS requires description max 25 characters
    let description = request.description || `Order #${orderCode}`;
    if (description.length > 25) {
      description = description.substring(0, 25);
      console.log('⚠️  Description truncated to 25 chars:', description);
    }
    
    const paymentData: PayOSPaymentLinkRequest = {
      orderCode,
      amount: request.amount,
      description,
      items: request.items,
      returnUrl: request.returnUrl || this.returnUrl,
      cancelUrl: request.cancelUrl || this.cancelUrl,
    };

    try {
      console.log('🌐 Creating PayOS payment link using SDK...');
      console.log('📋 Request payload:', JSON.stringify(paymentData, null, 2));
      
      // Use PayOS SDK to create payment link
      const result = await this.payOS.paymentRequests.create({
        orderCode: paymentData.orderCode,
        amount: paymentData.amount,
        description: paymentData.description,
        items: paymentData.items,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
        expiredAt: paymentData.expiredAt,
      });
      
      console.log('✅ PayOS SDK Response:', {
        orderCode: result.orderCode,
        paymentLinkId: result.paymentLinkId,
        checkoutUrl: result.checkoutUrl,
        qrCode: result.qrCode ? 'Present' : 'Missing',
        status: result.status,
      });
      
      // Validate required fields
      if (!result.checkoutUrl) {
        console.error('❌ Missing checkoutUrl in PayOS response');
        throw new BadRequestException(
          'PayOS API returned invalid response: missing checkoutUrl. ' +
          'Vui lòng kiểm tra PayOS credentials và request format.'
        );
      }
      
      // Map SDK response to our interface
      const response: PayOSPaymentLinkResponse = {
        bin: result.bin || '',
        accountNumber: result.accountNumber || '',
        accountName: result.accountName || '',
        amount: result.amount,
        description: result.description,
        orderCode: result.orderCode,
        currency: result.currency || 'VND',
        paymentLinkId: result.paymentLinkId,
        qrCode: result.qrCode || '',
        checkoutUrl: result.checkoutUrl,
        status: result.status || 'PENDING',
      };
      
      return response;
    } catch (error: any) {
      console.error('❌ Error creating PayOS payment link:', error);
      
      // Handle PayOS SDK errors
      if (error?.message) {
        const errorMessage = error.message;
        console.error('PayOS SDK Error:', errorMessage);
        
        // Provide specific guidance based on error
        let guidance = '';
        if (errorMessage.includes('20') || errorMessage.includes('Thông tin truyền lên không đúng')) {
          guidance = `\n💡 Error Code 20 - "Thông tin truyền lên không đúng":\n` +
            `   Có thể do:\n` +
            `   1. PayOS account chưa được kích hoạt đầy đủ (mặc dù đã verify)\n` +
            `   2. PayOS account chưa được approve để tạo payment links\n` +
            `   3. Credentials không đúng hoặc không khớp với account\n` +
            `   4. PayOS account đang ở chế độ test/sandbox nhưng dùng production credentials\n` +
            `\n   Hãy:\n` +
            `   1. Kiểm tra lại credentials trên https://my.payos.vn\n` +
            `   2. Đảm bảo account đã được activate đầy đủ\n` +
            `   3. Kiểm tra xem account có quyền tạo payment links không\n` +
            `   4. Liên hệ PayOS support nếu vẫn lỗi: support@payos.vn`;
        } else if (errorMessage.includes('01') || errorMessage.includes('02') || errorMessage.includes('Authentication')) {
          guidance = `\n💡 Authentication Error:\n` +
            `   Client ID hoặc API Key không đúng\n` +
            `   Hãy kiểm tra lại trên PayOS Dashboard`;
        }
        
        throw new BadRequestException(
          `PayOS API Error: ${errorMessage}${guidance}\n` +
          `\nRequest được gửi:\n` +
          `- Order Code: ${paymentData.orderCode}\n` +
          `- Amount: ${paymentData.amount} VND\n` +
          `- Items: ${paymentData.items.length} item(s)\n` +
          `- Return URL: ${paymentData.returnUrl}\n` +
          `\nXem tài liệu PayOS: https://payos.vn/docs`
        );
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Generic error
      const errorMessage = error?.message || 'Failed to create payment link';
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Get payment information by payment link ID
   */
  async getPaymentLinkInfo(paymentLinkId: string): Promise<any> {
    if (!this.payOS) {
      throw new BadRequestException('PayOS SDK not initialized');
    }

    try {
      const result = await this.payOS.paymentRequests.get(paymentLinkId);
      return result;
    } catch (error: any) {
      console.error('Error getting PayOS payment info:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error?.message || 'Failed to get payment info'
      );
    }
  }

  /**
   * Cancel payment link
   */
  async cancelPaymentLink(paymentLinkId: string): Promise<any> {
    if (!this.payOS) {
      throw new BadRequestException('PayOS SDK not initialized');
    }

    try {
      const result = await this.payOS.paymentRequests.cancel(paymentLinkId);
      return result;
    } catch (error: any) {
      console.error('Error canceling PayOS payment link:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error?.message || 'Failed to cancel payment link'
      );
    }
  }
}

