import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CustomMessage,
  User,
  Permission,
  Public,
} from 'src/auth/decoration/setMetadata';
import { IUser } from './user.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseFilesPipe } from 'src/file/upload.validator';
import { PaginationResult, SearchUserDto } from './dto/user.dto';
import { PaginationResponseDto } from '../common/dto/pagination.dto';

// import { User } from '../decorate/setMetadata';
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @CustomMessage('Create new user')
  @Permission('user:create')
  @Post()
  create(@Body() createUserDto: CreateUserDto, @User() user: IUser) {
    return this.userService.createUser(createUserDto, user);
  }

  @Permission('user:findAll')
  @CustomMessage('Fetch List user with Paginate')
  @Get()
  async getUsers(
    @Query(new ValidationPipe({ transform: true })) query: SearchUserDto
  ): Promise<PaginationResponseDto<any>> {
    console.log('🔍 User Controller - Standardized query received:', query);
    
    // Handle backward compatibility with old qs parameter
    if (query.qs && !query.search) {
      console.log('🔍 Converting legacy qs parameter to search:', query.qs);
      // Parse legacy qs format: "name:search,email:search" -> "search"
      const qsParts = query.qs.split(',');
      const searchPart = qsParts.find(part => part.includes('search='));
      if (searchPart) {
        query.search = searchPart.split('=')[1];
      }
    }

    const result = await this.userService.searchUsers(query);

    console.log('✅ User Controller - Standardized result:', {
      totalUsers: result.meta.total,
      page: result.meta.page,
      limit: result.meta.limit,
      totalPages: result.meta.totalPages,
      usersReturned: result.data.length,
      firstUserRole: result.data[0]?.role,
    });

    return result;
  }

  @Permission('user:findOne')
  @CustomMessage('Fetch user by ID')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOneID(id);
  }
  @Public()
  @Get('count')
  async getUserCount() {
    const total = await this.userService.countUsers();
    return { total };
  }

  @Permission('user:update')
  @CustomMessage('Update user by ID')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @User() user: IUser
  ) {
    return this.userService.update(id, updateUserDto, user);
  }

  @Permission('user:remove')
  @CustomMessage('Delete user by ID')
  @Delete(':id')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.userService.remove(id, user);
  }

  @Patch(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(ParseFilesPipe) file: Express.Multer.File
  ) {
    return this.userService.update(id, { avatar: file.filename }, undefined);
  }
}
