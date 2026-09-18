import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faculty } from '../../entities/faculty.entity';
import { CreateFacultyDto, UpdateFacultyDto } from './dto/faculty.dto';

@Injectable()
export class FacultiesService {
  constructor(@InjectRepository(Faculty) private repo: Repository<Faculty>) {}

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
    const faculty = await this.repo.findOne({ where: { id } });
    if (!faculty) throw new NotFoundException('Faculty not found');
    return faculty;
  }

  async create(dto: CreateFacultyDto) {
    const exists = await this.repo.findOne({
      where: { name: dto.name.trim(), universityId: dto.universityId },
    });
    if (exists) throw new ConflictException('Faculty already exists in this university');
    const faculty = this.repo.create({ ...dto, name: dto.name.trim() });
    return this.repo.save(faculty);
  }

  async update(id: string, dto: UpdateFacultyDto) {
    const faculty = await this.findOne(id);
    Object.assign(faculty, dto, dto.name ? { name: dto.name.trim() } : {});
    return this.repo.save(faculty);
  }

  async remove(id: string) {
    const faculty = await this.findOne(id);
    await this.repo.remove(faculty);
    return { message: 'Faculty deleted' };
  }
}
