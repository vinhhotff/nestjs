import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schemas/user.schema';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Reservation extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  user?: User;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  customerPhone: string;

  @Prop()
  customerEmail?: string;

  @Prop({ required: true })
  reservationDate: Date;

  @Prop({ required: true })
  numberOfGuests: number;

  @Prop()
  specialRequests?: string;

  @Prop({ type: String, enum: ReservationStatus, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Prop()
  tableNumber?: string;

  @Prop()
  notes?: string; // Ghi chú từ nhân viên
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);

export interface IReservation {
  _id: string;
  user: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  reservationDate: Date;
  numberOfGuests: number;
  specialRequests?: string;
  status: ReservationStatus;
  tableNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
