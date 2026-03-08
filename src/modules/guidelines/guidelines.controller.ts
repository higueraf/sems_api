import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
  UploadedFile, UseInterceptors, BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { GuidelinesService } from './guidelines.service';
import { CreateGuidelineDto, UpdateGuidelineDto } from './dto/guideline.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';

@Controller('guidelines')
@UseGuards(JwtAuthGuard)
export class GuidelinesController {
  constructor(private readonly service: GuidelinesService) {}

  @Public()
  @Get()
  findPublic(@Query('eventId') eventId: string) {
    return this.service.findByEvent(eventId, true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin')
  findAll(@Query('eventId') eventId: string) {
    return this.service.findByEvent(eventId, false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateGuidelineDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGuidelineDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /**
   * POST /guidelines/:id/upload
   * Sube un archivo (PDF, PPTX, DOCX) como material de apoyo a una pauta.
   * Solo accesible por administradores.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'guidelines'),
        filename: (_req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Solo se permiten archivos PDF, PPTX o DOCX'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máx
    }),
  )
  uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const fileUrl = `/uploads/guidelines/${file.filename}`;
    return this.service.attachFile(id, fileUrl, file.originalname, file.mimetype);
  }

  /**
   * DELETE /guidelines/:id/upload
   * Elimina el archivo adjunto de una pauta.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id/upload')
  removeFile(@Param('id') id: string) {
    return this.service.removeFile(id);
  }
}
