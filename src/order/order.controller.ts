import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { Permission, Public } from '../auth/decoration/setMetadata';
import { OrderService } from './order.service';
import { CreateOrderDto, CreateOnlineOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import { MarkOrderPaidDto } from './dto/update-order.dto';
import { OrderStatus } from './schemas/order.schema';
import { OrderQueryDto } from './dto/order-query.dto';
import { PaginationResponseDto } from '../common/dto/pagination.dto';
import { ValidationPipe } from '@nestjs/common';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Permission('order:create')
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @Post('online')
  @Public()
  createOnlineOrder(@Body() createOnlineOrderDto: CreateOnlineOrderDto) {
    return this.orderService.createOnlineOrder(createOnlineOrderDto);
  }
  @Get('count')
  async countOrders() {
    const total = await this.orderService.countOrders();
    return { total };
  }
  @Permission('order:findAll')
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: OrderQueryDto
  ): Promise<PaginationResponseDto<any>> {
    
    return this.orderService.findAll(
      query.page,
      query.limit,
      query.search,
      query.status,
      query.guest,
      query.user,
      query.sortBy,
      query.sortOrder
    );
  }

  @Permission('order:findByGuest')
  @Get('guest')
  findByGuest(@Query('guestId') guestId: string) {
    return this.orderService.findByGuest(guestId);
  }

  @Permission('order:findByUser')
  @Get('user')
  findByUser(@Query('userId') userId: string) {
    return this.orderService.findByUser(userId);
  }

  @Permission('order:findOne')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Permission('order:updateStatus')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto
  ) {
   
    const normalizedStatus = updateOrderStatusDto.status.trim().toLowerCase();

    // Đảm bảo status được gửi đúng format
    const statusToUpdate = normalizedStatus as
      | 'pending'
      | 'preparing'
      | 'served'
      | 'cancelled';

    return this.orderService.updateStatus(id, statusToUpdate as OrderStatus);
  }

  @Permission('order:markAsPaid')
  @Patch(':id/paid')
  markAsPaid(
    @Param('id') id: string,
    @Body() markOrderPaidDto: MarkOrderPaidDto
  ) {
    return this.orderService.markAsPaid(id, markOrderPaidDto);
  }

  @Permission('order:remove')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(id);
  }

}
