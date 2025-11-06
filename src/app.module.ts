/* eslint-disable @typescript-eslint/require-await */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { GuestModule } from './guest/guest.module';
import { MenuItemModule } from './menu-item/menu-item.module';
import { OrderModule } from './order/order.module';
import { PayMentModule } from './pay-ment/pay-ment.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ReservationModule } from './reservation/reservation.module';
import { QROrderModule } from './qr-order/qr-order.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TableModule } from './table/table.module';
import { FileModule } from './file/file.module';
import { AboutModule } from './about/about.module';

import { DeliveryModule } from './delivery/delivery.module';
import { VoucherModule } from './voucher/voucher.module';
import { PaymentModule } from './payment/payment.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Use absolute path to ensure .env is found
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '.env.local'),
        '.env',
        '.env.local'
      ],
      expandVariables: true, // Enable variable expansion in .env
      // Load .env from process.cwd() as fallback
      cache: false, // Don't cache so changes are picked up
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        let uri = configService.get<string>('MONGODB_URI');
        if (uri && uri.includes('localhost')) {
          uri = uri.replace('localhost', '127.0.0.1');
        }
        return {
          uri,
          serverSelectionTimeoutMS: 30000, // Tăng timeout để cho Atlas có thời gian "thức dậy"
          connectTimeoutMS: 10000, // Timeout cho kết nối ban đầu
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    RoleModule,
    PermissionModule,
    GuestModule,
    MenuItemModule,
    OrderModule,
    PayMentModule,
    LoyaltyModule,
    ReservationModule,
    QROrderModule,
    AnalyticsModule,
    TableModule,
    FileModule,
    AboutModule,
    DeliveryModule,
    VoucherModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
