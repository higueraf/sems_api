import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, Query,
  UseInterceptors, UploadedFile, UploadedFiles,
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SubmissionsService } from './submissions.service';
import { StorageService } from '../storage/storage.service';
import { SubmissionFileType } from '../../entities/submission-file.entity';
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

/** Parsea campos JSON que llegan como string en multipart/form-data */
@Injectable()
class ParseJsonFieldsInterceptor implements NestInterceptor {
  private readonly fields: string[];
  constructor(...fields: string[]) { this.fields = fields; }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    for (const field of this.fields) {
      const raw = req.body?.[field];
      if (typeof raw === 'string') {
        try { req.body[field] = JSON.parse(raw); } catch { /* no es JSON */ }
      }
    }
    return next.handle();
  }
}

// Configuración del interceptor de archivos para Word
const wordFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const isWord = /\.(doc|docx)$/i.test(file.originalname) ||
      ['application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      .includes(file.mimetype);
    cb(null, isWord);
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(
    private readonly service: SubmissionsService,
    private readonly storage: StorageService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // PÚBLICO — Crear postulación
  // ════════════════════════════════════════════════════════════════════════════

  @Public()
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
    new ParseJsonFieldsInterceptor('authors', 'productTypeIds'),
  )
  async create(
    @Body() dto: CreateSubmissionDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const all          = files ?? [];
    const manuscript   = all.find(f => f.fieldname === 'file');
    const authorPhotos = all.filter(f => f.fieldname.startsWith('authorPhoto_'));
    const authorIdDocs = all.filter(f => f.fieldname.startsWith('authorIdDoc_'));
    return this.service.create(dto, manuscript, this.storage, authorPhotos, authorIdDocs);
  }

  @Public()
  @Get('check/:email')
  findByEmail(@Param('email') email: string) {
    return this.service.findByEmail(email);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN / EVALUADOR
  // ════════════════════════════════════════════════════════════════════════════

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin')
  findAll(
    @Query('eventId') eventId?: string,
    @Query('status') status?: string,
    @Query('thematicAxisId') thematicAxisId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ eventId, status, thematicAxisId, search });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/stats')
  getStats(@Query('eventId') eventId: string) {
    return this.service.getStats(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id/history')
  getHistory(@Param('id') id: string) {
    return this.service.getStatusHistory(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('admin/:id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.service.changeStatus(id, dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/assign-evaluator')
  assignEvaluator(@Param('id') id: string, @Body() dto: AssignEvaluatorDto) {
    return this.service.assignEvaluator(id, dto);
  }

  // ── Descarga del documento activo ─────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id/download')
  getDownloadUrl(@Param('id') id: string) {
    return this.service.getDownloadUrl(id, this.storage);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE VERSIONES DEL DOCUMENTO
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/submissions/admin/:id/files — lista todas las versiones */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/:id/files')
  getFileHistory(@Param('id') id: string) {
    return this.service.getFileHistory(id);
  }

  /**
   * POST /api/submissions/admin/:id/files — sube nueva versión del documento.
   * La nueva versión queda automáticamente como oficial/activa.
   * Body (multipart): file (Word), fileType?, notes?
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/files')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  async addFileVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('fileType') fileType: SubmissionFileType,
    @Body('notes') notes: string,
    @CurrentUser() user: User,
  ) {
    return this.service.addFileVersion(
      id, file, this.storage, user.id,
      fileType || SubmissionFileType.CORRECTION,
      notes,
    );
  }

  /**
   * PATCH /api/submissions/admin/files/:fileId/activate
   * Promueve una versión anterior a oficial (activa).
   * El documento oficial de la postulación cambia al seleccionado.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/files/:fileId/activate')
  setActiveVersion(
    @Param('fileId') fileId: string,
    @Query('submissionId') submissionId: string,
  ) {
    return this.service.setActiveFileVersion(submissionId, fileId);
  }

  /**
   * GET /api/submissions/admin/files/:fileId/download
   * Descarga una versión específica del historial.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('admin/files/:fileId/download')
  getFileVersionDownloadUrl(@Param('fileId') fileId: string) {
    return this.service.getFileDownloadUrl(fileId, this.storage);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DOCUMENTOS DE IDENTIDAD DE AUTORES
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/submissions/authors/:authorId/id-doc/download */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('authors/:authorId/id-doc/download')
  getIdDocDownloadUrl(@Param('authorId') authorId: string) {
    return this.service.getAuthorIdDocUrl(authorId, this.storage);
  }

  /**
   * POST /api/submissions/authors/:authorId/id-doc
   * Reemplaza el documento de identidad desde el dashboard.
   * Elimina el anterior de B2 y sube el nuevo.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('authors/:authorId/id-doc')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) =>
      cb(null, /\.pdf$/i.test(file.originalname) || file.mimetype === 'application/pdf'),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  replaceAuthorIdDoc(
    @Param('authorId') authorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.replaceAuthorIdDoc(authorId, file, this.storage);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FOTOS DE AUTORES
  // ════════════════════════════════════════════════════════════════════════════

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Post('authors/:authorId/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => cb(null, /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadAuthorPhoto(
    @Param('authorId') authorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.upload(file, 'photos', `author-${authorId}`);
    return this.service.updateAuthorPhoto(authorId, url, this.storage);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('authors/:authorId/photo/remove')
  removeAuthorPhoto(@Param('authorId') authorId: string) {
    return this.service.updateAuthorPhoto(authorId, null, this.storage);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CORREOS
  // ════════════════════════════════════════════════════════════════════════════

  /** Correo con adjunto Word en base64 (JSON body) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/email')
  sendEmail(
    @Param('id') id: string,
    @Body() dto: SendCustomEmailDto,
    @CurrentUser() user: User,
  ) {
    return this.service.sendCustomEmail(id, dto, user);
  }

  /** Correo con adjunto Word como multipart (archivo real) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:id/email/attachment')
  @UseInterceptors(FileInterceptor('attachment', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) =>
      cb(null, /\.(doc|docx)$/i.test(file.originalname) ||
        ['application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        .includes(file.mimetype)),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  sendEmailWithAttachment(
    @Param('id') id: string,
    @Body() dto: SendCustomEmailDto,
    @UploadedFile() attachment: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.service.sendCustomEmail(id, dto, user, attachment);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/bulk-email')
  sendBulkEmail(@Body() dto: BulkEmailDto, @CurrentUser() user: User) {
    return this.service.sendBulkEmail(dto, user);
  }
}
