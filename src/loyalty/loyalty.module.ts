import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { Loyalty, LoyaltySchema } from './schemas/loyalty.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Guest, GuestSchema } from '../guest/schemas/guest.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Loyalty.name, schema: LoyaltySchema },
      { name: User.name, schema: UserSchema },
      { name: Guest.name, schema: GuestSchema },
    ]),
  ],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService], // Export để sử dụng trong OrderService
})
export class LoyaltyModule {}
