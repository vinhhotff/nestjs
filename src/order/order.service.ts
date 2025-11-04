import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderStatus,
  OrderType,
} from './schemas/order.schema';
import { CreateOrderDto, CreateOnlineOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import { MenuItem } from '../menu-item/schemas/menu-item.schema';
import { Guest } from '../guest/schemas/guest.schema';
import { User } from '../user/schemas/user.schema';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MarkOrderPaidDto } from './dto/update-order.dto';
import { DeliveryService } from '../delivery/delivery.service';
import { 
  PaginationResponseDto, 
  buildSortObject, 
  buildSearchFilter 
} from '../common/dto/pagination.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(Guest.name) private guestModel: Model<Guest>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly loyaltyService: LoyaltyService,
    private readonly deliveryService: DeliveryService
  ) { }

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

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { items, guest, user } = createOrderDto;

    // Validate that only one of guest or user is provided
    if ((guest && user) || (!guest && !user)) {
      throw new BadRequestException(
        'Must provide either guest or user, not both or neither'
      );
    }

    // Validate guest or user exists
    if (guest) {
      const guestExists = await this.guestModel.findById(guest).exec();
      if (!guestExists) {
        throw new NotFoundException('Guest not found');
      }
    }

    if (user) {
      const userExists = await this.userModel.findById(user).exec();
      if (!userExists) {
        throw new NotFoundException('User not found');
      }
    }

    // Validate menu items and calculate total price
    let totalPrice = 0;
    const validatedItems: {
      item: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const orderItem of items) {
      const menuItem = await this.menuItemModel.findById(orderItem.item).exec();
      if (!menuItem) {
        throw new NotFoundException(
          `Menu item with ID ${orderItem.item} not found`
        );
      }
      if (!menuItem.available) {
        throw new BadRequestException(
          `Menu item '${menuItem.name}' is not available`
        );
      }

      const unitPrice = menuItem.price;
      const subtotal = unitPrice * orderItem.quantity;
      validatedItems.push({
        item: orderItem.item,
        quantity: orderItem.quantity,
        unitPrice,
        subtotal,
      });

      totalPrice += subtotal;
    }

    const order = new this.orderModel({
      ...createOrderDto,
      items: validatedItems,
      totalPrice,
      status: OrderStatus.PENDING,
    });

    const savedOrder = await order.save();

    // Update guest's orders array
    if (guest) {
      await this.guestModel
        .findByIdAndUpdate(
          guest,
          { $push: { orders: savedOrder._id } },
          { new: true }
        )
        .exec();
    }

    return savedOrder;
  }

  async createOnlineOrder(
    createOnlineOrderDto: CreateOnlineOrderDto
  ): Promise<Order> {
    const {
      items,
      user,
      customerName,
      customerPhone,
      orderType,
      deliveryAddress,
      specialInstructions,
    } = createOnlineOrderDto;

    if (orderType === OrderType.DELIVERY && !deliveryAddress) {
      throw new BadRequestException(
        'Delivery address is required for delivery orders'
      );
    }

    // Resolve customer info based on user/guest
    let resolvedName = customerName;
    let resolvedPhone = customerPhone;

    if (user) {
      if (!Types.ObjectId.isValid(user)) {
        throw new BadRequestException('Invalid user ID format');
      }
      const userDoc = await this.userModel.findById(user).exec();
      if (!userDoc) {
        throw new NotFoundException('User not found');
      }
      resolvedName = resolvedName || userDoc.name || 'Guest';
      resolvedPhone = resolvedPhone || userDoc.phone || '';
    } else {
      // Guest checkout must provide name and phone
      if (!customerName || !customerPhone) {
        throw new BadRequestException('customerName and customerPhone are required for guest orders');
      }
    }

    // Validate menu items and calculate total price
    let totalPrice = 0;
    const validatedItems: {
      item: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }[] = [];

    for (const orderItem of items) {
      if (!Types.ObjectId.isValid(orderItem.item)) {
        throw new BadRequestException('Invalid menu item ID format');
      }
      const menuItem = await this.menuItemModel.findById(orderItem.item).exec();
      if (!menuItem) {
        throw new NotFoundException(
          `Menu item with ID ${orderItem.item} not found`
        );
      }
      if (!menuItem.available) {
        throw new BadRequestException(
          `Menu item '${menuItem.name}' is not available`
        );
      }

      const unitPrice = menuItem.price;
      const subtotal = unitPrice * orderItem.quantity;
      validatedItems.push({
        item: orderItem.item,
        quantity: orderItem.quantity,
        unitPrice,
        subtotal,
      });

      totalPrice += subtotal;
    }

    const orderData: any = {
      items: validatedItems,
      totalPrice,
      status: OrderStatus.PENDING,
      orderType,
      specialInstructions,
      customerName: resolvedName,
      customerPhone: resolvedPhone,
      deliveryAddress:
        orderType === OrderType.DELIVERY ? deliveryAddress : undefined,
      user: user ? user : undefined,
    };

    const order = new this.orderModel(orderData);
    const savedOrder = await order.save();

    if (orderType === OrderType.DELIVERY) {
      await this.deliveryService.create({
        order: savedOrder._id,
        customerName: resolvedName!,
        customerPhone: resolvedPhone!,
        deliveryAddress: deliveryAddress!,
      });
    }

    return savedOrder;
  }

  async countOrders(): Promise<number> {
    return this.orderModel.countDocuments();
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: OrderStatus,
    guest?: string,
    user?: string,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<PaginationResponseDto<Order>> {
    // Build filter object
    let filter: any = {};
    
    // Handle search parameter
    if (search && search.trim()) {
      // Search in guest table code or customer info
      const searchFilter = {
        $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { customerPhone: { $regex: search, $options: 'i' } },
        ]
      };
      filter = { ...filter, ...searchFilter };
    }
    
    if (status) filter.status = status;
    if (guest) filter.guest = guest;
    if (user) filter.user = user;

    console.log('🔍 Order findAll - Filter applied:', filter);

    // Create sort object
    const sort = buildSortObject(sortBy, sortOrder);
    console.log('🔍 Order findAll - Sort applied:', sort);

    const skip = (page - 1) * limit;
    const total = await this.orderModel.countDocuments(filter);

    const orders = await this.orderModel
      .find(filter)
      .populate('items.item', 'name price category images')
      .populate('guest', 'tableCode')
      .populate('user', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    console.log(`✅ Order findAll - Found ${orders.length} orders on page ${page}`);

    return new PaginationResponseDto(orders, total, page, limit);
  }

  async findById(id: string): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel
      .findById(id)
      .populate('items.item', 'name price category images')
      .populate('guest', 'tableCode')
      .populate('user', 'name email')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByGuest(guestId: string): Promise<Order[]> {
    if (!guestId) {
      throw new BadRequestException('Guest ID is required');
    }
    
    if (!Types.ObjectId.isValid(guestId)) {
      throw new BadRequestException('Invalid guest ID format');
    }

    return this.orderModel
      .find({ guest: guestId })
      .populate('items.item', 'name price category images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<Order[]> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    return this.orderModel
      .find({ user: userId })
      .populate('items.item', 'name price category images')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    // Debug logging
    console.log('🔍 Backend received status update:', {
      orderId: id,
      receivedStatus: status,
      statusType: typeof status,
      validStatuses: Object.values(OrderStatus),
      isStatusValid: Object.values(OrderStatus).includes(status)
    });

    if (!Object.values(OrderStatus).includes(status)) {
      console.error('❌ Status validation failed:', {
        received: status,
        expected: Object.values(OrderStatus),
        comparison: Object.values(OrderStatus).map(s => ({ value: s, matches: s === status }))
      });
      throw new BadRequestException('Invalid order status');
    }

    const order = await this.orderModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('items.item', 'name price category images')
      .populate('guest', 'tableCode')
      .populate('user', 'name email')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Tự động cộng điểm loyalty khi đơn hàng hoàn thành (served) và đã thanh toán
    if (status === OrderStatus.SERVED) {
      if (order.isPaid && !order.loyaltyAwarded) {
        const loyaltyTargetId =
          this.extractEntityId(order.user) ?? this.extractEntityId(order.guest);
        if (loyaltyTargetId) {
          try {
            await this.loyaltyService.autoAddPointsFromOrder(
              loyaltyTargetId,
              order.totalPrice
            );
            // đánh dấu đã cộng điểm
            order.loyaltyAwarded = true;
            await order.save();
          } catch (error) {
            console.error('Lỗi khi cộng điểm loyalty:', error);
            // Không throw để không ảnh hưởng đến việc cập nhật status
          }
        } else {
          console.warn(
            'Không xác định được ID để cộng điểm loyalty cho order khi cập nhật trạng thái',
            order._id.toString()
          );
        }
      }
    }

    return order;
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderStatusDto
  ): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const existingOrder = await this.orderModel.findById(id).exec();
    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    // Don't allow updates if order is already served or cancelled
    if (
      existingOrder.status === OrderStatus.SERVED ||
      existingOrder.status === OrderStatus.CANCELLED
    ) {
      throw new ForbiddenException(
        `Cannot update order with status: ${existingOrder.status}`
      );
    }

    const order = await this.orderModel
      .findByIdAndUpdate(id, updateOrderDto, { new: true })
      .populate('items.item', 'name price category images')
      .populate('guest', 'tableCode')
      .populate('user', 'name email')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancel(id: string): Promise<Order> {
    return this.updateStatus(id, OrderStatus.CANCELLED);
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Remove order from guest's orders array
    if (order.guest) {
      await this.guestModel
        .findByIdAndUpdate(
          order.guest,
          { $pull: { orders: id } },
          { new: true }
        )
        .exec();
    }

    await this.orderModel.findByIdAndDelete(id).exec();
  }

  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    preparing: number;
    served: number;
    cancelled: number;
    totalRevenue: number;
  }> {
    const [stats] = await this.orderModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.PENDING] }, 1, 0] },
          },
          preparing: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.PREPARING] }, 1, 0],
            },
          },
          served: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.SERVED] }, 1, 0] },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0],
            },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', OrderStatus.SERVED] },
                '$totalPrice',
                0,
              ],
            },
          },
        },
      },
    ]);

    return (
      stats || {
        total: 0,
        pending: 0,
        preparing: 0,
        served: 0,
        cancelled: 0,
        totalRevenue: 0,
      }
    );
  }

  async findOrdersInPeriod(start: Date, end: Date): Promise<Order[]> {
    return this.orderModel
      .find({
        createdAt: {
          $gte: start,
          $lte: end,
        },
      })
      .exec();
  }

  async markAsPaid(
    id: string,
    markOrderPaidDto: MarkOrderPaidDto
  ): Promise<Order> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel
      .findByIdAndUpdate(
        id, 
        { isPaid: markOrderPaidDto.isPaid },
        { new: true }
      )
      .populate('items.item', 'name price category images')
      .populate('guest', 'tableCode')
      .populate('user', 'name email')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Nếu đã served và giờ đánh dấu paid, thì cộng điểm nếu chưa cộng
    if (order.isPaid && order.status === OrderStatus.SERVED && !order.loyaltyAwarded) {
      const loyaltyTargetId =
        this.extractEntityId(order.user) ?? this.extractEntityId(order.guest);
      if (loyaltyTargetId) {
        try {
          await this.loyaltyService.autoAddPointsFromOrder(loyaltyTargetId, order.totalPrice);
          order.loyaltyAwarded = true;
          await order.save();
        } catch (error) {
          console.error('Lỗi khi cộng điểm loyalty khi markAsPaid:', error);
        }
      } else {
        console.warn(
          'Không xác định được ID để cộng điểm loyalty cho order khi markAsPaid',
          order._id.toString()
        );
      }
    }

    return order;
  }
}
