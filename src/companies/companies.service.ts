/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company, CompanyDocument } from './schemas/company.schemas';
import { InjectModel } from '@nestjs/mongoose/dist/common/mongoose.decorators';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import mongoose from 'mongoose';
import { IUser } from 'src/users/users.interface';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private CompanyModel: SoftDeleteModel<CompanyDocument>
  ) {}
  async create(createCompanyDto: CreateCompanyDto, user: IUser) {
    const existedCompany = this.findCompanybyEmail(createCompanyDto.email);
    if (await existedCompany) {
      throw new BadRequestException('Company email had existed');
    } else {
      const companydata = await this.CompanyModel.create({
        ...createCompanyDto,
        createdBy: {
          _id: user._id,
          email: user.email,
        },
      });
      return companydata;
    }
  }

  //find with numberpage and limit with query
  async findAll(currentPage: number, limit: number, qs: string = '') {
    // Xử lý input
    const page = Math.max(1, currentPage); // Đảm bảo page không âm
    const defaultLimit = Math.max(1, Math.min(+limit || 10, 100)); // Giới hạn 1-100, mặc định 10

    // Tính offset
    const offset = (page - 1) * defaultLimit;

    // Phân tích qs thành filter
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const filter = this.parseQuery(qs);

    // Tính tổng số mục
    const totalItems = await this.CompanyModel.countDocuments(filter);

    // Thực thi truy vấn
    const result = await this.CompanyModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .exec();

    const totalPages = Math.ceil(totalItems / defaultLimit);

    return {
      results: result,
      meta: {
        total: totalItems,
        page,
        limit: defaultLimit,
        totalPages,
      },
    };
  }

  // Hàm phân tích qs chỉ cho bộ lọc
  private parseQuery(qs: string) {
    const filter: any = {};

    if (qs) {
      const conditions = qs.split(',').map((part) => part.trim().split(':'));
      conditions.forEach(([key, value]) => {
        if (key && value) {
          // Chỉ xử lý bộ lọc, bỏ qua sort
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          filter[key] = { $regex: value, $options: 'i' }; // Không phân biệt hoa thường
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return filter;
  }


  async findOne(id: string) {
    if (!mongoose.Types.ObjectId) {
      throw new BadRequestException('Invalid ID format');
    }
    const company = await this.CompanyModel.findById(id);
    if (!company) {
      throw new BadRequestException('cannot found this company ID');
    }
    return company;
  }

  update(id: string, updateCompanyDto: UpdateCompanyDto, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('can not found ID ');
    }
    return this.CompanyModel.findByIdAndUpdate(id, {
      ...updateCompanyDto,
      Updateby: {
        _id: user._id,
        email: user.email,
      },
    });
  }

  findCompanybyEmail(email: string) {
    return this.CompanyModel.findOne({ email: email });
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('can not found ID ');
    }
    await this.CompanyModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          _email: user.email,
        },
      }
    );
    return this.CompanyModel.softDelete({ _id: id });
  }
}
