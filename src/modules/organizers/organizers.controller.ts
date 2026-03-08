import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { OrganizersService } from './organizers.service';
import { CreateOrganizerDto, UpdateOrganizerDto } from './dto/organizer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';

const logoStorage = diskStorage({
  destination: './uploads/logos',
  filename: (_req, file, cb) => {
    cb(null, `logo-${Date.now()}${extname(file.originalname)}`);
  },
});

@Controller('organizers')
@UseGuards(JwtAuthGuard)
export class OrganizersController {
  constructor(private readonly service: OrganizersService) {}

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
  create(@Body() dto: CreateOrganizerDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: (_req, file, cb) => {
        cb(null, /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalname));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.updateLogo(id, `/uploads/logos/${file.filename}`);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizerDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
