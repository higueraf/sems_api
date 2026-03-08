import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThematicAxis } from '../../entities/thematic-axis.entity';

@Injectable()
export class ThematicAxesService {
  constructor(@InjectRepository(ThematicAxis) private repo: Repository<ThematicAxis>) {}

  findByEvent(eventId: string, activeOnly = false) {
    return this.repo.find({
      where: { eventId, ...(activeOnly ? { isActive: true } : {}) },
      order: { displayOrder: 'ASC' },
    });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Thematic axis not found');
    return item;
  }

  async create(dto: Partial<ThematicAxis>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<ThematicAxis>) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { message: 'Thematic axis deleted' };
  }
}
