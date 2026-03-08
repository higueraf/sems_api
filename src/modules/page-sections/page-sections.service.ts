import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPageSection } from '../../entities/event-page-section.entity';

@Injectable()
export class PageSectionsService {
  constructor(@InjectRepository(EventPageSection) private repo: Repository<EventPageSection>) {}

  findByEvent(eventId: string, visibleOnly = false) {
    return this.repo.find({
      where: { eventId, ...(visibleOnly ? { isVisible: true } : {}) },
      order: { displayOrder: 'ASC' },
    });
  }

  async findByKey(eventId: string, sectionKey: string) {
    return this.repo.findOne({ where: { eventId, sectionKey, isVisible: true } });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Page section not found');
    return item;
  }

  async create(dto: Partial<EventPageSection>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<EventPageSection>) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { message: 'Page section deleted' };
  }
}
