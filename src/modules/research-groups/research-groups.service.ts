import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResearchGroup } from '../../entities/research-group.entity';
import { CreateResearchGroupDto, UpdateResearchGroupDto, FindOrCreateResearchGroupDto } from './dto/research-group.dto';

@Injectable()
export class ResearchGroupsService {
  constructor(@InjectRepository(ResearchGroup) private repo: Repository<ResearchGroup>) {}

  findAll(universityId?: string, activeOnly = false) {
    return this.repo.find({
      where: {
        ...(universityId ? { universityId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const group = await this.repo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Research group not found');
    return group;
  }

  /** Usado por el flujo público de postulación: reutiliza el semillero si ya existe (case-insensitive) o lo crea. */
  async findOrCreate(dto: FindOrCreateResearchGroupDto): Promise<ResearchGroup> {
    const name = dto.name.trim();
    const existing = await this.repo
      .createQueryBuilder('g')
      .where('g.universityId = :universityId', { universityId: dto.universityId })
      .andWhere('LOWER(g.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) return existing;
    return this.repo.save(this.repo.create({ name, universityId: dto.universityId }));
  }

  async create(dto: CreateResearchGroupDto) {
    const exists = await this.repo.findOne({
      where: { name: dto.name.trim(), universityId: dto.universityId },
    });
    if (exists) throw new ConflictException('Research group already exists in this university');
    const group = this.repo.create({ ...dto, name: dto.name.trim() });
    return this.repo.save(group);
  }

  async update(id: string, dto: UpdateResearchGroupDto) {
    const group = await this.findOne(id);
    Object.assign(group, dto, dto.name ? { name: dto.name.trim() } : {});
    return this.repo.save(group);
  }

  async remove(id: string) {
    const group = await this.findOne(id);
    await this.repo.remove(group);
    return { message: 'Research group deleted' };
  }
}
