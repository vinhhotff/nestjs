// file-upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './file-upload.service';
import { ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@ApiTags('File Upload')
@Controller('file/upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  // Upload single file với folder cụ thể từ URL
  @Post(':folder')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folder = req.params.folder;
          const uploadPath = join('./public/uploads', folder);

          // Tạo thư mục nếu chưa tồn tại
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Giữ tên file gốc với encoding UTF-8
          const originalName = Buffer.from(
            file.originalname,
            'latin1'
          ).toString('utf8');
          cb(null, originalName);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Cho phép tất cả các loại file
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFileToFolder(
    @UploadedFile() file: Express.Multer.File,
    @Param('folder') folder: string
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để upload');
    }

    return this.fileUploadService.uploadFile(file, folder);
  }

  // Upload multiple files với folder cụ thể
  @Post(':folder/multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folder = req.params.folder;
          const uploadPath = join('./public/uploads', folder);

          // Tạo thư mục nếu chưa tồn tại
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Giữ tên file gốc với encoding UTF-8
          const originalName = Buffer.from(
            file.originalname,
            'latin1'
          ).toString('utf8');
          cb(null, originalName);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Cho phép tất cả các loại file
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  async uploadMultipleFilesToFolder(
    @UploadedFiles() files: Express.Multer.File[],
    @Param('folder') folder: string
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một file để upload');
    }

    return this.fileUploadService.uploadMultipleFiles(files, folder);
  }

  // Upload file vào thư mục default
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './public/uploads/default';

          // Tạo thư mục nếu chưa tồn tại
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          // Giữ tên file gốc với encoding UTF-8
          const originalName = Buffer.from(
            file.originalname,
            'latin1'
          ).toString('utf8');
          cb(null, originalName);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Cho phép tất cả các loại file
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.fileUploadService.uploadFile(file, 'default');
  }
}
