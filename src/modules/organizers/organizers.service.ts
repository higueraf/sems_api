import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizerMember } from '../../entities/organizer-member.entity';
import {
  CreateOrganizerDto, UpdateOrganizerDto,
  CreateMemberDto, UpdateMemberDto,
} from './dto/organizer.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class OrganizersService {
  constructor(
    @InjectRepository(Organizer) private orgRepo: Repository<Organizer>,
    @InjectRepository(OrganizerMember) private memberRepo: Repository<OrganizerMember>,
    private readonly storage: StorageService,
  ) {}

  // ── Organizers (instituciones) ─────────────────────────────────────────────

  async findByEvent(eventId: string, visibleOnly = false) {
    const orgs = await this.orgRepo.find({
      where: { eventId, ...(visibleOnly ? { isVisible: true } : {}) },
      relations: ['country'],
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    
    // Si necesitamos los miembros, los obtenemos por separado
    if (visibleOnly) {
      // Obtener miembros para cada organización
      const orgsWithMembers = await Promise.all(
        orgs.map(async (o) => {
          const members = await this.memberRepo.find({
            where: { organizerId: o.id, isVisible: true },
            relations: ['country'],
            order: { displayOrder: 'ASC' },
          });
          return {
            ...o,
            members,
          };
        })
      );
      return orgsWithMembers;
    }
    
    return orgs;
  }

  async findOne(id: string) {
    const item = await this.orgRepo.findOne({
      where: { id },
      relations: ['country'],
    });
    if (!item) throw new NotFoundException('Organizer not found');
    return item;
  }

  async create(dto: CreateOrganizerDto) {
    return this.orgRepo.save(this.orgRepo.create(dto));
  }

  async update(id: string, dto: UpdateOrganizerDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.orgRepo.save(item);
  }

  async updateLogo(id: string, logoUrl: string) {
    const item = await this.findOne(id);
    // Eliminar logo anterior de Cloudinary si existe
    if (item.logoUrl) {
      await this.storage.delete(item.logoUrl).catch(() => null);
    }
    item.logoUrl = logoUrl;
    return this.orgRepo.save(item);
  }

  async updatePhoto(id: string, photoUrl: string) {
    const item = await this.findOne(id);
    // Eliminar foto anterior de Cloudinary si existe
    if (item.photoUrl) {
      await this.storage.delete(item.photoUrl).catch(() => null);
    }
    item.photoUrl = photoUrl;
    return this.orgRepo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    // Limpiar archivos de Cloudinary antes de borrar el registro
    if (item.logoUrl)  await this.storage.delete(item.logoUrl).catch(() => null);
    if (item.photoUrl) await this.storage.delete(item.photoUrl).catch(() => null);
    await this.orgRepo.remove(item);
    return { message: 'Organizer deleted' };
  }

  // ── Members (personas vinculadas a la institución) ─────────────────────────

  async findMembers(organizerId: string) {
    return this.memberRepo.find({
      where: { organizerId },
      relations: ['country'],
      order: { displayOrder: 'ASC', fullName: 'ASC' },
    });
  }

  async findMember(id: string) {
    const m = await this.memberRepo.findOne({ where: { id }, relations: ['country'] });
    if (!m) throw new NotFoundException('Member not found');
    return m;
  }

  async createMember(organizerId: string, dto: CreateMemberDto) {
    await this.findOne(organizerId);
    return this.memberRepo.save(this.memberRepo.create({ ...dto, organizerId }));
  }

  async updateMember(id: string, dto: UpdateMemberDto) {
    const m = await this.findMember(id);
    Object.assign(m, dto);
    return this.memberRepo.save(m);
  }

  async updateMemberPhoto(id: string, photoUrl: string) {
    const m = await this.findMember(id);
    // Eliminar foto anterior de Cloudinary si existe
    if (m.photoUrl) {
      await this.storage.delete(m.photoUrl).catch(() => null);
    }
    m.photoUrl = photoUrl;
    return this.memberRepo.save(m);
  }

  async removeMember(id: string) {
    const m = await this.findMember(id);
    // Limpiar foto de Cloudinary antes de borrar el registro
    if (m.photoUrl) await this.storage.delete(m.photoUrl).catch(() => null);
    await this.memberRepo.remove(m);
    return { message: 'Member deleted' };
  }
}
