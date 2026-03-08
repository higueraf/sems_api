import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Guideline } from '../../entities/guideline.entity';
import { CreateGuidelineDto, UpdateGuidelineDto } from './dto/guideline.dto';

@Injectable()
export class GuidelinesService {
  constructor(@InjectRepository(Guideline) private repo: Repository<Guideline>) {}

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

  async create(dto: CreateGuidelineDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateGuidelineDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    // Si tiene archivo adjunto, lo eliminamos del disco
    if (item.fileUrl) {
      await this.deleteFileFromDisk(item.fileUrl).catch(() => null);
    }
    await this.repo.remove(item);
    return { message: 'Guideline deleted' };
  }

  /**
   * Asocia un archivo subido a una pauta existente.
   */
  async attachFile(
    id: string,
    fileUrl: string,
    fileName: string,
    fileMimeType: string,
  ) {
    const item = await this.findOne(id);
    // Eliminar archivo previo si existe
    if (item.fileUrl) {
      await this.deleteFileFromDisk(item.fileUrl).catch(() => null);
    }
    item.fileUrl = fileUrl;
    item.fileName = fileName;
    item.fileMimeType = fileMimeType;
    return this.repo.save(item);
  }

  /**
   * Elimina el archivo adjunto de una pauta.
   */
  async removeFile(id: string) {
    const item = await this.findOne(id);
    if (item.fileUrl) {
      await this.deleteFileFromDisk(item.fileUrl).catch(() => null);
    }
    item.fileUrl = null;
    item.fileName = null;
    item.fileMimeType = null;
    await this.repo.save(item);
    return { message: 'Archivo eliminado correctamente' };
  }

  /** Borra físicamente un archivo del disco dado su path relativo. */
  private async deleteFileFromDisk(relativeUrl: string) {
    // relativeUrl = "/uploads/guidelines/xxx.pdf"
    const absolutePath = join(process.cwd(), relativeUrl);
    await unlink(absolutePath);
  }
}
