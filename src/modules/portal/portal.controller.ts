import {
  Controller, Get, Post, Param, Query, Body,
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

@Controller('portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AUTHOR)
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

  /** Certificados del autor para una postulación */
  @Get('submissions/:id/certificates')
  getMyCertificates(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.getMyCertificates(user.id, id);
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
}
