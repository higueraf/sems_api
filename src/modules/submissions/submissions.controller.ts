import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query,
  UseInterceptors, UploadedFile, NestInterceptor, ExecutionContext,
  CallHandler, Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SubmissionsService } from './submissions.service';
import {
  CreateSubmissionDto, UpdateSubmissionStatusDto,
  SendCustomEmailDto, AssignEvaluatorDto,
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

const fileStorage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `submission-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const authorPhotoStorage = diskStorage({
  destination: './uploads/photos',
  filename: (_req, file, cb) =>
    cb(null, `author-${Date.now()}${extname(file.originalname)}`),
});

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Public()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: fileStorage }),
    new ParseJsonFieldsInterceptor('authors', 'productTypeIds'),
  )
  create(
    @Body() dto: CreateSubmissionDto,
    @UploadedFile()
    file?: Express.Multer.File,
  ) {
    return this.submissionsService.create(dto, file);
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

  // ── Foto del autor ponente (solo admin/evaluador, post-aprobación) ──────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Post('authors/:authorId/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: authorPhotoStorage,
    fileFilter: (_req, file, cb) =>
      cb(null, /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadAuthorPhoto(
    @Param('authorId') authorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.submissionsService.updateAuthorPhoto(
      authorId,
      `/uploads/photos/${file.filename}`,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('authors/:authorId/photo/remove')
  removeAuthorPhoto(@Param('authorId') authorId: string) {
    return this.submissionsService.updateAuthorPhoto(authorId, null);
  }
}
