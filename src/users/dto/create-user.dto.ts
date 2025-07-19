import { IsEmail, IsNotEmpty } from '@nestjs/class-validator';
import { Type } from 'class-transformer';
import {
  IsNotEmptyObject,
  IsObject,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import mongoose from 'mongoose';
export class Company {
  @IsNotEmpty()
  _id: mongoose.Schema.Types.ObjectId;

  @IsNotEmpty()
  name: string;
}
export class CreateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({
    message: 'Email must be a valid email address',
  })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  age: number;

  gender: string;

  @IsNotEmpty({ message: 'address is required' })
  address: string;

  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => Company)
  company: Company;

  @IsNotEmpty({ message: 'role is required' })
  role: string;
}
export class RegisterUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({
    message: 'Email must be a valid email address',
  })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @IsPositive({ message: 'age must be a positive number' })
  age: number;

  gender: string;

  @IsNotEmpty({ message: 'address is required' })
  address: string;
}
