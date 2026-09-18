import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UniversitiesService } from './universities.service';
import { CreateUniversityDto, UpdateUniversityDto } from './dto/university.dto';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { Public } from '../../common/decorators/public.decorator';

const memStorage = memoryStorage();
const imageFilter = (_req: any, file: Express.Multer.File, cb: any) =>
  cb(null, /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalname));

@Controller('universities')
@UseGuards(JwtAuthGuard)
export class UniversitiesController {
  constructor(
    private readonly universitiesService: UniversitiesService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get()
  findAll(@Query('countryId') countryId?: string, @Query('active') active?: string) {
    return this.universitiesService.findAll(countryId, active === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUniversityDto) {
    return this.universitiesService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUniversityDto) {
    return this.universitiesService.update(id, dto);
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
    const url = await this.storage.upload(file, 'logos', `university-${id}`);
    return this.universitiesService.updateLogo(id, url);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.universitiesService.remove(id);
  }
}
