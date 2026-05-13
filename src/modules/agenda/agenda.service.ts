import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { Submission } from '../../entities/submission.entity';
import { CreateAgendaSlotDto, UpdateAgendaSlotDto, ReorderSlotsDto } from './dto/agenda.dto';
import { MailService } from '../mail/mail.service';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaSlot) private repo: Repository<AgendaSlot>,
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    private mailService: MailService,
  ) {}

  async findByEvent(eventId: string, publishedOnly = false) {
    const query = this.repo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.submission', 'submission')
      .leftJoinAndSelect('submission.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'authorCountry')
      .leftJoinAndSelect('submission.thematicAxis', 'submissionAxis')
      .leftJoinAndSelect('slot.thematicAxis', 'axis')
      .where('slot.eventId = :eventId', { eventId })
      .orderBy('slot.day', 'ASC')
      .addOrderBy('slot.startTime', 'ASC')
      .addOrderBy('slot.displayOrder', 'ASC');

    if (publishedOnly) query.andWhere('slot.isPublished = true');

    return query.getMany();
  }

  async findOne(id: string) {
    const slot = await this.repo.findOne({
      where: { id },
      relations: ['submission', 'submission.authors', 'thematicAxis'],
    });
    if (!slot) throw new NotFoundException('Agenda slot not found');
    return slot;
  }

  async create(dto: CreateAgendaSlotDto) {
    const slot = this.repo.create(dto);
    return this.repo.save(slot);
  }

  async update(id: string, dto: UpdateAgendaSlotDto) {
    const slot = await this.findOne(id);
    const previousSubmissionId = slot.submissionId;
    Object.assign(slot, dto);
    const saved = await this.repo.save(slot);

    // When a submission is newly assigned to a slot, notify speaker and update submission status
    if (dto.submissionId && dto.submissionId !== previousSubmissionId) {
      await this.notifyAndScheduleSubmission(dto.submissionId, saved);
    }

    return saved;
  }

  async remove(id: string) {
    const slot = await this.findOne(id);
    await this.repo.remove(slot);
    return { message: 'Slot removed' };
  }

  async reorder(dto: ReorderSlotsDto) {
    const updates = dto.orderedIds.map((slotId, index) =>
      this.repo.update(slotId, { displayOrder: index }),
    );
    await Promise.all(updates);
    return { message: 'Order updated' };
  }

  async togglePublish(id: string, publish: boolean) {
    const slot = await this.findOne(id);
    slot.isPublished = publish;
    return this.repo.save(slot);
  }

  async publishAll(eventId: string) {
    await this.repo.update({ eventId }, { isPublished: true });
    return { message: 'All slots published' };
  }

  private async notifyAndScheduleSubmission(submissionId: string, slot: AgendaSlot) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['authors', 'thematicAxis', 'productType'],
    });

    if (!submission) return;

    // Auto-update submission status to scheduled
    if (submission.status === SubmissionStatus.APPROVED) {
      await this.submissionRepo.update(submissionId, { status: SubmissionStatus.SCHEDULED });
    }

    if (!slot.speakerNotified) {
      await this.mailService.sendScheduleAssigned(submission, slot);
      await this.repo.update(slot.id, { speakerNotified: true });
    }
  }

  getAgendaDays(eventId: string) {
    return this.repo
      .createQueryBuilder('slot')
      .select('DISTINCT slot.day', 'day')
      .where('slot.eventId = :eventId', { eventId })
      .orderBy('slot.day', 'ASC')
      .getRawMany();
  }
}
