/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// dynamic-upload.interceptor.ts (Interceptor tùy chỉnh để xử lý folder động)
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './file-upload.service';

@Injectable()
export class DynamicUploadInterceptor implements NestInterceptor {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const folder = request.params.folder;

    // Áp dụng cấu hình multer động
    const multerOptions = this.fileUploadService.getMulterOptions(folder);
    const fileInterceptor = new (FileInterceptor('file', multerOptions))();

    return await fileInterceptor.intercept(context, next);
  }
}
