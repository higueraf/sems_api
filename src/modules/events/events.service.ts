import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/event.entity';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(@InjectRepository(Event) private repo: Repository<Event>) {}

  findAll() {
    return this.repo.find({ order: { startDate: 'DESC' } });
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
      ? ['pageSections', 'thematicAxes', 'organizers', 'guidelines']
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
}
