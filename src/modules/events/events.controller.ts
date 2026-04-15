import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, CreateEventVideoDto, UpdateEventVideoDto, CreateWorkshopDto, UpdateWorkshopDto } from './dto/event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { Public } from '../../common/decorators/public.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ── Públicos ────────────────────────────────────────────────────────────────

  @Public()
  @Get('active')
  findActive() {
    return this.eventsService.findActive();
  }

  /** Simposios anteriores (no activos) con sus videos — usado en /simposios */
  @Public()
  @Get('previous')
  findPrevious() {
    return this.eventsService.findPrevious();
  }

  /** Talleres anteriores (no activos) con sus videos — usado en /talleres */
  @Public()
  @Get('workshops')
  findPreviousWorkshops() {
    return this.eventsService.findPreviousWorkshops();
  }

  @Public()
  @Get(':id/public')
  findOnePublic(@Param('id') id: string) {
    return this.eventsService.findOne(id, true);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOneAdmin(@Param('id') id: string) {
    return this.eventsService.findOne(id, true);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/publish-agenda')
  publishAgenda(@Param('id') id: string) {
    return this.eventsService.publishAgenda(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/unpublish-agenda')
  unpublishAgenda(@Param('id') id: string) {
    return this.eventsService.unpublishAgenda(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  // ── Gestión de Videos YouTube ────────────────────────────────────────────────

  /** GET  /events/:id/videos — lista videos del evento (público) */
  @Public()
  @Get(':id/videos')
  findVideos(@Param('id') id: string) {
    return this.eventsService.findVideos(id);
  }

  /** POST /events/:id/videos — agrega video (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/videos')
  addVideo(@Param('id') id: string, @Body() dto: CreateEventVideoDto) {
    return this.eventsService.addVideo(id, dto);
  }

  /** PATCH /events/videos/:videoId — edita video (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('videos/:videoId')
  updateVideo(@Param('videoId') videoId: string, @Body() dto: UpdateEventVideoDto) {
    return this.eventsService.updateVideo(videoId, dto);
  }

  /** DELETE /events/videos/:videoId — elimina video (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('videos/:videoId')
  removeVideo(@Param('videoId') videoId: string) {
    return this.eventsService.removeVideo(videoId);
  }

  // ── Gestión de Talleres ─────────────────────────────────────────────────────

  /** GET  /events/:id/workshops — lista talleres del evento (público) */
  @Public()
  @Get(':id/workshops')
  findWorkshops(@Param('id') id: string) {
    return this.eventsService.findWorkshops(id);
  }

  /** POST /events/:id/workshops — agrega taller (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/workshops')
  addWorkshop(@Param('id') id: string, @Body() dto: CreateWorkshopDto) {
    return this.eventsService.addWorkshop(id, dto);
  }

  /** PATCH /events/workshops/:workshopId — edita taller (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('workshops/:workshopId')
  updateWorkshop(@Param('workshopId') workshopId: string, @Body() dto: UpdateWorkshopDto) {
    return this.eventsService.updateWorkshop(workshopId, dto);
  }

  /** DELETE /events/workshops/:workshopId — elimina taller (admin) */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('workshops/:workshopId')
  removeWorkshop(@Param('workshopId') workshopId: string) {
    return this.eventsService.removeWorkshop(workshopId);
  }
}
