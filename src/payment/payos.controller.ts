import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Req
} from '@nestjs/common';
import { PayOSService, PayOSWebhookData } from './payos.service';
import { OrderService } from '../order/order.service';
import { PayMentService } from '../pay-ment/pay-ment.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../order/schemas/order.schema';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/auth/decoration/setMetadata';

@Controller('payment/payos')
export class PayOSController {
  constructor(
    private readonly payOSService: PayOSService,
    private readonly orderService: OrderService,
    private readonly paymentService: PayMentService,
    private readonly configService: ConfigService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  @Public()
  @Get('check-config')
  async checkConfig() {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID') || '';
    const apiKey = this.configService.get<string>('PAYOS_API_KEY') || '';
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY') || '';
    
    return {
      configured: !!(clientId && apiKey && checksumKey),
      clientIdExists: !!clientId,
      apiKeyExists: !!apiKey,
      checksumKeyExists: !!checksumKey,
      message: (clientId && apiKey && checksumKey) 
        ? 'PayOS is properly configured'
        : 'PayOS credentials are missing. Please add PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY to your .env file in the agoda/ directory.',
    };
  }

  @Public()
  @Post('create-link')
  async createPaymentLink(
    @Body() body: {
      orderId: string;
      amount: number;
      description?: string;
    },
  ) {
    try {
      console.log('📥 Received create payment link request:', {
        orderId: body.orderId,
        amount: body.amount,
        description: body.description,
      });

      // Get order details
      const order = await this.orderService.findById(body.orderId);

      if (!order) {
        console.error('❌ Order not found:', body.orderId);
        return {
          success: false,
          message: 'Order not found',
        };
      }

      console.log('✅ Order found:', order._id, 'Total:', order.totalPrice);

      // Check if order is already paid
      if (order.isPaid) {
        console.warn('⚠️ Order already paid:', order._id);
        return {
          success: false,
          message: 'Order is already paid',
        };
      }

      // Prepare items for PayOS
      // PayOS requires: name (string), quantity (number), price (number in VND)
      const items = order.items.map((item: any, index: number) => {
        const itemName = item.item?.name || item.name || 'Menu Item';
        const quantity = item.quantity || 1;
        // Try different possible price fields
        const price = item.unitPrice || item.price || item.item?.price || 0;
        
        if (!price || price <= 0) {
          console.error(`❌ Item ${index} has invalid price:`, item);
          throw new Error(`Item "${itemName}" has invalid price: ${price}`);
        }
        
        if (!quantity || quantity <= 0) {
          console.error(`❌ Item ${index} has invalid quantity:`, item);
          throw new Error(`Item "${itemName}" has invalid quantity: ${quantity}`);
        }
        
        return {
          name: itemName,
          quantity: Number(quantity),
          price: Number(price),
        };
      });

      console.log('📦 PayOS items:', JSON.stringify(items, null, 2));
      
      // Validate items array
      if (items.length === 0) {
        throw new Error('Order must have at least one item');
      }

      // Generate order code (8 digits)
      const orderCode = parseInt(order._id.toString().slice(-8), 16) % 100000000;
      console.log('🔢 Generated order code:', orderCode);

      // Create payment link with return URL including orderId
      const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const returnUrl = `${baseUrl}/payment/callback?orderId=${body.orderId}`;
      const cancelUrl = `${baseUrl}/payment/callback?status=CANCELLED&orderId=${body.orderId}`;

      console.log('🔗 Return URLs:', { returnUrl, cancelUrl });
      console.log('💰 Creating PayOS payment link with amount:', body.amount || order.totalPrice);

      // PayOS requires description max 25 characters
      const defaultDescription = `Order #${order._id.toString().slice(-8)}`;
      const description = body.description 
        ? body.description.substring(0, 25) // Truncate to 25 chars
        : defaultDescription.substring(0, 25);
      
      console.log('📝 Description (max 25 chars):', description, `(${description.length} chars)`);

      const paymentLink = await this.payOSService.createPaymentLink({
        orderCode,
        amount: body.amount || order.totalPrice,
        description,
        items,
        returnUrl,
        cancelUrl,
      });

      console.log('✅ PayOS payment link created:', {
        orderCode: paymentLink.orderCode,
        paymentLinkId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
      });

      // Save PayOS order code and payment link ID to order
      await this.orderService.update(body.orderId, {
        payosOrderCode: paymentLink.orderCode,
        payosPaymentLinkId: paymentLink.paymentLinkId,
      } as any);

      console.log('💾 Order updated with PayOS details');

      return {
        success: true,
        paymentLink: paymentLink.checkoutUrl,
        paymentLinkId: paymentLink.paymentLinkId,
        qrCode: paymentLink.qrCode,
        orderCode: paymentLink.orderCode,
      };
    } catch (error: any) {
      console.error('❌ Error creating payment link:', error);
      console.error('Error stack:', error.stack);
      
      // Provide helpful error message for missing credentials
      let errorMessage = error.message || 'Failed to create payment link';
      if (errorMessage.includes('PayOS credentials not configured') || 
          errorMessage.includes('PayOS chưa được cấu hình')) {
        errorMessage = 'PayOS chưa được cấu hình. Vui lòng:\n' +
          '1. Mở file .env trong thư mục agoda/\n' +
          '2. Thêm các dòng sau:\n' +
          '   PAYOS_CLIENT_ID=your_client_id\n' +
          '   PAYOS_API_KEY=your_api_key\n' +
          '   PAYOS_CHECKSUM_KEY=your_checksum_key\n' +
          '3. Restart backend server\n' +
          'Xem QUICK_START_PAYOS.md để biết chi tiết.';
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @Public()
  @Post('webhook')
  async handleWebhook(@Body() webhookData: PayOSWebhookData, @Req() req: Request) {
    try {
      console.log('📥 PayOS Webhook received:', JSON.stringify(webhookData, null, 2));

      // Verify signature
      const isValid = this.payOSService.verifyWebhookSignature(webhookData);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return {
          success: false,
          message: 'Invalid signature',
        };
      }

      const { code, desc, data } = webhookData;

      // Check if payment is successful
      if (code !== '00' || desc !== 'Success') {
        console.log('⚠️ Payment not successful:', { code, desc });
        return {
          success: false,
          message: `Payment failed: ${desc}`,
        };
      }

      const orderCode = data.orderCode;

      // Find order by payosOrderCode
      const order = await this.orderModel.findOne({ payosOrderCode: orderCode }).exec();

      if (!order) {
        console.error('❌ Order not found for orderCode:', orderCode);
        return {
          success: false,
          message: 'Order not found',
        };
      }

      // Check if already paid
      if (order.isPaid) {
        console.log('ℹ️ Order already paid:', order._id);
        return {
          success: true,
          message: 'Order already paid',
        };
      }

      // Mark order as paid
      await this.orderService.markAsPaid(order._id.toString(), { isPaid: true });

      // Create payment record
      const paymentData = {
        method: 'qr' as const,
        amount: data.amount,
        paidAt: new Date(data.transactionDateTime || new Date()),
        orders: [order._id.toString()],
        ...(order.user ? { user: order.user } : {}),
        ...(order.guest ? { guest: order.guest } : {}),
      };

      await this.paymentService.create(paymentData as any);

      console.log('✅ Payment processed successfully for order:', order._id);

      return {
        success: true,
        message: 'Webhook processed successfully',
        orderId: order._id.toString(),
      };
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return {
        success: false,
        message: error.message || 'Failed to process webhook',
      };
    }
  }

  @Public()
  @Post('confirm-payment')
  async confirmPayment(
    @Body() body: {
      orderId: string;
      orderCode: number;
      amount: number;
    },
  ) {
    try {
      const order = await this.orderService.findById(body.orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Verify payment with PayOS
      // You can verify the payment status with PayOS API if needed

      // Mark order as paid
      await this.orderService.markAsPaid(body.orderId, { isPaid: true });

      // Create payment record
      const paymentData = {
        method: 'qr' as const,
        amount: body.amount,
        paidAt: new Date(),
        orders: [body.orderId],
        ...(order.user ? { user: order.user } : {}),
        ...(order.guest ? { guest: order.guest } : {}),
      };

      await this.paymentService.create(paymentData as any);

      return {
        success: true,
        message: 'Payment confirmed successfully',
      };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        message: error.message || 'Failed to confirm payment',
      };
    }
  }

  @Public()
  @Get('return')
  async handleReturn(
    @Query('orderCode') orderCode: string,
    @Query('status') status: string,
    @Query('orderId') orderId: string,
    @Query() query: any,
  ) {
    try {
      const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      
      // Build query params for redirect
      const params: string[] = [];
      if (orderCode) params.push(`orderCode=${encodeURIComponent(orderCode)}`);
      if (status) params.push(`status=${encodeURIComponent(status)}`);
      if (orderId) params.push(`orderId=${encodeURIComponent(orderId)}`);
      const queryString = params.join('&');
      
      // If payment successful and webhook hasn't processed yet, confirm payment
      if (status === 'PAID' && orderId) {
        try {
          await this.confirmPayment({
            orderId,
            orderCode: orderCode ? parseInt(orderCode) : 0,
            amount: 0, // Will be fetched from order
          });
        } catch (error) {
          console.error('Error confirming payment in return handler:', error);
          // Continue to redirect even if confirmation fails (webhook might have processed it)
        }
      }
      
      // Redirect to frontend callback page
      const redirectUrl = `${baseUrl}/payment/callback${queryString ? '?' + queryString : ''}`;
      
      // Return HTML redirect (for GET request)
      return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
  <p>Redirecting to payment confirmation page...</p>
  <a href="${redirectUrl}">Click here if you are not redirected</a>
</body>
</html>`;
    } catch (error) {
      console.error('Error handling return URL:', error);
      const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${baseUrl}/payment/callback?status=ERROR">
  <script>window.location.href = "${baseUrl}/payment/callback?status=ERROR";</script>
</head>
<body>
  <p>An error occurred. Redirecting...</p>
</body>
</html>`;
    }
  }
}

