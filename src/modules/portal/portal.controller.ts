import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { AdminAuthorDto } from '../submissions/dto/submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpdateAccountDto, ChangePasswordDto } from './dto/update-account.dto';

@Controller('portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AUTHOR, UserRole.EVALUATOR)
export class PortalController {
  constructor(private readonly service: PortalService) {}

  /** Lista todas las postulaciones del autor logueado */
  @Get('submissions')
  getMySubmissions(@CurrentUser() user: User) {
    return this.service.getMySubmissions(user.id);
  }

  /** Detalle de una postulación con historial público */
  @Get('submissions/:id')
  getMySubmission(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.getMySubmission(user.id, id);
  }

  /** Sube corrección de archivo cuando el estado es revision_requested */
  @Post('submissions/:id/revision')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadRevision(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('notes') notes?: string,
  ) {
    return this.service.uploadRevision(user.id, id, file, notes);
  }

  /** Edita los campos de texto de una postulación (si el estatus lo permite) */
  @Patch('submissions/:id')
  updateSubmission(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.service.updateSubmission(user.id, id, dto);
  }

  /** Agrega un coautor a la postulación (si el estatus lo permite) */
  @Post('submissions/:id/authors')
  addAuthor(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: AdminAuthorDto,
  ) {
    return this.service.addAuthor(user.id, id, dto);
  }

  /** Quita un coautor de la postulación (si el estatus lo permite) */
  @Delete('submissions/:id/authors/:authorId')
  removeAuthor(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('authorId') authorId: string,
  ) {
    return this.service.removeAuthor(user.id, id, authorId);
  }

  /** Certificados del autor para una postulación */
  @Get('submissions/:id/certificates')
  getMyCertificates(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.getMyCertificates(user.id, id);
  }

  /** Todos los certificados del autor logueado, de todas sus postulaciones */
  @Get('certificates')
  getAllMyCertificates(@CurrentUser() user: User) {
    return this.service.getAllMyCertificates(user.id);
  }

  /** Descarga un certificado (diploma o carta) */
  @Get('certificates/:certId/download')
  getCertDownloadUrl(
    @CurrentUser() user: User,
    @Param('certId') certId: string,
    @Query('format') format: 'diploma' | 'carta' = 'diploma',
  ) {
    return this.service.getCertDownloadUrl(user.id, certId, format);
  }

  /** Datos de cuenta del autor logueado */
  @Get('account')
  getAccount(@CurrentUser() user: User) {
    return this.service.getAccount(user.id);
  }

  /** Actualiza nombre/apellido de la cuenta */
  @Patch('account')
  updateAccount(@CurrentUser() user: User, @Body() dto: UpdateAccountDto) {
    return this.service.updateAccount(user.id, dto);
  }

  /** Cambia la contraseña de la cuenta */
  @Patch('account/password')
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.id, dto);
  }
}
