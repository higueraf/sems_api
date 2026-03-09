import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, Query, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrganizersService } from './organizers.service';
import {
  CreateOrganizerDto, UpdateOrganizerDto,
  CreateMemberDto, UpdateMemberDto,
} from './dto/organizer.dto';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';

/** Multer en memoria — Cloudinary lee desde buffer, sin tocar el disco */
const memStorage = memoryStorage();

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) =>
  cb(null, /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalname));

@Controller('organizers')
@UseGuards(JwtAuthGuard)
export class OrganizersController {
  constructor(
    private readonly service: OrganizersService,
    private readonly storage: StorageService,
  ) {}

  // ── Instituciones ──────────────────────────────────────────────────────────

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
  @Get('admin/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateOrganizerDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizerDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: memStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.upload(file, 'logos', `org-${id}`);
    return this.service.updateLogo(id, url);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: memStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadPersonPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.upload(file, 'photos', `person-${id}`);
    return this.service.updatePhoto(id, url);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Miembros de una institución ────────────────────────────────────────────

  @Public()
  @Get(':organizerId/members')
  findMembers(@Param('organizerId') organizerId: string) {
    return this.service.findMembers(organizerId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':organizerId/members')
  createMember(
    @Param('organizerId') organizerId: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.service.createMember(organizerId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.service.updateMember(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('members/:id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: memStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadMemberPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storage.upload(file, 'photos', `member-${id}`);
    return this.service.updateMemberPhoto(id, url);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('members/:id')
  removeMember(@Param('id') id: string) {
    return this.service.removeMember(id);
  }
}
