import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query,
  UseInterceptors, UploadedFile, NestInterceptor, ExecutionContext,
  CallHandler, Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubmissionsService } from './submissions.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateSubmissionDto, UpdateSubmissionStatusDto,
  SendCustomEmailDto, AssignEvaluatorDto, BulkEmailDto,
} from './dto/submission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

/**
 * Parsea campos JSON que llegan como string dentro de multipart/form-data.
 * Necesario porque FormData serializa arrays/objetos como strings.
 */
@Injectable()
class ParseJsonFieldsInterceptor implements NestInterceptor {
  private readonly fields: string[];
  constructor(...fields: string[]) {
    this.fields = fields;
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    for (const field of this.fields) {
      const raw = req.body?.[field];
      if (typeof raw === 'string') {
        try {
          req.body[field] = JSON.parse(raw);
        } catch {
          // dejar como está si no es JSON válido
        }
      }
    }
    return next.handle();
  }
}

// Todo usa memoryStorage → StorageService enruta a Cloudinary o Supabase según tipo

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB máx (Word con imágenes)
    }),
    new ParseJsonFieldsInterceptor('authors', 'productTypeIds'),
  )
  async create(
    @Body() dto: CreateSubmissionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.submissionsService.create(dto, file, this.storage);
  }

  @Public()
  @Get('check/:email')
  findByEmail(@Param('email') email: string) {
    return this.submissionsService.findByEmail(email);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin')
  findAll(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('thematicAxisId') thematicAxisId?: string,
    @Query('search') search?: string,
  ) {
    return this.submissionsService.findAll({ eventId, status, thematicAxisId, search });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/stats')
  getStats(@Query('eventId') eventId: string) {
    return this.submissionsService.getStats(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id/history')
  getHistory(@Param('id') id: string) {
    return this.submissionsService.getStatusHistory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('admin/:id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.submissionsService.changeStatus(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/assign-evaluator')
  assignEvaluator(@Param('id') id: string, @Body() dto: AssignEvaluatorDto) {
    return this.submissionsService.assignEvaluator(id, dto);
  }

  /** GET /submissions/admin/:id/download — URL firmada para descargar el manuscrito */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id/download')
  async getDownloadUrl(@Param('id') id: string) {
    const submission = await this.submissionsService.findOne(id);
    if (!submission.fileUrl) {
      return { url: null, message: 'Esta postulación no tiene archivo adjunto' };
    }
    const url = await this.storage.getSignedUrl(submission.fileUrl, 60 * 60); // 1 hora
    return { url, fileName: submission.fileName };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/email')
  sendEmail(
    @Param('id') id: string,
    @Body() dto: SendCustomEmailDto,
    @CurrentUser() user: User,
  ) {
    return this.submissionsService.sendCustomEmail(id, dto, user);
  }

  /** POST /submissions/admin/bulk-email — correo masivo a postulantes */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/bulk-email')
  sendBulkEmail(
    @Body() dto: BulkEmailDto,
    @CurrentUser() user: User,
  ) {
    return this.submissionsService.sendBulkEmail(dto, user);
  }

  // ── Foto del autor ponente (solo admin/evaluador, post-aprobación) ──────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Post('authors/:authorId/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) =>
      cb(null, /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadAuthorPhoto(
    @Param('authorId') authorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.upload(file, 'photos', `author-${authorId}`);
    return this.submissionsService.updateAuthorPhoto(authorId, url, this.storage);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('authors/:authorId/photo/remove')
  removeAuthorPhoto(@Param('authorId') authorId: string) {
    return this.submissionsService.updateAuthorPhoto(authorId, null, this.storage);
  }
}
