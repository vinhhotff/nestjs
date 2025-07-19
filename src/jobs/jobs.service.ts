/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Job, JobDocument } from './schemas/job.schemas';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/users/users.interface';
import mongoose from 'mongoose';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name)
    private JobModel: SoftDeleteModel<JobDocument>
  ) {}
  async create(createJobDto: CreateJobDto, user: IUser) {
    const jobData = await this.JobModel.create({
      ...createJobDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return jobData;
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
    const totalItems = await this.JobModel.countDocuments(filter);

    // Thực thi truy vấn
    const result = await this.JobModel.find(filter)
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
          filter[key] = { $regex: value, $options: 'i' }; // Không phân biệt hoa thường
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return filter;
  }

  async findOne(id: number) {
    const jobData = await this.JobModel.findById(id);
    if (!jobData) {
      throw new BadRequestException('Job don"t exsited');
    }
    return jobData;
  }

  async update(id: string, updateJobDto: UpdateJobDto, user: IUser) {
    const jobData = await this.JobModel.findById(id);
    if (!jobData) {
      throw new BadRequestException('Job don"t exsited');
    }
    return this.JobModel.findByIdAndUpdate(
      id,
      {
        ...updateJobDto,
        UpdatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
      { new: true }
    );
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId) {
      throw new BadRequestException('Invalid ID');
    }
    const existedId = await this.JobModel.findById(id);
    if (!existedId) {
      throw new BadRequestException(' Cannot find this Job ');
    }
    this.JobModel.updateOne(
      { _id: id },
      {
        DeletedBy: {
          _id: user._id,
          email: user.email,
        },
      }
    );
    return this.JobModel.softDelete({ _id: id });
  }
}
