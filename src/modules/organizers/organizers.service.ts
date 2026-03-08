import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organizer } from '../../entities/organizer.entity';
import { CreateOrganizerDto, UpdateOrganizerDto } from './dto/organizer.dto';

@Injectable()
export class OrganizersService {
  constructor(@InjectRepository(Organizer) private repo: Repository<Organizer>) {}

  findByEvent(eventId: string, visibleOnly = false) {
    return this.repo.find({
      where: { eventId, ...(visibleOnly ? { isVisible: true } : {}) },
      relations: ['country'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id }, relations: ['country'] });
    if (!item) throw new NotFoundException('Organizer not found');
    return item;
  }

  async create(dto: CreateOrganizerDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateOrganizerDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async updateLogo(id: string, logoUrl: string) {
    const item = await this.findOne(id);
    item.logoUrl = logoUrl;
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { message: 'Organizer deleted' };
  }
}
