import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { CreateAgendaSlotDto, UpdateAgendaSlotDto, ReorderSlotsDto } from './dto/agenda.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums/role.enum';

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Public()
  @Get('public')
  findPublic(@Query('eventId') eventId: string) {
    return this.agendaService.findByEvent(eventId, true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get()
  findAll(@Query('eventId') eventId: string) {
    return this.agendaService.findByEvent(eventId, false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('days')
  getDays(@Query('eventId') eventId: string) {
    return this.agendaService.getAgendaDays(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('eligible-submissions')
  getEligibleSubmissions(@Query('eventId') eventId: string) {
    return this.agendaService.getEligibleSubmissions(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agendaService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateAgendaSlotDto) {
    return this.agendaService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('reorder')
  reorder(@Body() dto: ReorderSlotsDto) {
    return this.agendaService.reorder(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('publish-all')
  publishAll(@Query('eventId') eventId: string) {
    return this.agendaService.publishAll(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgendaSlotDto) {
    return this.agendaService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.agendaService.togglePublish(id, true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.agendaService.togglePublish(id, false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agendaService.remove(id);
  }
}
