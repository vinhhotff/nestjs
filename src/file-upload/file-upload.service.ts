/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// file-upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Request } from 'express';
import { promises as fs } from 'fs';

@Injectable()
export class FileUploadService {
  // Cấu hình multer storage
  getMulterOptions(folderName?: string) {
    return {
      storage: diskStorage({
        destination: (
          req: Request,
          _file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) => {
          // Lấy folder từ URL path hoặc từ tham số
          let uploadPath = './public/uploads';

          if (folderName) {
            uploadPath = join(uploadPath, folderName);
          } else {
            // Lấy folder từ URL path (ví dụ: /file/upload/cv -> cv)
            const pathSegments = req.path.split('/');
            const folderFromPath = pathSegments[pathSegments.length - 1];
            if (folderFromPath && folderFromPath !== 'upload') {
              uploadPath = join(uploadPath, folderFromPath);
            }
          }

          // Tạo thư mục nếu chưa tồn tại
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void
        ) => {
          // Giữ nguyên tên file gốc
          let originalName = 'unknown';
          if (file && typeof file.originalname === 'string') {
            originalName = Buffer.from(file.originalname, 'latin1').toString(
              'utf8'
            );
          }
          cb(null, originalName);
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      fileFilter: (req: Request, file: Express.Multer.File, cb: Function) => {
        // Cho phép tất cả các loại file
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    };
  }

  // Xử lý upload file
  async uploadFile(file: Express.Multer.File, folder?: string) {
    try {
      if (!file) {
        throw new BadRequestException('Not any file is upload');
      }

      const originalName = Buffer.from(file.originalname, 'latin1').toString(
        'utf8'
      );

      // Ví dụ: lưu metadata vào file json
      const metadata = {
        originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
      };

      const metadataPath = `./public/uploads/${folder || 'default'}/${file.filename}.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        message: 'Upload file Success',
        data: {
          ...metadata,
          path: file.path,
          url: `/uploads/${folder || 'default'}/${file.filename}`,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Error upload file: ${error.message}`);
    }
  }

  // Xử lý upload nhiều file

  async uploadMultipleFiles(files: Express.Multer.File[], folder?: string) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('Not any file is upload');
      }
      const results: {
        originalName: string;
        filename: string;
        path: string;
        size: number;
        mimetype: string;
        folder: string;
        url: string;
      }[] = [];

      for (const file of files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString(
          'utf8'
        );

        const fileData = {
          originalName,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
          folder: folder || 'default',
          url: `/uploads/${folder || 'default'}/${file.filename}`,
        };

        // lưu metadata vào file JSON
        const metadataPath = `./public/uploads/${fileData.folder}/${file.filename}.json`;
        await fs.writeFile(metadataPath, JSON.stringify(fileData, null, 2));

        results.push(fileData);
      }

      return {
        message: `Upload ${files.length} file scuccess`,
        data: results,
      };
    } catch (error) {
      throw new BadRequestException(`Error upload files: ${error.message}`);
    }
  }
}
