import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/event.entity';
import { EventVideo } from '../../entities/event-video.entity';
import { Workshop } from '../../entities/workshop.entity';
import { CreateEventDto, UpdateEventDto, CreateEventVideoDto, UpdateEventVideoDto, CreateWorkshopDto, UpdateWorkshopDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private repo: Repository<Event>,
    @InjectRepository(EventVideo) private videoRepo: Repository<EventVideo>,
    @InjectRepository(Workshop) private workshopRepo: Repository<Workshop>,
  ) {}

  findAll() {
    return this.repo.find({ order: { startDate: 'DESC' } });
  }

  /** Simposios anteriores (no activos) con sus videos — público */
  findPrevious() {
    return this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.videos', 'videos')
      .where('event.isActive = false')
      .orderBy('event.startDate', 'DESC')
      .addOrderBy('videos.displayOrder', 'ASC')
      .getMany();
  }

  /** Talleres anteriores (no activos) - público */
  findPreviousWorkshops() {
    return this.repo
      .createQueryBuilder('event')
      .where('event.isActive = false')
      .orderBy('event.startDate', 'DESC')
      .getMany();
  }

  async findActive() {
    const event = await this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.pageSections', 'pageSections', 'pageSections.isVisible = true')
      .leftJoinAndSelect(
        'event.thematicAxes',
        'thematicAxes',
        'thematicAxes.isActive = true',
      )
      .leftJoinAndSelect('event.organizers', 'organizers', 'organizers.isVisible = true')
      .leftJoinAndSelect('event.guidelines', 'guidelines', 'guidelines.isVisible = true')
      .where('event.isActive = true')
      .orderBy('thematicAxes.displayOrder', 'ASC')
      .addOrderBy('pageSections.displayOrder', 'ASC')
      .addOrderBy('guidelines.displayOrder', 'ASC')
      .getOne();

    if (!event) throw new NotFoundException('No active event found');
    return event;
  }

  async findOne(id: string, withRelations = false) {
    const relations = withRelations
      ? ['pageSections', 'thematicAxes', 'organizers', 'guidelines', 'videos']
      : [];
    const event = await this.repo.findOne({ where: { id }, relations });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(dto: CreateEventDto) {
    const event = this.repo.create(dto);
    return this.repo.save(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.findOne(id);
    Object.assign(event, dto);
    return this.repo.save(event);
  }

  async publishAgenda(id: string) {
    const event = await this.findOne(id);
    event.isAgendaPublished = true;
    return this.repo.save(event);
  }

  async unpublishAgenda(id: string) {
    const event = await this.findOne(id);
    event.isAgendaPublished = false;
    return this.repo.save(event);
  }

  async remove(id: string) {
    const event = await this.findOne(id);
    await this.repo.remove(event);
    return { message: 'Event deleted' };
  }

  // ── Gestión de videos YouTube ──────────────────────────────────────────────

  /** Lista videos de un evento ordenados por displayOrder */
  findVideos(eventId: string) {
    return this.videoRepo.find({
      where: { eventId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Añade un video a un evento */
  async addVideo(eventId: string, dto: CreateEventVideoDto): Promise<EventVideo> {
    await this.findOne(eventId);
    if (dto.displayOrder === undefined) {
      const count = await this.videoRepo.count({ where: { eventId } });
      dto.displayOrder = count;
    }
    const video = this.videoRepo.create({ ...dto, eventId });
    return this.videoRepo.save(video);
  }

  /** Actualiza un video existente */
  async updateVideo(videoId: string, dto: UpdateEventVideoDto): Promise<EventVideo> {
    const video = await this.videoRepo.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    Object.assign(video, dto);
    return this.videoRepo.save(video);
  }

  /** Elimina un video */
  async removeVideo(videoId: string): Promise<{ message: string }> {
    const video = await this.videoRepo.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');
    await this.videoRepo.remove(video);
    return { message: 'Video deleted' };
  }

  // ── Gestión de talleres ─────────────────────────────────────────────────────

  /** Lista talleres de un evento ordenados por displayOrder */
  findWorkshops(eventId: string) {
    return this.workshopRepo.find({
      where: { eventId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Añade un taller a un evento */
  async addWorkshop(eventId: string, dto: CreateWorkshopDto): Promise<Workshop> {
    await this.findOne(eventId);
    if (dto.displayOrder === undefined) {
      const count = await this.workshopRepo.count({ where: { eventId } });
      dto.displayOrder = count;
    }
    const workshop = this.workshopRepo.create({ ...dto, eventId });
    const savedWorkshop = await this.workshopRepo.save(workshop);
    return Array.isArray(savedWorkshop) ? savedWorkshop[0] : savedWorkshop;
  }

  /** Actualiza un taller existente */
  async updateWorkshop(workshopId: string, dto: UpdateWorkshopDto): Promise<Workshop> {
    const workshop = await this.workshopRepo.findOne({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Workshop not found');
    Object.assign(workshop, dto);
    const savedWorkshop = await this.workshopRepo.save(workshop);
    return Array.isArray(savedWorkshop) ? savedWorkshop[0] : savedWorkshop;
  }

  /** Elimina un taller */
  async removeWorkshop(workshopId: string): Promise<{ message: string }> {
    const workshop = await this.workshopRepo.findOne({ where: { id: workshopId } });
    if (!workshop) throw new NotFoundException('Workshop not found');
    await this.workshopRepo.remove(workshop);
    return { message: 'Workshop deleted' };
  }
}
