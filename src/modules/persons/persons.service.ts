import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Or } from 'typeorm';
import { Person } from '../../entities/person.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';

export interface PersonDto {
  fullName: string;
  email: string;
  academicTitle?: string;
  affiliation?: string;
  orcid?: string;
  phone?: string;
  countryId?: string;
  city?: string;
  identityDocType?: string;
  identityDocNumber?: string;
  photoUrl?: string;
  identityDocUrl?: string;
  identityDocFileName?: string;
}

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person) private personRepo: Repository<Person>,
    @InjectRepository(SubmissionAuthor) private authorRepo: Repository<SubmissionAuthor>,
  ) {}

  /**
   * Busca una persona por email (primary key natural).
   * Si no existe, la crea. Devuelve siempre el registro de Person.
   */
  async findOrCreate(dto: PersonDto): Promise<Person> {
    const email = dto.email.toLowerCase().trim();
    let person = await this.personRepo.findOne({ where: { email } });
    if (!person) {
      person = this.personRepo.create({
        ...dto,
        email,
      });
      person = await this.personRepo.save(person);
    }
    return person;
  }

  /**
   * Busca personas por email o número de documento.
   * Usado por el admin al agregar autores (autocomplete).
   */
  async search(q: string): Promise<Person[]> {
    if (!q || q.trim().length < 2) return [];
    const term = q.trim();
    return this.personRepo.find({
      where: [
        { email: ILike(`%${term}%`) },
        { identityDocNumber: ILike(`%${term}%`) },
        { fullName: ILike(`%${term}%`) },
      ],
      relations: ['country'],
      take: 10,
      order: { fullName: 'ASC' },
    });
  }

  async findById(id: string): Promise<Person> {
    const person = await this.personRepo.findOne({ where: { id }, relations: ['country', 'user'] });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async findByEmail(email: string): Promise<Person | null> {
    return this.personRepo.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['country', 'user'],
    });
  }

  async findByUserId(userId: string): Promise<Person | null> {
    return this.personRepo.findOne({ where: { userId }, relations: ['country'] });
  }

  /**
   * Actualiza los datos de una persona y propaga los cambios a los
   * submission_authors vinculados (datos denormalizados).
   */
  async update(personId: string, dto: Partial<PersonDto>): Promise<Person> {
    const person = await this.findById(personId);
    Object.assign(person, dto);
    const saved = await this.personRepo.save(person);

    // Propagar cambios a submission_authors vinculados
    const updatable: Partial<SubmissionAuthor> = {};
    if (dto.fullName !== undefined)          updatable.fullName = dto.fullName;
    if (dto.academicTitle !== undefined)     updatable.academicTitle = dto.academicTitle;
    if (dto.affiliation !== undefined)       updatable.affiliation = dto.affiliation;
    if (dto.orcid !== undefined)             updatable.orcid = dto.orcid;
    if (dto.phone !== undefined)             updatable.phone = dto.phone;
    if (dto.countryId !== undefined)         updatable.countryId = dto.countryId;
    if (dto.city !== undefined)              updatable.city = dto.city;
    if (dto.identityDocType !== undefined)   updatable.identityDocType = dto.identityDocType;
    if (dto.identityDocNumber !== undefined) updatable.identityDocNumber = dto.identityDocNumber;

    if (Object.keys(updatable).length > 0) {
      await this.authorRepo.update({ personId }, updatable);
    }

    return saved;
  }

  async setUserId(personId: string, userId: string): Promise<void> {
    await this.personRepo.update(personId, { userId });
  }
}
