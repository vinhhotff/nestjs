import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types, Document } from 'mongoose';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
export type OrderDocument = Order & Document;

export enum OrderType {
  DINE_IN = 'DINE_IN',
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

@Schema({ timestamps: true })
export class Order extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Guest' })
  guest?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user?: Types.ObjectId;
  @Prop({
    type: [
      {
        item: { type: Types.ObjectId, ref: 'MenuItem', required: true },
        quantity: { type: Number, required: true, min: 1 },
        note: { type: String, default: '' },
        unitPrice: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
      },
    ],
    required: true,
  })
  items: {
    item: Types.ObjectId;
    quantity: number;
    note?: string;
    unitPrice: number;
    subtotal: number;
  }[];

  @Prop({
    type: String,
    enum: ['pending', 'preparing', 'served', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'preparing' | 'served' | 'cancelled';

  @Prop({ required: true, min: 0 })
  totalPrice: number; // Tổng tiền của order

  @Prop({ default: false })
  isPaid: boolean;

  @Prop({ default: false })
  loyaltyAwarded?: boolean;

  @Prop({ required: false })
  payosOrderCode?: number; // PayOS order code for payment tracking

  @Prop({ required: false })
  payosPaymentLinkId?: string; // PayOS payment link ID

  @Prop()
  specialInstructions?: string; // Ghi chú đặc biệt cho đơn hàng

  @Prop()
  estimatedReadyTime?: Date; // Thời gian dự kiến hoàn thành

  @Prop({ type: Types.ObjectId, ref: 'Table', required: false })
  table?: Types.ObjectId; // Bàn phục vụ

  @Prop({
    type: String,
    enum: OrderType,
    default: OrderType.DINE_IN,
  })
  orderType: OrderType;

  @Prop({ required: false })
  deliveryAddress?: string;

  @Prop({ required: false })
  customerName?: string;

  @Prop({ required: false })
  customerPhone?: string;

  @Prop({ type: Object })
  createdBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  updatedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  // Timestamps are automatically handled by Mongoose when timestamps: true
  createdAt: Date;
  updatedAt: Date;

  // Soft delete fields are handled by the plugin
  isDeleted?: boolean;
  deletedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.plugin(softDeletePlugin);

// Add indexes for analytics performance
OrderSchema.index({ createdAt: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: 1, status: 1 }); // Compound index for analytics queries
OrderSchema.index({ 'items.item': 1 }); // For top-selling queries

export interface IOrder {
  _id: string;
  guest?: Types.ObjectId;
  user?: Types.ObjectId;
  items: {
    item: Types.ObjectId;
    quantity: number;
    note?: string;
    unitPrice: number;
    subtotal: number;
  }[];
  status: 'pending' | 'preparing' | 'served' | 'cancelled';
  totalPrice: number;
  isPaid: boolean;
  loyaltyAwarded?: boolean;
  specialInstructions?: string; // Ghi chú đặc biệt cho đơn hàng
  estimatedReadyTime?: Date;
  table?: Types.ObjectId;
  orderType: OrderType;
  deliveryAddress?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  SERVED = 'served',
  CANCELLED = 'cancelled',
}
