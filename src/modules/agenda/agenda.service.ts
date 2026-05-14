import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { CreateAgendaSlotDto, UpdateAgendaSlotDto, ReorderSlotsDto, DeleteAgendaSlotDto } from './dto/agenda.dto';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { User } from '../../entities/user.entity';

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaSlot) private repo: Repository<AgendaSlot>,
    @InjectRepository(Submission) private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionStatusHistory) private historyRepo: Repository<SubmissionStatusHistory>,
    private mailService: MailService,
    private storage: StorageService,
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

    const slots = await query.getMany();

    // Resolve author photo URLs (local:// → signed HTTP URL)
    for (const slot of slots) {
      if (slot.submission?.authors) {
        for (const author of slot.submission.authors) {
          if (author.photoUrl) {
            author.photoUrl = await this.storage.getSignedUrl(author.photoUrl);
          }
        }
      }
    }

    return slots;
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
    const saved = await this.repo.save(slot);
    if (dto.submissionId) {
      await this.notifyAndScheduleSubmission(dto.submissionId, saved);
    }
    return saved;
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

  async remove(id: string, dto: DeleteAgendaSlotDto, user: User) {
    const slot = await this.findOne(id);
    const { submissionId } = slot;

    // Revert submission status and log to history before deleting the slot
    if (submissionId) {
      const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
      if (submission && submission.status === SubmissionStatus.SCHEDULED) {
        const targetStatus = (dto.revertStatus as SubmissionStatus) ?? SubmissionStatus.APPROVED;
        const previousStatus = submission.status;
        await this.submissionRepo.update(submissionId, { status: targetStatus });
        await this.historyRepo.save(
          this.historyRepo.create({
            submissionId,
            previousStatus,
            newStatus: targetStatus,
            internalNotes: `Bloque de agenda eliminado. Motivo: ${dto.reason}`,
            changedById: user?.id ?? null,
            notifiedApplicant: false,
          }),
        );
      }
    }

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

  async getEligibleSubmissions(eventId: string) {
    // Returns only approved (not yet scheduled) submissions.
    // Product-type filtering (ponencia / comunicación oral) is performed on
    // the frontend where the full product-type catalogue is available, avoiding
    // fragile SQL string matching against potentially variable type names.
    const subs = await this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'country')
      .where('s.eventId = :eventId', { eventId })
      .orderBy('s.referenceCode', 'ASC')
      .getMany();

    const eligible = subs.filter((s) => {
      if (s.status === SubmissionStatus.APPROVED) return true;
      if (s.productStatuses) {
        return Object.values(s.productStatuses).some(
          (st) => st === SubmissionStatus.APPROVED,
        );
      }
      return false;
    });

    // Resolve author photo URLs (local:// → signed HTTP URL)
    for (const sub of eligible) {
      for (const author of sub.authors ?? []) {
        if (author.photoUrl) {
          author.photoUrl = await this.storage.getSignedUrl(author.photoUrl);
        }
      }
    }

    return eligible;
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
