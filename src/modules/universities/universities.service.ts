import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { University } from '../../entities/university.entity';
import { CreateUniversityDto, UpdateUniversityDto, FindOrCreateUniversityDto } from './dto/university.dto';

@Injectable()
export class UniversitiesService {
  constructor(@InjectRepository(University) private repo: Repository<University>) {}

  findAll(countryId?: string, activeOnly = false) {
    return this.repo.find({
      where: {
        ...(countryId ? { countryId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const university = await this.repo.findOne({ where: { id } });
    if (!university) throw new NotFoundException('University not found');
    return university;
  }

  async create(dto: CreateUniversityDto) {
    const exists = await this.repo.findOne({
      where: { name: dto.name.trim(), countryId: dto.countryId },
    });
    if (exists) throw new ConflictException('University already exists in this country');
    const university = this.repo.create({ ...dto, name: dto.name.trim() });
    return this.repo.save(university);
  }

  async update(id: string, dto: UpdateUniversityDto) {
    const university = await this.findOne(id);
    Object.assign(university, dto, dto.name ? { name: dto.name.trim() } : {});
    return this.repo.save(university);
  }

  async remove(id: string) {
    const university = await this.findOne(id);
    await this.repo.remove(university);
    return { message: 'University deleted' };
  }

  async updateLogo(id: string, logoUrl: string) {
    const university = await this.findOne(id);
    university.logoUrl = logoUrl;
    return this.repo.save(university);
  }

  /** Usado por el flujo público de postulación: reutiliza la universidad si ya existe (case-insensitive) o la crea. */
  async findOrCreate(dto: FindOrCreateUniversityDto): Promise<University> {
    const name = dto.name.trim();
    const existing = await this.repo
      .createQueryBuilder('u')
      .where('u.countryId = :countryId', { countryId: dto.countryId })
      .andWhere('LOWER(u.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) return existing;
    return this.repo.save(this.repo.create({ name, countryId: dto.countryId }));
  }
}
