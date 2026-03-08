import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { PageSectionsService } from './page-sections.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';

@Controller('page-sections')
@UseGuards(JwtAuthGuard)
export class PageSectionsController {
  constructor(private readonly service: PageSectionsService) {}

  @Public()
  @Get()
  findPublic(@Query('eventId') eventId: string, @Query('key') key?: string) {
    if (key) return this.service.findByKey(eventId, key);
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
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
