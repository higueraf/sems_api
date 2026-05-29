import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, StreamableFile,
} from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { CreateAgendaSlotDto, UpdateAgendaSlotDto, ReorderSlotsDto, DeleteAgendaSlotDto } from './dto/agenda.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

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

  @Public()
  @Get('pdf-public')
  async getPdfPublic(
    @Query('eventId') eventId: string,
    @Query('eventName') eventName: string,
  ) {
    const buffer = await this.agendaService.generatePdf(eventId, eventName ?? 'Agenda', true);
    const safe = (eventName ?? 'agenda').replace(/[^\w-]/g, '_').substring(0, 50);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safe}.pdf"`,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('pdf')
  async getPdf(
    @Query('eventId') eventId: string,
    @Query('eventName') eventName: string,
  ) {
    const buffer = await this.agendaService.generatePdf(eventId, eventName ?? 'Agenda', false);
    const safe = (eventName ?? 'agenda').replace(/[^\w-]/g, '_').substring(0, 50);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safe}.pdf"`,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agendaService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('notify-all')
  notifyAll(
    @Query('eventId') eventId: string,
    @Query('force') force?: string,
  ) {
    return this.agendaService.notifyAll(eventId, force === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/notify')
  notifySlot(@Param('id') id: string) {
    return this.agendaService.notifySlot(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Post()
  create(@Body() dto: CreateAgendaSlotDto) {
    return this.agendaService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('reorder')
  reorder(@Body() dto: ReorderSlotsDto) {
    return this.agendaService.reorder(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch('publish-all')
  publishAll(@Query('eventId') eventId: string) {
    return this.agendaService.publishAll(eventId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgendaSlotDto) {
    return this.agendaService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.agendaService.togglePublish(id, true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Patch(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.agendaService.togglePublish(id, false);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() dto: DeleteAgendaSlotDto,
    @CurrentUser() user: User,
  ) {
    return this.agendaService.remove(id, dto, user);
  }
}
