import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { OrderType } from '../schemas/order.schema';

class OrderItemDto {
  @IsMongoId()
  @IsNotEmpty()
  item: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[];

  @IsMongoId()
  @IsOptional()
  guest?: string;

  @IsMongoId()
  @IsOptional()
  user?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsMongoId()
  @IsOptional()
  table?: string;
}

export class CreateOnlineOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[];

  @ValidateIf((o) => !o.user)
  @IsString()
  @IsNotEmpty()
  customerName?: string;

  @ValidateIf((o) => !o.user)
  @IsString()
  @IsNotEmpty()
  customerPhone?: string;

  @IsEnum(OrderType)
  @IsNotEmpty()
  orderType: OrderType;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsMongoId()
  @IsOptional()
  user?: string; // If logged-in user
}
