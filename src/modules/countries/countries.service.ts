import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../../entities/country.entity';
import { CreateCountryDto, UpdateCountryDto } from './dto/country.dto';

@Injectable()
export class CountriesService {
  constructor(@InjectRepository(Country) private repo: Repository<Country>) {}

  findAll(activeOnly = false) {
    return this.repo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const country = await this.repo.findOne({ where: { id } });
    if (!country) throw new NotFoundException('Country not found');
    return country;
  }

  async create(dto: CreateCountryDto) {
    const exists = await this.repo.findOne({ where: { isoCode: dto.isoCode.toUpperCase() } });
    if (exists) throw new ConflictException('Country with this ISO code already exists');
    const country = this.repo.create({ ...dto, isoCode: dto.isoCode.toUpperCase() });
    return this.repo.save(country);
  }

  async update(id: string, dto: UpdateCountryDto) {
    const country = await this.findOne(id);
    Object.assign(country, dto);
    return this.repo.save(country);
  }

  async remove(id: string) {
    const country = await this.findOne(id);
    await this.repo.remove(country);
    return { message: 'Country deleted' };
  }
}
