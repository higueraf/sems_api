import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Guideline } from '../../entities/guideline.entity';
import { CreateGuidelineDto, UpdateGuidelineDto } from './dto/guideline.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class GuidelinesService {
  constructor(
    @InjectRepository(Guideline) private repo: Repository<Guideline>,
    private readonly storage: StorageService,
  ) {}

  findByEvent(eventId: string, visibleOnly = false) {
    return this.repo.find({
      where: { eventId, ...(visibleOnly ? { isVisible: true } : {}) },
      order: { displayOrder: 'ASC' },
    });
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Guideline not found');
    return item;
  }

  /** Valida que no exista ya una pauta con el mismo productTypeId en el mismo evento. */
  private async assertProductTypeUnique(
    eventId: string,
    productTypeId: string | null | undefined,
    excludeId?: string,
  ) {
    if (!productTypeId) return;
    const conflict = await this.repo.findOne({
      where: {
        eventId,
        productTypeId,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException(
        `Ya existe una pauta asignada a este tipo de producto científico.`,
      );
    }
  }

  async create(dto: CreateGuidelineDto) {
    await this.assertProductTypeUnique(dto.eventId, dto.productTypeId);
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateGuidelineDto) {
    const item = await this.findOne(id);
    await this.assertProductTypeUnique(dto.eventId ?? item.eventId, dto.productTypeId, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    // Eliminar archivo de Backblaze B2 si existe
    if (item.fileUrl) {
      await this.storage.delete(item.fileUrl).catch(() => null);
    }
    await this.repo.remove(item);
    return { message: 'Guideline eliminada' };
  }

  /**
   * Asocia un archivo (ya subido a B2) a una pauta existente.
   * Si había un archivo previo, lo elimina de B2 primero.
   */
  async attachFile(
    id: string,
    fileUrl: string,
    fileName: string,
    fileMimeType: string,
  ) {
    const item = await this.findOne(id);
    // Borrar archivo anterior de B2 si existe
    if (item.fileUrl) {
      await this.storage.delete(item.fileUrl).catch(() => null);
    }
    item.fileUrl      = fileUrl;
    item.fileName     = fileName;
    item.fileMimeType = fileMimeType;
    return this.repo.save(item);
  }

  /**
   * Genera una URL de descarga firmada (válida 1 hora) para el archivo adjunto.
   * Funciona tanto con referencias B2 como con URLs de Cloudinary o rutas locales.
   */
  async getDownloadUrl(id: string): Promise<{ url: string; fileName: string }> {
    const item = await this.findOne(id);
    if (!item.fileUrl) throw new NotFoundException('Esta pauta no tiene archivo adjunto');
    const url = await this.storage.getSignedUrl(item.fileUrl, 3600);
    return { url, fileName: item.fileName };
  }

  /**
   * Elimina el archivo adjunto de una pauta (de B2 y de la BD).
   */
  async removeFile(id: string) {
    const item = await this.findOne(id);
    if (item.fileUrl) {
      await this.storage.delete(item.fileUrl).catch(() => null);
    }
    item.fileUrl      = null;
    item.fileName     = null;
    item.fileMimeType = null;
    await this.repo.save(item);
    return { message: 'Archivo eliminado correctamente' };
  }
}
