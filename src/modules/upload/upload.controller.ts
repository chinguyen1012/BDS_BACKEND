import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'listings');

mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('upload')
export class UploadController {
  @Post('images')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Chỉ chấp nhận file ảnh'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImages(
    @UploadedFiles() files: Array<{ filename: string; originalname: string }>,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 ảnh');
    }

    return {
      urls: files.map((f) => `/uploads/listings/${f.filename}`),
    };
  }
}
