import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { CreateAgendaSlotDto, UpdateAgendaSlotDto, ReorderSlotsDto, DeleteAgendaSlotDto } from './dto/agenda.dto';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { computeGlobalStatus } from '../../common/utils/submission-status.util';
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

    // Revert productStatuses and log history before deleting the slot
    if (submissionId) {
      const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
      if (submission) {
        const targetStatus = (dto.revertStatus as SubmissionStatus) ?? SubmissionStatus.APPROVED;
        const ps = submission.productStatuses ?? {};
        // Only revert the specific product type stored on the slot
        const targetPtId = slot.submissionProductTypeId;
        const scheduledEntries = targetPtId
          ? Object.entries(ps).filter(([ptId, st]) => ptId === targetPtId && st === SubmissionStatus.SCHEDULED)
          : Object.entries(ps).filter(([, st]) => st === SubmissionStatus.SCHEDULED);

        if (scheduledEntries.length > 0) {
          const updated = { ...ps };
          for (const [ptId] of scheduledEntries) {
            updated[ptId] = targetStatus;
          }
          await this.submissionRepo.update(submissionId, {
            productStatuses: updated,
            status: computeGlobalStatus(updated),
          });

          // One history record per product type that was reverted
          await this.historyRepo.save(
            scheduledEntries.map(([ptId]) =>
              this.historyRepo.create({
                submissionId,
                previousStatus: SubmissionStatus.SCHEDULED,
                newStatus: targetStatus,
                internalNotes: `Bloque de agenda eliminado. Motivo: ${dto.reason}`,
                productTypeId: ptId,
                changedById: user?.id ?? null,
                notifiedApplicant: false,
              }),
            ),
          );
        }
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

  /** Reenvía el correo de programación al ponente de un slot específico (fuerza reenvío). */
  async notifySlot(id: string): Promise<{ sent: boolean; error?: string }> {
    const slot = await this.repo.findOne({
      where: { id },
      relations: ['submission', 'submission.authors', 'submission.thematicAxis', 'thematicAxis'],
    });
    if (!slot) throw new NotFoundException('Slot not found');
    if (!slot.submissionId || !slot.submission) {
      return { sent: false, error: 'No hay postulación asignada a este bloque' };
    }
    try {
      await this.mailService.sendScheduleAssigned(slot.submission, slot);
      await this.repo.update(slot.id, { speakerNotified: true });
      return { sent: true };
    } catch (err: any) {
      return { sent: false, error: err?.message ?? 'Error al enviar correo' };
    }
  }

  /**
   * Envío masivo de correos de programación.
   * @param force - si true, reenvía a todos incluso los ya notificados.
   * Retorna un resumen { sent, failed, skipped }.
   */
  async notifyAll(eventId: string, force = false): Promise<{ sent: number; failed: number; skipped: number }> {
    const slots = await this.repo.find({
      where: { eventId },
      relations: ['submission', 'submission.authors', 'submission.thematicAxis', 'thematicAxis'],
    });

    const withSubmission = slots.filter((s) => s.submissionId && s.submission);
    const toNotify = force ? withSubmission : withSubmission.filter((s) => !s.speakerNotified);
    const skipped = withSubmission.length - toNotify.length;

    let sent = 0, failed = 0;
    for (const slot of toNotify) {
      try {
        await this.mailService.sendScheduleAssigned(slot.submission!, slot);
        await this.repo.update(slot.id, { speakerNotified: true });
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed, skipped };
  }

  private async notifyAndScheduleSubmission(submissionId: string, slot: AgendaSlot) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['authors', 'thematicAxis', 'productType'],
    });

    if (!submission) return;

    // Only update the specific product type linked to this slot (ponencia / comunicación oral).
    // If none is stored on the slot, fall back to all approved entries (legacy safety net).
    const ps = submission.productStatuses ?? {};
    const targetPtId = slot.submissionProductTypeId;
    const entriesToSchedule = targetPtId
      ? Object.entries(ps).filter(([ptId, st]) => ptId === targetPtId && st === SubmissionStatus.APPROVED)
      : Object.entries(ps).filter(([, st]) => st === SubmissionStatus.APPROVED);

    if (entriesToSchedule.length > 0) {
      const updated = { ...ps };
      for (const [ptId] of entriesToSchedule) {
        updated[ptId] = SubmissionStatus.SCHEDULED;
      }
      await this.submissionRepo.update(submissionId, {
        productStatuses: updated,
        status: computeGlobalStatus(updated),
      });
    }

    // Email is NOT sent automatically — admin must use notifySlot / notifyAll
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

    const eligible = subs.filter((s) =>
      s.productStatuses
        ? Object.values(s.productStatuses).some((st) => st === SubmissionStatus.APPROVED)
        : false,
    );

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

  async generatePdf(eventId: string, eventName: string, publishedOnly = true): Promise<Buffer> {
    const slots = await this.findByEvent(eventId, publishedOnly);
    return buildAgendaPdf(slots, eventName);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF standalone builder — green bezier design matching certificate style
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPhotoBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await (globalThis as any).fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')
    .trim();
}

function flagToCode(emoji: string): string {
  if (!emoji) return '';
  try {
    const cps = [...emoji].map(c => c.codePointAt(0) ?? 0);
    if (cps.length >= 2 && cps[0] >= 0x1F1E6 && cps[0] <= 0x1F1FF)
      return String.fromCharCode(cps[0] - 0x1F1E6 + 65) + String.fromCharCode(cps[1] - 0x1F1E6 + 65);
  } catch { /* */ }
  return '';
}

async function buildAgendaPdf(slots: AgendaSlot[], eventName: string): Promise<Buffer> {
  const nd = (d: any): string => {
    if (d instanceof Date) return d.toISOString().substring(0, 10);
    return String(d).substring(0, 10);
  };

  const days = [...new Set(slots.map(s => nd(s.day)))].sort();
  const byDay = new Map<string, AgendaSlot[]>();
  for (const day of days) {
    byDay.set(day,
      slots.filter(s => nd(s.day) === day)
           .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.displayOrder - b.displayOrder),
    );
  }

  // Pre-fetch all speaker photos and country flags
  const photoCache = new Map<string, Buffer>();
  const flagCache  = new Map<string, Buffer>();
  for (const slot of slots) {
    const auth = slot.submission?.authors?.find((a: any) => a.isCorresponding) ?? slot.submission?.authors?.[0];
    const url: string | undefined = (auth as any)?.photoUrl;
    if (url && !photoCache.has(url)) {
      const buf = await fetchPhotoBuffer(url);
      if (buf) photoCache.set(url, buf);
    }
    const code = flagToCode((auth as any)?.country?.flagEmoji || '');
    if (code && !flagCache.has(code)) {
      const buf = await fetchPhotoBuffer(`https://flagcdn.com/w20/${code.toLowerCase()}.png`);
      if (buf) flagCache.set(code, buf);
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const G1 = '#134e2c', G2 = '#1a6b3a', G3 = '#007F3A', G4 = '#4caf79', G5 = '#d8f3dc';
    const W = 595.28, H = 841.89;
    const ML = 40, CW = W - 80;
    const HDR_H = 90, FTR_H = 42;
    const CT = HDR_H + 8, CB = H - FTR_H;
    const T_W = 58, R_W = 60, TP_W = 64;
    const PH_R = 16;                           // photo circle radius
    const PH_W = PH_R * 2 + 12;               // photo column width (44px)
    const CON_X = ML + T_W + R_W + TP_W + PH_W;
    const CON_W = CW - T_W - R_W - TP_W - PH_W;
    const LABELS: Record<string, string> = {
      keynote: 'Conferencia', presentation: 'Ponencia', break: 'Receso',
      ceremony: 'Ceremonia', workshop: 'Taller', panel: 'Panel',
    };

    const topWave = (color: string, lY: number, rY: number, cp: number) =>
      doc.fillColor(color).moveTo(0, 0).lineTo(W, 0).lineTo(W, rY)
         .bezierCurveTo(W * 0.65, rY + cp, W * 0.35, lY + cp, 0, lY).closePath().fill();

    const botWave = (color: string, lY: number, rY: number, cp: number) =>
      doc.fillColor(color).moveTo(0, H).lineTo(W, H).lineTo(W, rY)
         .bezierCurveTo(W * 0.65, rY - cp, W * 0.35, lY - cp, 0, lY).closePath().fill();

    // Draw circular speaker photo or initials fallback
    const drawPhoto = (photoBuf: Buffer | undefined, initials: string, cx: number, cy: number) => {
      if (photoBuf) {
        try {
          doc.save();
          doc.circle(cx, cy, PH_R).clip();
          doc.image(photoBuf, cx - PH_R, cy - PH_R, { width: PH_R * 2, height: PH_R * 2 });
          doc.restore();
        } catch { photoBuf = undefined; }
      }
      if (!photoBuf) {
        doc.circle(cx, cy, PH_R).fillColor('#e8f5e9').fill();
        if (initials) {
          doc.fillColor(G3).font('Helvetica-Bold').fontSize(PH_R * 0.75)
             .text(initials, cx - PH_R, cy - PH_R * 0.52, { width: PH_R * 2, align: 'center', lineBreak: false });
        }
      }
      doc.circle(cx, cy, PH_R).strokeColor('#c8e6c9').lineWidth(0.7).stroke();
    };

    let pageNum = 0;
    let yPos = CT;

    const addPage = (first: boolean) => {
      doc.addPage({ size: 'A4', margin: 0 });
      pageNum++;

      topWave(G5, 93, 76, 22); topWave(G4, 82, 66, 17);
      topWave(G3, 72, 57, 13); topWave(G2, 62, 48, 9); topWave(G1, 50, 40, 5);

      if (first) {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17)
           .text(eventName, ML, 10, { width: CW, align: 'center', lineBreak: false });
        doc.fillColor(G5).font('Helvetica').fontSize(8.5)
           .text('PROGRAMA CIENTÍFICO', ML, 33, { width: CW, align: 'center' });
      }

      botWave(G5, H - 40, H - 26, 12); botWave(G4, H - 30, H - 19, 9);
      botWave(G3, H - 23, H - 14, 7);  botWave(G2, H - 15, H - 9, 5);
      botWave(G1, H - 7, H - 4, 2);

      doc.fillColor('#cccccc').font('Helvetica').fontSize(7.5)
         .text(String(pageNum), ML, H - 34, { width: CW, align: 'center' });

      yPos = CT;
    };

    const chkBreak = (h: number) => { if (yPos + h > CB) addPage(false); };

    addPage(true);

    for (const day of days) {
      const daySlots = byDay.get(day) || [];
      if (!daySlots.length) continue;

      chkBreak(28);
      const d = new Date(day + 'T12:00:00');
      const label = d.toLocaleDateString('es', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }).replace(/^\w/, c => c.toUpperCase());

      doc.rect(ML, yPos, CW, 22).fillColor(G1).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5)
         .text(label, ML + 10, yPos + 6, { width: CW - 20, lineBreak: false });
      yPos += 26;

      for (let ri = 0; ri < daySlots.length; ri++) {
        const slot = daySlots[ri];
        const auth = slot.submission?.authors?.find((a: any) => a.isCorresponding)
          ?? slot.submission?.authors?.[0];
        const speaker   = slot.speakerName || (auth as any)?.fullName || '';
        const affil     = stripHtml(slot.speakerAffiliation || (auth as any)?.affiliation || '');
        // Strip HTML, normalize whitespace, truncate to prevent inflated row heights
        const titleRaw  = stripHtml(slot.submission?.titleEs || slot.title || '');
        const title     = titleRaw.length > 220 ? titleRaw.slice(0, 217) + '…' : titleRaw;
        const axis      = slot.thematicAxis || (slot.submission as any)?.thematicAxis;
        const photoUrl  = (auth as any)?.photoUrl as string | undefined;
        const photoBuf  = photoUrl ? photoCache.get(photoUrl) : undefined;
        const countryCode = flagToCode((auth as any)?.country?.flagEmoji || '');
        const flagBuf   = countryCode ? flagCache.get(countryCode) : undefined;
        const initials  = speaker
          ? speaker.split(' ').slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase()
          : '';

        doc.font('Helvetica-Bold').fontSize(9);
        const titleH = title ? Math.min(doc.heightOfString(title, { width: CON_W - 4 }), 90) : 0;
        let rowH = 10 + titleH + (speaker ? 18 : 0) + (affil ? 11 : 0) + (axis ? 15 : 0) + 8;
        rowH = Math.max(rowH, PH_R * 2 + 12); // ensure photo fits
        rowH = Math.min(rowH, 190);            // hard cap — prevents runaway rows

        chkBreak(rowH + 2);
        const ry = yPos;
        if (ri % 2 === 0) doc.rect(ML, ry, CW, rowH).fillColor('#f5fdf7').fill();

        // Time column
        doc.fillColor(G3).font('Courier-Bold').fontSize(9)
           .text(slot.startTime.substring(0, 5), ML, ry + 10, { width: T_W, align: 'center', lineBreak: false });
        doc.fillColor('#aaaaaa').font('Courier').fontSize(8)
           .text(slot.endTime.substring(0, 5), ML, ry + 22, { width: T_W, align: 'center', lineBreak: false });

        // Room pill
        if (slot.room) {
          doc.roundedRect(ML + T_W + 2, ry + 10, R_W - 6, 13, 3).fillColor('#f0f0f0').fill();
          doc.fillColor('#666666').font('Helvetica').fontSize(7)
             .text(slot.room, ML + T_W + 5, ry + 13.5, { width: R_W - 12, lineBreak: false });
        }

        // Type badge
        const tl = LABELS[slot.type as string] || String(slot.type);
        doc.roundedRect(ML + T_W + R_W + 2, ry + 10, TP_W - 6, 13, 3).fillColor(G5).fill();
        doc.fillColor(G1).font('Helvetica-Bold').fontSize(7)
           .text(tl, ML + T_W + R_W + 5, ry + 13.5, { width: TP_W - 12, lineBreak: false });

        // Speaker photo (circular)
        if (speaker || photoBuf) {
          const phCX = ML + T_W + R_W + TP_W + PH_W / 2;
          const phCY = ry + rowH / 2;
          drawPhoto(photoBuf, initials, phCX, phCY);
        }

        // Content area: title, speaker + country, affiliation, axis
        let iy = ry + 8;
        if (title) {
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9)
             .text(title, CON_X, iy, { width: CON_W - 4 });
          iy += doc.heightOfString(title, { width: CON_W - 4 }) + 2;
        }
        if (speaker) {
          doc.fillColor('#333333').font('Helvetica').fontSize(8.5)
             .text(speaker, CON_X, iy, { width: CON_W - 4, lineBreak: false });
          if (flagBuf) {
            const nameW = Math.min(
              doc.widthOfString(speaker, { lineBreak: false } as any),
              CON_W - 26,
            );
            try { doc.image(flagBuf, CON_X + nameW + 5, iy + 1, { height: 10 }); } catch { /* */ }
          }
          iy += 18; // extra room so flag doesn't overlap next line
        }
        if (affil) {
          doc.fillColor('#888888').font('Helvetica').fontSize(7.5)
             .text(affil, CON_X, iy, { width: CON_W - 4, lineBreak: false });
          iy += 11;
        }
        if (axis?.name) {
          const aW = Math.min(CON_W - 4, doc.widthOfString(axis.name, { lineBreak: false } as any) + 14);
          doc.roundedRect(CON_X, iy, aW, 12, 3).fillColor((axis as any).color || G3).fill();
          doc.fillColor('#ffffff').font('Helvetica').fontSize(7)
             .text(axis.name, CON_X + 5, iy + 3, { width: aW - 10, lineBreak: false });
        }

        yPos += rowH;
        doc.strokeColor('#e0f0e8').lineWidth(0.4)
           .moveTo(ML, yPos).lineTo(ML + CW, yPos).stroke();
        yPos += 2;
      }
      yPos += 12;
    }

    doc.end();
  });
}
