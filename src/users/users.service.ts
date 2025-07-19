/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config/dist/config.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { genSaltSync, hashSync, compare, compareSync } from 'bcryptjs';
import { Injectable } from '@nestjs/common/decorators/core/injectable.decorator';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from './users.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private UserModel: SoftDeleteModel<UserDocument>,
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}
  gethashPassword = (password: string) => {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  };

  async create(CreateUserDto: CreateUserDto, user: IUser) {
    const { name, email, age, gender, address } = CreateUserDto;

    const hashPassword = this.gethashPassword(CreateUserDto.password);
    const existedUser = this.findUserbyName(CreateUserDto.email);
    if (await existedUser) {
      throw new BadRequestException('Email had existed ');
    } else {
      const newUser = await this.UserModel.create({
        name,
        email,
        password: hashPassword,
        age,
        gender,
        address,
        role: 'User',
        createdBy: user.email,
      });
      return newUser;
    }
  }

  async findAll() {
    return await this.UserModel.find().exec();
  }

  async findOneID(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    const user = await this.UserModel.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  findUserbyName(email: string) {
    return this.UserModel.findOne({ email: email });
  }
  async findUserByToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

      const user = await this.UserModel.findById(payload._id);
      if (!user || !user.refreshToken) {
        throw new UnauthorizedException(
          'Không tìm thấy người dùng hoặc chưa lưu refreshToken'
        );
      }

      const isMatch = compareSync(refreshToken, user.refreshToken);
      if (!isMatch) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      return user;
    } catch {
      throw new UnauthorizedException('Refresh token hết hạn hoặc sai');
    }
  }

  validatePassword(password: string, hash: string) {
    return compare(password, hash); // false
  }

  async update(id: string, updateUserDto: UpdateUserDto, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID');
    }

    const userUpdate = await this.UserModel.findByIdAndUpdate(
      id,
      {
        ...updateUserDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
      { new: true }
    );

    if (!userUpdate) {
      throw new NotFoundException('User not found');
    }

    return {
      updatedUser: userUpdate,
    };
  }

  async remove(id: string, user: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestException('can not found ID ');
    }
    await this.UserModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      }
    );
    return this.UserModel.softDelete({ _id: id });
  }

  async register(user: RegisterUserDto) {
    const { name, email, age, gender, address } = user;
    const isExisted = await this.findUserbyName(user.email);
    if (isExisted) {
      throw new BadRequestException(`This Email: ${user.email} is existed !`);
    }
    const hashPassword = this.gethashPassword(user.password);
    const newUser = await this.UserModel.create({
      name,
      email,
      password: hashPassword,
      age,
      gender,
      address,
    });
    return newUser;
  }

  async updateRefreshToken(_id: string, hashRefreshToken: string) {
    await this.UserModel.updateOne(
      {
        _id: _id,
      },
      { refreshToken: hashRefreshToken }
    ).exec();
  }
}
