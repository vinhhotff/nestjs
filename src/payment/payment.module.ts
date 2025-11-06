import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayOSController } from './payos.controller';
import { PayOSService } from './payos.service';
import { OrderModule } from '../order/order.module';
import { PayMentModule } from '../pay-ment/pay-ment.module';
import { Order, OrderSchema } from '../order/schemas/order.schema';
import { PayOSDebugController } from './payos-debug.controller';

@Module({
  imports: [
    OrderModule,
    PayMentModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [PayOSController, PayOSDebugController],
  providers: [PayOSService],
  exports: [PayOSService],
})
export class PaymentModule {}

