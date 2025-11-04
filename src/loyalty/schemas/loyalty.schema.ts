import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';
import { Guest } from '../../guest/schemas/guest.schema';

@Schema({ timestamps: true })
export class Loyalty extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user?: User;

  @Prop({ type: Types.ObjectId, ref: 'Guest' })
  guest?: Guest;

  @Prop({ default: 0 })
  points: number;
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const LoyaltySchema = SchemaFactory.createForClass(Loyalty);
