import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reservation, ReservationStatus } from './schemas/reservation.schema';
import { CreateReservationDto, UpdateReservationStatusDto } from './dto/create-reservation.dto';
import { IUser } from '../user/user.interface';

@Injectable()
export class ReservationService {
  constructor(
    @InjectModel(Reservation.name) private reservationModel: Model<Reservation>,
  ) {}

  async create(createReservationDto: CreateReservationDto, user?: IUser): Promise<Reservation> {
    const reservationDate = new Date(createReservationDto.reservationDate);
    
    // Kiểm tra ngày đặt bàn không được trong quá khứ
    if (reservationDate < new Date()) {
      throw new BadRequestException('Ngày đặt bàn không thể trong quá khứ');
    }

    // Kiểm tra xem có đặt trùng giờ không (có thể mở rộng logic này)
    const existingReservation = await this.reservationModel
      .findOne({
        customerPhone: createReservationDto.customerPhone,
        reservationDate: {
          $gte: new Date(reservationDate.getTime() - 2 * 60 * 60 * 1000), // 2 giờ trước
          $lte: new Date(reservationDate.getTime() + 2 * 60 * 60 * 1000), // 2 giờ sau
        },
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] }
      })
      .exec();

    if (existingReservation) {
      throw new ConflictException('Bạn đã có đặt bàn trong khoảng thời gian này');
    }

    const reservation = new this.reservationModel({
      ...createReservationDto,
      user: user?._id,
      reservationDate,
    });

    return reservation.save();
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: ReservationStatus,
    date?: string
  ): Promise<{ reservations: Reservation[]; total: number; totalPages: number }> {
    const filter: any = {};
    
    if (status) filter.status = status;
    if (date) {
      const searchDate = new Date(date);
      filter.reservationDate = {
        $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
        $lt: new Date(searchDate.setHours(23, 59, 59, 999)),
      };
    }

    const skip = (page - 1) * limit;
    const total = await this.reservationModel.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const reservations = await this.reservationModel
      .find(filter)
      .populate('user', 'name email')
      .sort({ reservationDate: 1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return { reservations, total, totalPages };
  }

  async findById(id: string): Promise<Reservation> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đặt bàn không hợp lệ');
    }

    const reservation = await this.reservationModel
      .findById(id)
      .populate('user', 'name email')
      .exec();

    if (!reservation) {
      throw new NotFoundException('Không tìm thấy đặt bàn');
    }

    return reservation;
  }

  async findByUser(userId: string): Promise<Reservation[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID user không hợp lệ');
    }

    return this.reservationModel
      .find({ user: userId })
      .sort({ reservationDate: -1 })
      .exec();
  }

  async findByPhone(phone: string): Promise<Reservation[]> {
    return this.reservationModel
      .find({ customerPhone: phone })
      .populate('user', 'name email')
      .sort({ reservationDate: -1 })
      .exec();
  }

  async updateStatus(id: string, updateStatusDto: UpdateReservationStatusDto): Promise<Reservation> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID đặt bàn không hợp lệ');
    }

    const reservation = await this.reservationModel
      .findByIdAndUpdate(id, updateStatusDto, { new: true })
      .populate('user', 'name email')
      .exec();

    if (!reservation) {
      throw new NotFoundException('Không tìm thấy đặt bàn');
    }

    return reservation;
  }

  async cancel(id: string, userId?: string): Promise<Reservation> {
    const reservation = await this.findById(id);

    // Kiểm tra quyền hủy (chỉ user tạo hoặc admin mới được hủy)
    if (userId && reservation.user && reservation.user.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền hủy đặt bàn này');
    }

    // Chỉ có thể hủy khi còn pending hoặc confirmed
    if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
      throw new BadRequestException('Không thể hủy đặt bàn với trạng thái hiện tại');
    }

    return this.updateStatus(id, { status: ReservationStatus.CANCELLED });
  }

  async getTodayReservations(): Promise<Reservation[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    return this.reservationModel
      .find({
        reservationDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] }
      })
      .populate('user', 'name email')
      .sort({ reservationDate: 1 })
      .exec();
  }

  async getUpcomingReservations(days: number = 7): Promise<Reservation[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.reservationModel
      .find({
        reservationDate: { $gte: now, $lte: futureDate },
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] }
      })
      .populate('user', 'name email')
      .sort({ reservationDate: 1 })
      .exec();
  }

  async getReservationStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }> {
    const [stats] = await this.reservationModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', ReservationStatus.PENDING] }, 1, 0] }
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', ReservationStatus.CONFIRMED] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', ReservationStatus.COMPLETED] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', ReservationStatus.CANCELLED] }, 1, 0] }
          }
        }
      }
    ]);

    return stats || {
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
  }
}
