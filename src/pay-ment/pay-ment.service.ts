import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/pay-ment.schema';
import { CreatePaymentDto } from './dto/create-pay-ment.dto';
import { UpdatePaymentDto } from './dto/update-pay-ment.dto';
import { Order, OrderDocument, OrderStatus } from '../order/schemas/order.schema';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class PayMentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly loyaltyService: LoyaltyService
  ) {}

  private extractEntityId(entity: unknown): string | undefined {
    if (!entity) {
      return undefined;
    }

    if (entity instanceof Types.ObjectId) {
      return entity.toString();
    }

    if (typeof entity === 'string') {
      return entity;
    }

    if (typeof entity === 'object') {
      const candidate = entity as { id?: unknown; _id?: unknown };

      if (typeof candidate.id === 'string') {
        return candidate.id;
      }

      if (candidate._id instanceof Types.ObjectId) {
        return candidate._id.toString();
      }

      if (typeof candidate._id === 'string') {
        return candidate._id;
      }
    }

    return undefined;
  }

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const { guest, user, orders } = createPaymentDto;

    if ((guest && user) || (!guest && !user)) {
      throw new BadRequestException(
        'Must provide either guest or user, not both or neither'
      );
    }

    const orderDocuments = await this.orderModel
      .find({ _id: { $in: orders } })
      .exec();
    if (orderDocuments.length !== orders.length) {
      throw new NotFoundException('One or more orders not found');
    }

    const payment = new this.paymentModel(createPaymentDto);
    const savedPayment = await payment.save();

    for (const order of orderDocuments) {
      order.isPaid = true;
      await order.save();

      // Cộng điểm nếu order đã served và chưa cộng trước đó
      if (order.status === OrderStatus.SERVED && !order.loyaltyAwarded) {
        const loyaltyTargetId =
          this.extractEntityId(order.user) ?? this.extractEntityId(order.guest);
        if (loyaltyTargetId) {
          try {
            await this.loyaltyService.autoAddPointsFromOrder(loyaltyTargetId, order.totalPrice);
            order.loyaltyAwarded = true;
            await order.save();
          } catch (e) {
            // log nhưng không chặn thanh toán
            console.error('Lỗi cộng điểm khi thanh toán:', e);
          }
        } else {
          console.warn(
            'Không xác định được ID để cộng điểm loyalty khi thanh toán order',
            order._id.toString()
          );
        }
      }
    }

    return savedPayment;
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentModel.find().populate('orders').exec();
  }
async getTotalRevenue(): Promise<number> {
  const result = await this.paymentModel.aggregate([
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  return result[0]?.total || 0;
}

  async findById(id: string): Promise<Payment> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID format');
    }

    const payment = await this.paymentModel
      .findById(id)
      .populate('orders')
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto
  ): Promise<Payment> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID format');
    }

    const payment = await this.paymentModel
      .findByIdAndUpdate(id, updatePaymentDto, { new: true })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID format');
    }

    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.paymentModel.findByIdAndDelete(id).exec();
  }
}
