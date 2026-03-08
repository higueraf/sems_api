import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';

@Injectable()
export class ScientificProductTypesService {
  constructor(@InjectRepository(ScientificProductType) private repo: Repository<ScientificProductType>) {}

  findAll(activeOnly = false) {
    return this.repo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Product type not found');
    return item;
  }

  async create(dto: Partial<ScientificProductType>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<ScientificProductType>) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { message: 'Product type deleted' };
  }
}
