import { IsNotEmpty } from '@nestjs/class-validator';

export class CreateCompanyDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  name: string;
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address: string;
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  description: string;
}
