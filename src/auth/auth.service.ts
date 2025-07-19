import { ConfigService } from '@nestjs/config/dist/config.service';
import { RegisterUserDto } from './../users/dto/create-user.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { IUser } from 'src/users/users.interface';
import { genSaltSync, hashSync } from 'bcryptjs';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findUserbyName(username);
    if (user) {
      const valid = this.usersService.validatePassword(pass, user.password);
      if ((await valid) === true) {
        return user;
      }
    }
    return null;
  }

  async login(user: IUser, response: Response) {
    const { _id, name, email, role } = user;
    const payload = {
      _id,
      name,
      email,
      role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN'),
    });
    const salt = genSaltSync(10);
    const hash = hashSync(refreshToken, salt);
    const hashedRefreshToken = hash;
    await this.usersService.updateRefreshToken(_id, hashedRefreshToken);
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      access_token: accessToken,
      user: {
        _id,
        name,
        email,
        role,
      },
    };
  }

  refreshTokens = async (refreshToken: string, res: Response) => {
    try {
      // Xác thực refresh token
      this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });
      // Tìm user tương ứng với refresh token
      const user = await this.usersService.findUserByToken(refreshToken);
      if (!user) {
        throw new BadRequestException('Invalid refresh token');
      }

      const { _id, name, email, role } = user;
      const payload = { _id, name, email, role };

      // Tạo access token mới
      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_TOKEN_EXPIRES_IN'
        ),
      });

      // Tạo refresh token mới
      const newRefreshToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_TOKEN_EXPIRES_IN'
        ),
      });

      // Băm refresh token và lưu lại
      const salt = genSaltSync(10);
      const hashedRefreshToken = hashSync(newRefreshToken, salt);
      await this.usersService.updateRefreshToken(
        _id.toString(),
        hashedRefreshToken
      );

      // Gửi refresh token qua cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      });

      return { accessToken: accessToken };
    } catch {
      throw new BadRequestException(
        'Refresh token hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'
      );
    }
  };

  async register(user: RegisterUserDto) {
    const newUser = await this.usersService.register(user);
    return {
      _id: newUser?._id,
      createdAt: newUser?.createdAt, // ✅ đúng chính tả
    };
  }

  async logoutToken(res: Response, user: IUser) {
    // Xóa refresh token đã hash trong DB
    await this.usersService.updateRefreshToken(user._id.toString(), '');

    // Xóa cookie phía client
    res.clearCookie('refreshToken');
  }
}
