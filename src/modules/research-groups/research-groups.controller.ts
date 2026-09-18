import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { ResearchGroupsService } from './research-groups.service';
import { CreateResearchGroupDto, UpdateResearchGroupDto } from './dto/research-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { Public } from '../../common/decorators/public.decorator';

@Controller('research-groups')
@UseGuards(JwtAuthGuard)
export class ResearchGroupsController {
  constructor(private readonly researchGroupsService: ResearchGroupsService) {}

  @Public()
  @Get()
  findAll(@Query('universityId') universityId?: string, @Query('active') active?: string) {
    return this.researchGroupsService.findAll(universityId, active === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateResearchGroupDto) {
    return this.researchGroupsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResearchGroupDto) {
    return this.researchGroupsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.researchGroupsService.remove(id);
  }
}
