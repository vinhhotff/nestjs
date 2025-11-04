import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Loyalty } from './schemas/loyalty.schema';
import { CreateLoyaltyDto, AddPointsDto, RedeemPointsDto } from './dto/create-loyalty.dto';
import { User } from '../user/schemas/user.schema';
import { Guest } from '../guest/schemas/guest.schema';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectModel(Loyalty.name) private loyaltyModel: Model<Loyalty>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Guest.name) private guestModel: Model<Guest>,
  ) {}

  async createLoyaltyAccount(createLoyaltyDto: CreateLoyaltyDto): Promise<Loyalty> {
    const existingAccount = await this.loyaltyModel.findOne({ user: createLoyaltyDto.user }).exec();
    if (existingAccount) {
      throw new BadRequestException('Tài khoản loyalty đã tồn tại cho user này');
    }

    const loyalty = new this.loyaltyModel({
      ...createLoyaltyDto,
      points: createLoyaltyDto.points || 0,
    });
    return loyalty.save();
  }

  async findByUserId(userId: string): Promise<Loyalty> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID user không hợp lệ');
    }

    // Ưu tiên bản ghi theo user
    let loyalty = await this.loyaltyModel.findOne({ user: userId }).exec();

    // Nếu tồn tại cả 2 (user đúng và guest sai), hợp nhất vào user
    const wrongGuestDup = await this.loyaltyModel.findOne({ guest: userId }).exec();
    if (loyalty && wrongGuestDup) {
      loyalty.points += wrongGuestDup.points;
      await loyalty.save();
      await this.loyaltyModel.deleteOne({ _id: wrongGuestDup._id });
    }

    // Nếu chưa có, nhưng lại tồn tại bản ghi guest dùng userId (sai), thì chuyển sang user
    if (!loyalty && wrongGuestDup) {
      wrongGuestDup.user = new Types.ObjectId(userId) as any;
      (wrongGuestDup as any).guest = undefined;
      await wrongGuestDup.save();
      loyalty = await this.loyaltyModel.findOne({ user: userId }).exec();
    }

    // Nếu vẫn chưa có thì tạo mới đúng theo user
    if (!loyalty) {
      loyalty = new this.loyaltyModel({ user: userId, points: 0 });
      await loyalty.save();
      loyalty = await this.loyaltyModel.findOne({ user: userId }).exec();
    }

    if (!loyalty) {
      throw new NotFoundException('Không thể tạo tài khoản loyalty');
    }

    const populated = await this.loyaltyModel
      .findById(loyalty._id)
      .populate('user', 'name email')
      .exec();

    if (!populated) {
      throw new NotFoundException('Loyalty not found');
    }

    return populated as any;
  }

  async findAll(): Promise<Loyalty[]> {
    return this.loyaltyModel.find().populate('user', 'name email').exec();
  }

  async findByGuestId(guestId: string): Promise<Loyalty> {
    if (!Types.ObjectId.isValid(guestId)) {
      throw new BadRequestException('ID guest không hợp lệ');
    }

    let loyalty = await this.loyaltyModel.findOne({ guest: guestId }).exec();
    if (!loyalty) {
      loyalty = new this.loyaltyModel({ guest: guestId, points: 0 });
      await loyalty.save();
    }

    return loyalty;
  }

  async addPoints(userId: string, addPointsDto: AddPointsDto): Promise<Loyalty> {
    const loyalty = await this.findByUserId(userId);
    loyalty.points += addPointsDto.points;
    return loyalty.save();
  }

  async redeemPoints(userId: string, redeemPointsDto: RedeemPointsDto): Promise<Loyalty> {
    const loyalty = await this.findByUserId(userId);
    
    if (loyalty.points < redeemPointsDto.points) {
      throw new BadRequestException('Số điểm không đủ để quy đổi');
    }

    loyalty.points -= redeemPointsDto.points;
    return loyalty.save();
  }

  async calculatePointsFromOrder(orderAmount: number) {
    // Quy tắc: 1000 VND = 1 điểm
    return Math.floor(orderAmount / 1000);
  }

  async autoAddPointsFromOrder(userOrGuestId: string, orderAmount: number): Promise<Loyalty> {
    if (!Types.ObjectId.isValid(userOrGuestId)) {
      throw new BadRequestException('ID không hợp lệ để cộng điểm loyalty');
    }

    const points = await this.calculatePointsFromOrder(orderAmount);

    const loyaltyByUser = await this.loyaltyModel.findOne({ user: userOrGuestId }).exec();
    const loyaltyByGuest = await this.loyaltyModel.findOne({ guest: userOrGuestId }).exec();

    let loyalty = loyaltyByUser || loyaltyByGuest;

    // Khắc phục các bản ghi sai trước đây lưu id dưới dạng chuỗi JSON
    if (!loyalty) {
      const escapedId = userOrGuestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedId, 'i');
      const corruptedRecord = await this.loyaltyModel
        .findOne({
          $or: [
            { guest: { $type: 'string', $regex: regex } as any },
            { user: { $type: 'string', $regex: regex } as any },
          ],
        })
        .exec();

      if (corruptedRecord) {
        corruptedRecord.user = new Types.ObjectId(userOrGuestId) as any;
        (corruptedRecord as any).guest = undefined;
        await corruptedRecord.save();
        loyalty = corruptedRecord;
      }
    }

    // Nếu cả hai tồn tại (trường hợp sai trước đó), hợp nhất về user
    if (loyaltyByUser && loyaltyByGuest && loyaltyByUser._id.toString() !== loyaltyByGuest._id.toString()) {
      loyaltyByUser.points += loyaltyByGuest.points;
      await loyaltyByUser.save();
      await this.loyaltyModel.deleteOne({ _id: loyaltyByGuest._id });
      loyalty = loyaltyByUser;
    }

    if (!loyalty) {
      // Xác định id thuộc user hay guest để khởi tạo đúng
      const isUser = Types.ObjectId.isValid(userOrGuestId) && !!(await this.userModel.exists({ _id: userOrGuestId }));
      const isGuest = !isUser && Types.ObjectId.isValid(userOrGuestId) && !!(await this.guestModel.exists({ _id: userOrGuestId }));
      if (isUser) {
        loyalty = new this.loyaltyModel({ user: userOrGuestId, points: 0 });
      } else if (isGuest) {
        loyalty = new this.loyaltyModel({ guest: userOrGuestId, points: 0 });
      } else {
        // Mặc định ưu tiên user để tránh tạo sai bản ghi guest bằng userId
        loyalty = new this.loyaltyModel({ user: userOrGuestId, points: 0 });
      }
    }

    loyalty.points += points;
    return loyalty.save();
  }

  async getPointsHistory(userId: string): Promise<any[]> {
    // Có thể mở rộng để lưu lịch sử tích điểm
    // Hiện tại chỉ trả về thông tin cơ bản
    const loyalty = await this.findByUserId(userId);
    return [
      {
        type: 'current_balance',
        points: loyalty.points,
        date: loyalty.createdAt,
      }
    ];
  }
}
