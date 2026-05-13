import {
  Controller, Get, Post, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import {
  GenerateCertificatesDto, SendCertificatesDto, BulkGenerateAndSendDto, CertificateFiltersDto,
} from './dto/certificate.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  // ── Público: verificar certificado ─────────────────────────────────────────

  @Public()
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.service.verify(code);
  }

  // ── Admin/Evaluador ────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get()
  findAll(@Query() filters: CertificateFiltersDto) {
    return this.service.findAll(filters);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('generate')
  generate(@Body() dto: GenerateCertificatesDto, @CurrentUser() user: User) {
    return this.service.generateForSubmissionProductType(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('send')
  send(@Body() dto: SendCertificatesDto, @CurrentUser() user: User) {
    return this.service.sendCertificates(dto.certificateIds, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('generate-and-send')
  generateAndSend(@Body() dto: GenerateCertificatesDto, @CurrentUser() user: User) {
    return this.service.generateAndSend(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('bulk-generate-and-send')
  bulkGenerateAndSend(@Body() dto: BulkGenerateAndSendDto, @CurrentUser() user: User) {
    return this.service.bulkGenerateAndSend(dto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get(':id/download')
  getDownloadUrl(@Param('id') id: string) {
    return this.service.getDownloadUrl(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
