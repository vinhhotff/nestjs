import { Controller, Post, Body, Get } from '@nestjs/common';
import { PayOSService } from './payos.service';
import { ConfigService } from '@nestjs/config';
import { Public } from 'src/auth/decoration/setMetadata';

/**
 * Debug controller để test PayOS API trực tiếp
 * Chỉ dùng cho development/testing
 */
@Public()
@Controller('payment/payos/debug')
export class PayOSDebugController {
  constructor(
    private readonly payOSService: PayOSService,
    private readonly configService: ConfigService,
  ) {}

  @Post('test-minimal')
  async testMinimal() {
    try {
      // Test với minimal valid data
      const testOrderCode = Math.floor(100000 + Math.random() * 90000000); // Random 8-digit
      
      console.log('🧪 Testing PayOS with minimal data using SDK...');
      console.log('Order Code:', testOrderCode);

      const result = await this.payOSService.createPaymentLink({
        orderCode: testOrderCode,
        amount: 1000, // Minimum amount
        description: 'Test payment',
        items: [
          {
            name: 'Test Item',
            quantity: 1,
            price: 1000,
          },
        ],
        returnUrl: 'http://localhost:3000/test',
        cancelUrl: 'http://localhost:3000/test',
      });

      return {
        success: true,
        message: 'PayOS SDK test successful',
        data: result,
      };
    } catch (error: any) {
      console.error('❌ PayOS test failed:', error);
      return {
        success: false,
        message: error.message || 'PayOS test failed',
        error: {
          message: error.message,
          stack: error.stack,
        },
      };
    }
  }

  @Get('credentials-info')
  async getCredentialsInfo() {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID') || '';
    const apiKey = this.configService.get<string>('PAYOS_API_KEY') || '';
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY') || '';
    const baseUrl = this.configService.get<string>('PAYOS_BASE_URL') || 'https://api-merchant.payos.vn';

    return {
      baseUrl,
      credentials: {
        clientId: clientId ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 4)} (${clientId.length} chars)` : 'Missing',
        apiKey: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)} (${apiKey.length} chars)` : 'Missing',
        checksumKey: checksumKey ? `${checksumKey.substring(0, 8)}...${checksumKey.substring(checksumKey.length - 4)} (${checksumKey.length} chars)` : 'Missing',
      },
      configured: !!(clientId && apiKey && checksumKey),
    };
  }
}

