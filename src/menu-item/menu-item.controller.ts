import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  UseInterceptors,
  UploadedFiles,
  Req,
  UseGuards,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import {
  CustomMessage,
  Permission,
  Public,
} from '../auth/decoration/setMetadata';
import { MenuItemService } from './menu-item.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IUser } from 'src/user/user.interface';
import { ParseFilesPipe } from 'src/file/upload.validator';
import { PermissionGuard } from 'src/permission/permission.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('menu-items')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MenuItemController {
  constructor(private readonly menuItemService: MenuItemService) { }

  @Permission('menuItem:create')
  @Post()
  @UseInterceptors(FilesInterceptor('images', 5)) // tối đa 5 ảnh
  async create(
    @UploadedFiles(ParseFilesPipe) files: Express.Multer.File[],
    @Body() createMenuItemDto: CreateMenuItemDto,
    @Req() req: { user: IUser },
  ) {
    const imageNames = files.map((f) => f.filename);

    // truyền xuống service để lưu DB
    return this.menuItemService.create(
      { ...createMenuItemDto, images: imageNames },
      req.user,
      files,
    );
  }
  @Public()
  @CustomMessage('Fetch List MenuItem')
  @Get()
  findAll() {
    return this.menuItemService.findAll();
  }

  @Public()
  @CustomMessage('Get total number of MenuItems')
  @Get('count')
  async getMenuItemCount() {
    const total = await this.menuItemService.countMenuItems();
    return { total };
  }

  @Public()
  @CustomMessage('Fetch List MenuItem with Paginate')
  @Get('paginate')
  async findPaginate(
    @Query('page') currentPage: string = '1', // Default to page 1
    @Query('limit') limit: string = '10', // Default to 10 items per page
    @Query('qs') qs: string = '' // Default to empty query string
  ) {
    return this.menuItemService.findPaginate(+currentPage, +limit, qs);
  }

  @Permission('menuItem:getCategories')
  @Get('categories')
  getCategories() {
    return this.menuItemService.getCategories();
  }

  @Permission('menuItem:findByCategory')
  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.menuItemService.findByCategory(category);
  }

  @Permission('menuItem:findOne')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menuItemService.findById(id);
  }

  @Permission('menuItem:update')
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', 10)) // cho phép upload tối đa 10 file
  async update(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
    @UploadedFiles() files: Express.Multer.File[], // nhận file ảnh
    @Req() req: { user: IUser }
  ) {
    // nếu có file thì map thành mảng ObjectId (sau khi lưu ở service)
    return this.menuItemService.update(id, updateMenuItemDto, req.user, files);
  }

  @Permission('menuItem:updateAvailability')
  @Put(':id/availability')
  updateAvailability(
    @Param('id') id: string,
    @Body('available') available: boolean
  ) {
    return this.menuItemService.updateAvailability(id, available);
  }

  @Permission('menuItem:remove')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuItemService.remove(id);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 5))
  async addImages(
    @Param('id') id: string,
    @UploadedFiles(ParseFilesPipe) files: Express.Multer.File[],
    @Req() req: { user: IUser }
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('File(s) are required');
    }
    // No need for filenames here; pass files directly
    return this.menuItemService.addImages(id, files, req.user);
  }
  // Xóa một ảnh khỏi MenuItem
  @Permission('menuItem:update')
  @Delete(':id/images/:filename')
  async removeImage(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Req() req: { user: IUser }
  ) {
    return this.menuItemService.removeImage(id, filename, req.user);
  }
}
