import { IsEmail, IsMongoId, IsOptional, IsUrl, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResumeDto {
  @IsEmail()
  email: string;

  @IsMongoId()
  userId: string;

  @IsUrl()
  url: string;

  @IsEnum(['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED'])
  @IsOptional()
  status?: string = 'PENDING';

  @IsMongoId()
  companyId: string;

  @IsMongoId()
  jobId: string;

  // Nếu bạn muốn lưu lịch sử ngay khi tạo
  @IsOptional()
  @Type(() => ResumeHistoryDto)
  history?: ResumeHistoryDto[];

  // Chỉ dùng nội bộ - nếu bạn để client truyền cũng được
  @IsOptional()
  @Type(() => SimpleUserDto)
  createdBy?: SimpleUserDto;
}

class ResumeHistoryDto {
  @IsEnum(['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED'])
  status: string;

  @Type(() => Date)
  updatedAt: Date;

  @Type(() => SimpleUserDto)
  updatedBy: SimpleUserDto;
}

class SimpleUserDto {
  @IsMongoId()
  _id: string;

  @IsEmail()
  email: string;
}
