import { IUser } from './../users/users.interface';
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Body,
  Res,
  Req,
} from '@nestjs/common';
import { CustomMessage, Public, User } from './decoration/metadata';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import { Response, Request as RequestExpress } from 'express';
// import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //Register User
  @Public()
  @CustomMessage('Register a new User')
  @Post('/register')
  handleRegister(@Body() registerUser: RegisterUserDto) {
    return this.authService.register(registerUser);
  }
  //Login
  @Public()
  @UseGuards(LocalAuthGuard)
  @CustomMessage('Login a User')
  @Post('/login')
  handleLogin(@Request() req, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(req.user, res);
  }
  //get refresh token
  @Public()
  @Post('refresh')
  @CustomMessage('refresh success')
  refresh(
    @Req() request: RequestExpress,
    @Res({ passthrough: true }) res: Response
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const refreshToken = request.cookies?.['refreshToken'];
    if (!refreshToken) {
      return { message: 'No refresh token provided' };
    }
    // Use refreshToken in your logic, e.g.:
    return this.authService.refreshTokens(refreshToken, res);
  }
  // @UseGuards(JwtAuthGuard)
  @Get('profile')
  @CustomMessage('Get a profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('logout')
  @CustomMessage('Logout user successfully')
  async handleLogout(
    @Res({ passthrough: true }) res: Response,
    @User() user: IUser
  ) {
    await this.authService.logoutToken(res, user);
    return 'ok';
  }
}
