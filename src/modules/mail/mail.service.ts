/**
 * MailService
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio de correo electrónico con soporte multi-transporte.
 * Soporta adjuntos Word (Buffer) en correos personalizados.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog, EmailType } from '../../entities/email-log.entity';
import { Submission } from '../../entities/submission.entity';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { Event } from '../../entities/event.entity';
import { ThematicAxis } from '../../entities/thematic-axis.entity';
import { SubmissionStatus, EventFormat } from '../../common/enums/submission-status.enum';
import { MailTransport, MailAttachment, createMailTransport } from './transports';

// Tipo unificado para adjuntos — acepta tanto Multer.File como objeto plano {buffer, ...}
type AttachmentLike = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** Datos de "branding" del evento, derivados dinámicamente para las plantillas de correo */
interface EventBranding {
  name: string;
  year: number;
  dateRangeLabel: string;
  locationLabel: string;
  formatLabel: string;
  certifiedHoursLabel: string;
  attendeesLabel: string;
  axesLabel: string;
  siteUrl: string;
}

const FORMAT_LABELS: Record<string, string> = {
  [EventFormat.IN_PERSON]: 'Modalidad Presencial',
  [EventFormat.ONLINE]: 'Modalidad Virtual',
  [EventFormat.HYBRID]: 'Modalidad Híbrida',
};

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDateRange(start?: Date | string, end?: Date | string): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthLabel = MONTHS_ES[e.getMonth()];
  if (sameMonth) return `${s.getDate()}–${e.getDate()} ${monthLabel} ${e.getFullYear()}`;
  return `${s.getDate()} ${MONTHS_ES[s.getMonth()]} – ${e.getDate()} ${monthLabel} ${e.getFullYear()}`;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport: MailTransport;
  private fromAddress: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    @InjectRepository(ThematicAxis) private axisRepo: Repository<ThematicAxis>,
  ) {
    this.transport   = createMailTransport(configService);
    this.fromAddress = configService.get<string>('mail.from') || 'SEMS <noreply@sems.edu>';
    this.logger.log(
      `MailService inicializado | Transporte: ${this.transport.name} | From: ${this.fromAddress}`,
    );
  }

  async onModuleInit() {
    try {
      await this.transport.verify();
      this.logger.log(`✅ [${this.transport.name}] Verificación exitosa — correo operativo`);
    } catch (err) {
      this.logger.warn(
        `⚠️  [${this.transport.name}] Verificación fallida: ${err.message}\n` +
        `   Compruebe las variables de entorno de correo en su panel de despliegue.`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EVENTO ACTIVO — resolución dinámica de datos para las plantillas
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Resuelve el evento a usar como "branding" del correo: usa el evento de la
   * postulación si está disponible (por eventId o por relación ya cargada);
   * si no, cae al evento activo (isActive = true). Si tampoco hay evento activo,
   * retorna un branding genérico para no romper el envío de correos.
   */
  private async resolveEvent(hint?: { event?: Event; eventId?: string } | null): Promise<Event | null> {
    if (hint?.event) return hint.event;
    if (hint?.eventId) {
      const byId = await this.eventRepo.findOne({ where: { id: hint.eventId } });
      if (byId) return byId;
    }
    return this.eventRepo.findOne({ where: { isActive: true } });
  }

  private async getBranding(hint?: { event?: Event; eventId?: string } | null): Promise<EventBranding> {
    const event = await this.resolveEvent(hint);

    if (!event) {
      return {
        name: 'SEMS',
        year: new Date().getFullYear(),
        dateRangeLabel: '',
        locationLabel: '',
        formatLabel: '',
        certifiedHoursLabel: '',
        attendeesLabel: '',
        axesLabel: '',
        siteUrl: 'https://simposio.umayor.edu.co',
      };
    }

    const axesCount = event.id
      ? await this.axisRepo.count({ where: { eventId: event.id, isActive: true } })
      : 0;

    return {
      name: event.name,
      year: event.startDate ? new Date(event.startDate).getFullYear() : new Date().getFullYear(),
      dateRangeLabel: formatDateRange(event.startDate, event.endDate),
      locationLabel: event.city || event.location || '',
      formatLabel: FORMAT_LABELS[event.format] || '',
      certifiedHoursLabel: event.certifiedHours ? `🎓 ${event.certifiedHours}h certificadas` : '',
      attendeesLabel: event.expectedAttendees ? `👥 +${event.expectedAttendees} participantes` : '',
      axesLabel: axesCount ? `📚 ${axesCount} ejes temáticos` : '',
      siteUrl: 'https://simposio.umayor.edu.co',
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEMPLATE BASE HTML
  // ════════════════════════════════════════════════════════════════════════════

  private buildBaseLayout(content: string, branding: EventBranding): string {
    const year = new Date().getFullYear();
    const headerMeta = [
      branding.dateRangeLabel ? `📅 ${branding.dateRangeLabel}` : '',
      branding.locationLabel ? `📍 ${branding.locationLabel}` : '',
      branding.formatLabel ? `🌐 ${branding.formatLabel}` : '',
    ].filter(Boolean).map(s => `<span style="margin-right:15px;">${s}</span>`).join('');

    const footerMeta = [branding.certifiedHoursLabel, branding.attendeesLabel, branding.axesLabel]
      .filter(Boolean).map(s => `<span style="margin-right:15px;">${s}</span>`).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${branding.name}</title>
  <style>
    .info-row{padding:8px 0;border-bottom:1px solid #d0e6d8;}
    .info-row:last-child{border-bottom:none;}
    ul{padding-left:20px;margin:15px 0;}
    li{color:#374840;font-size:14px;margin-bottom:5px;}
    a{color:#007F3A;text-decoration:underline;}
    @media only screen and (max-width:600px){
      .email-content{padding:20px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f1;font-family:Arial,Helvetica,sans-serif;">
  <div style="background-color:#f0f4f1;padding:20px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
      <div style="background-color:#003918;padding:20px 30px;color:white;">
        <div style="font-size:11px;color:#7ee8a2;text-transform:uppercase;margin-bottom:5px;">${branding.name}</div>
        <div style="font-size:24px;font-weight:bold;margin-bottom:10px;">CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> ${branding.year}</div>
        <div style="font-size:12px;color:#a0d8b3;">
          ${headerMeta}
        </div>
      </div>
      <div class="email-content" style="padding:30px;color:#333333;line-height:1.6;">
        ${content}
      </div>
      <div style="background-color:#003918;color:white;">
        <div style="background-color:#007F3A;padding:20px 30px;">
          <div style="font-size:16px;font-weight:bold;margin-bottom:10px;">CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> ${branding.year}</div>
          <div style="font-size:12px;color:#a0d8b3;">
            ${footerMeta}
          </div>
        </div>
        <div style="padding:20px 30px;font-size:12px;color:#a0d8b3;">
          <div style="margin-bottom:10px;">
            <a href="${branding.siteUrl}" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Sitio oficial</a>
            <a href="${branding.siteUrl}/pautas" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Pautas</a>
            <a href="${branding.siteUrl}/verificar" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Verificar</a>
            <a href="${branding.siteUrl}/agenda" style="color:#7ee8a2;text-decoration:none;">Agenda</a>
          </div>
          <div style="color:#6a8f76;">
            Este correo fue generado automáticamente por SEMS. Por favor no responda directamente.<br>
            © ${year} ${branding.name}${branding.locationLabel ? ` · ${branding.locationLabel}` : ''}
          </div>
        </div>
        <div style="height:4px;background:linear-gradient(90deg,#007F3A,#E60553,#007F3A);"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEND CORE — acepta adjuntos opcionales
  // ════════════════════════════════════════════════════════════════════════════

  private async send(
    to: string,
    toName: string,
    subject: string,
    html: string,
    type: EmailType,
    relatedSubmissionId?: string,
    sentById?: string,
    attachments?: MailAttachment[],
  ): Promise<boolean> {
    let success = false;
    let errorMessage: string | null = null;
    let messageId: string | null = null;

    this.logger.log(`[${this.transport.name}] Enviando → ${to} | ${subject}`);

    try {
      messageId = await this.transport.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        attachments,
      });
      success = true;
      this.logger.log(`✅ Enviado a ${to} | ID: ${messageId}`);
    } catch (err) {
      errorMessage = err.message;
      this.logger.error(`❌ Error al enviar a ${to}: ${err.message}`);
    }

    try {
      await this.emailLogRepo.save(
        this.emailLogRepo.create({
          toEmail: to,
          toName,
          subject,
          body: html.substring(0, 1000),
          type,
          relatedSubmissionId,
          success,
          errorMessage,
          sentById,
        }),
      );
    } catch (logErr) {
      this.logger.error(`Error guardando log de correo: ${logErr.message}`);
    }

    return success;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CORREOS DE NEGOCIO
  // ════════════════════════════════════════════════════════════════════════════

  async sendSubmissionReceived(submission: Submission) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return this.logger.error(`Sin autor para postulación ${submission.id}`);

    const branding = await this.getBranding(submission);

    const receivedDate = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">
        Nos complace comunicarle que su postulación al <strong>${branding.name} ${branding.year}</strong>
        ha sido <strong>recibida satisfactoriamente</strong> en nuestro sistema de gestión académica.
      </p>
      <div style="background-color:#003918;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <div style="font-size:12px;color:#7ee8a2;text-transform:uppercase;margin-bottom:5px;">Su código de referencia</div>
        <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#7ee8a2;">${submission.referenceCode}</div>
      </div>
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="font-size:14px;font-weight:bold;color:#007F3A;text-transform:uppercase;margin-bottom:15px;">Resumen de su postulación</div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Título</span>
          <span style="color:#374840;">${submission.titleEs || 'No especificado'}</span>
        </div>
        ${submission.thematicAxis ? `<div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Eje temático</span><span style="color:#374840;">${submission.thematicAxis.name}</span></div>` : ''}
        ${submission.productType  ? `<div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Tipo de producto</span><span style="color:#374840;">${submission.productType.name}</span></div>` : ''}
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Recibida el</span>
          <span style="color:#374840;">${receivedDate}</span>
        </div>
        <div style="padding:8px 0;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Estado</span>
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:#dbeafe;color:#1e40af;">Recibida</span>
        </div>
      </div>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <p style="color:#333333;margin:0;">
          Consulte el estado de su postulación en
          <a href="https://simposio.umayor.edu.co/verificar" style="color:#92400e;font-weight:600;">nuestro sitio web</a>.
        </p>
      </div>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con los mejores deseos académicos,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] Postulación recibida — ${submission.referenceCode}`,
      this.buildBaseLayout(content, branding), EmailType.SUBMISSION_RECEIVED, submission.id,
    );
  }

  async sendStatusChanged(submission: Submission, newStatus: SubmissionStatus, notes?: string) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return;

    const branding = await this.getBranding(submission);

    type StatusInfo = {
      label: string; badgeBg: string; badgeColor: string;
      headline: string; intro: string; closing: string; extra?: string;
    };

    const STATUS_MAP: Record<string, StatusInfo> = {
      under_review: {
        label: 'En Revisión', badgeBg: '#e0f2fe', badgeColor: '#0369a1',
        headline: 'Su postulación está siendo evaluada',
        intro: 'Su trabajo ha sido asignado al <strong>Comité Científico</strong> para su evaluación formal.',
        closing: 'Le informaremos el resultado a la brevedad.',
      },
      revision_requested: {
        label: 'Revisión Requerida', badgeBg: '#fef3c7', badgeColor: '#92400e',
        headline: 'Se requieren ajustes en su postulación',
        intro: 'Tras la revisión del Comité, se identificaron <strong>aspectos susceptibles de mejora</strong>.',
        closing: 'Una vez realizadas las correcciones, contáctenos para coordinar la resubmisión.',
        extra: notes ? `<div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;"><p style="color:#333;margin:0;">${notes}</p></div>` : '',
      },
      approved: {
        label: 'Aprobada', badgeBg: '#dcfce7', badgeColor: '#166534',
        headline: '¡Su postulación ha sido aprobada!',
        intro: 'Su trabajo ha sido <strong>aprobado por el Comité Científico</strong>.',
        closing: 'Próximamente recibirá información sobre la programación de su presentación.',
      },
      rejected: {
        label: 'No aprobada', badgeBg: '#fee2e2', badgeColor: '#991b1b',
        headline: 'Resultado de la evaluación',
        intro: 'Lamentamos informarle que su postulación <strong>no ha podido ser aprobada</strong>.',
        closing: 'Le animamos a participar en futuras convocatorias.',
        extra: notes ? `<div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;"><p style="color:#333;margin:0;">${notes}</p></div>` : '',
      },
      scheduled: {
        label: 'Programada', badgeBg: '#ede9fe', badgeColor: '#5b21b6',
        headline: '¡Su presentación ha sido programada!',
        intro: 'Su trabajo ha sido <strong>incluido en la agenda académica</strong> del Simposio.',
        closing: 'Próximamente recibirá los detalles de su presentación.',
      },
      withdrawn: {
        label: 'Retirada', badgeBg: '#dbeafe', badgeColor: '#1e40af',
        headline: 'Confirmación de retiro',
        intro: 'Su postulación ha sido <strong>retirada del proceso</strong>.',
        closing: 'Si desea postular nuevamente, no dude en contactarnos.',
      },
    };

    const info: StatusInfo = STATUS_MAP[newStatus] ?? {
      label: newStatus, badgeBg: '#e0f2fe', badgeColor: '#0369a1',
      headline: 'Actualización en su postulación',
      intro: 'El estado de su postulación ha sido actualizado.',
      closing: 'Para consultas contacte al equipo organizador.',
    };

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">${info.intro}</p>
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Código</span>
          <span style="font-family:'Courier New',monospace;font-weight:bold;color:#003918;">${submission.referenceCode}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Título</span>
          <span style="color:#374840;">${submission.titleEs || 'No especificado'}</span>
        </div>
        <div style="padding:8px 0;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Nuevo estado</span>
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:${info.badgeBg};color:${info.badgeColor};">${info.label}</span>
        </div>
      </div>
      ${info.extra ?? ''}
      <p style="color:#333333;margin-bottom:16px;">${info.closing}</p>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Cordialmente,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] ${info.headline} — ${submission.referenceCode}`,
      this.buildBaseLayout(content, branding), EmailType.STATUS_CHANGED, submission.id,
    );
  }

  async sendScheduleAssigned(submission: Submission, slot: AgendaSlot) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return;

    const branding = await this.getBranding(submission);

    const dayStr = new Date(slot.day).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">Su presentación ha sido <strong>oficialmente programada</strong> en la agenda del Simposio.</p>
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Código</span><span style="font-family:'Courier New',monospace;font-weight:bold;color:#003918;">${submission.referenceCode}</span></div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Título</span><span style="color:#374840;">${submission.titleEs}</span></div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Fecha</span><span style="color:#374840;">${dayStr}</span></div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Horario</span><span style="color:#374840;"><strong>${slot.startTime} – ${slot.endTime}</strong></span></div>
        <div style="padding:8px 0;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Sala</span><span style="color:#374840;">${slot.room || 'Por confirmar'}</span></div>
        ${slot.thematicAxis ? `<div style="padding:8px 0;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Eje temático</span><span style="color:#374840;">${slot.thematicAxis.name}</span></div>` : ''}
      </div>
      <ul>
        <li>Prepare sus diapositivas en formato <strong>16:9 (widescreen)</strong></li>
        <li>Conéctese con al menos <strong>10 minutos de anticipación</strong></li>
        <li>Verifique micrófono, cámara y conexión a internet</li>
      </ul>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con entusiasmo,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] Su presentación ha sido programada — ${submission.referenceCode}`,
      this.buildBaseLayout(content, branding), EmailType.SCHEDULE_ASSIGNED, submission.id,
    );
  }

  /**
   * Correo personalizado — acepta adjunto Word opcional.
   * @param attachment Multer.File o {buffer, originalname, mimetype}
   */
  async sendCustomEmail(
    toEmail: string,
    toName: string,
    subject: string,
    body: string,
    submissionId?: string,
    sentById?: string,
    attachment?: AttachmentLike,
  ) {
    const branding = await this.getBranding(null);
    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${toName},</div>
      <div style="height:1px;background-color:#e0e0e0;margin:25px 0;"></div>
      ${body}
      <div style="height:1px;background-color:#e0e0e0;margin:25px 0;"></div>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Atentamente,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    // Convertir adjunto al formato MailAttachment si viene
    const attachments: MailAttachment[] | undefined = attachment
      ? [{
          filename:    attachment.originalname || 'documento.docx',
          content:     Buffer.isBuffer(attachment.buffer) ? attachment.buffer : Buffer.from(attachment.buffer),
          contentType: attachment.mimetype ||
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }]
      : undefined;

    return this.send(
      toEmail, toName, subject,
      this.buildBaseLayout(content, branding),
      EmailType.CUSTOM,
      submissionId,
      sentById,
      attachments,
    );
  }

  /**
   * Envía correo con certificados PDF adjuntos.
   * Usado por CertificatesService al momento de emitir certificados.
   */
  async sendCertificateEmail(
    toEmail: string,
    toName: string,
    subject: string,
    html: string,
    submissionId: string,
    sentById: string,
    pdfAttachments?: { buffer: Buffer; fileName: string }[],
  ): Promise<boolean> {
    const attachments: MailAttachment[] | undefined = pdfAttachments?.map(a => ({
      filename: a.fileName,
      content: a.buffer,
      contentType: 'application/pdf',
    }));
    
    return this.send(toEmail, toName, subject, html, EmailType.CERTIFICATE, submissionId, sentById, attachments);
  }

  async sendEvaluatorAssigned(
    submission: Submission,
    evaluatorName: string,
    evaluatorEmail: string,
  ) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return;

    const branding = await this.getBranding(submission);

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">
        Le informamos que se ha asignado un <strong>evaluador/revisor</strong> a su postulación en el
        <strong>${branding.name} ${branding.year}</strong>.
      </p>
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="font-size:14px;font-weight:bold;color:#007F3A;text-transform:uppercase;margin-bottom:15px;">Datos de su evaluador</div>
        <div class="info-row"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Nombre</span><span style="color:#374840;">${evaluatorName}</span></div>
        <div class="info-row"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Correo</span><span style="color:#374840;"><a href="mailto:${evaluatorEmail}" style="color:#007F3A;">${evaluatorEmail}</a></span></div>
        <div class="info-row"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Código</span><span style="color:#374840;">${submission.referenceCode}</span></div>
        <div style="padding:8px 0;"><span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Título</span><span style="color:#374840;">${submission.titleEs || 'No especificado'}</span></div>
      </div>
      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <p style="color:#333333;margin:0;">
          Toda comunicación relacionada con su postulación (dudas, estado de evaluación, correcciones)
          debe realizarse directamente al correo del evaluador indicado arriba.
        </p>
      </div>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con los mejores deseos académicos,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] Evaluador asignado a su postulación — ${submission.referenceCode}`,
      this.buildBaseLayout(content, branding), EmailType.SUBMISSION_RECEIVED, submission.id,
    );
  }

  async findLogs(submissionId?: string) {
    const where = submissionId ? { relatedSubmissionId: submissionId } : {};
    return this.emailLogRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async testConnection(): Promise<{ ok: boolean; transport: string; message: string }> {
    try {
      await this.transport.verify();
      return { ok: true, transport: this.transport.name, message: 'Conexión verificada correctamente' };
    } catch (err) {
      return { ok: false, transport: this.transport.name, message: err.message };
    }
  }

  /** Correo de bienvenida al portal de autores con credenciales de acceso */
  async sendAuthorWelcome(
    person: { email: string; fullName: string },
    tempPassword: string,
    submission?: { referenceCode?: string; titleEs?: string; event?: Event } | null,
  ) {
    const branding = await this.getBranding(submission?.event ? { event: submission.event } : null);
    const portalUrl = 'https://simposio.umayor.edu.co/portal/login';
    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${person.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">
        Se ha creado automáticamente una <strong>cuenta de acceso al Portal de Autores</strong>
        del ${branding.name} ${branding.year}, donde podrá consultar el progreso
        de sus postulaciones, descargar sus certificados y enviar correcciones cuando sea necesario.
      </p>

      <div style="background-color:#003918;border-radius:8px;padding:20px;margin:20px 0;">
        <div style="font-size:12px;color:#7ee8a2;text-transform:uppercase;margin-bottom:12px;">Sus credenciales de acceso</div>
        <div style="margin-bottom:8px;">
          <span style="color:#a0d8b3;font-size:12px;">Correo electrónico</span><br>
          <span style="color:white;font-family:monospace;font-size:15px;">${person.email}</span>
        </div>
        <div>
          <span style="color:#a0d8b3;font-size:12px;">Contraseña temporal</span><br>
          <span style="color:#7ee8a2;font-family:monospace;font-size:20px;font-weight:bold;">${tempPassword}</span>
        </div>
      </div>

      <div style="text-align:center;margin:25px 0;">
        <a href="${portalUrl}" style="display:inline-block;background-color:#007F3A;color:white;padding:14px 30px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
          Acceder al Portal →
        </a>
      </div>

      ${submission?.referenceCode ? `
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="font-size:13px;font-weight:bold;color:#007F3A;margin-bottom:8px;">Postulación vinculada</div>
        <div style="color:#374840;font-size:13px;">
          <strong>${submission.referenceCode}</strong>${submission.titleEs ? ` — ${submission.titleEs}` : ''}
        </div>
      </div>` : ''}

      <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <p style="color:#92400e;margin:0;font-size:13px;">
          <strong>Recomendamos cambiar su contraseña</strong> la primera vez que acceda al portal.
          Guarde esta información en un lugar seguro.
        </p>
      </div>

      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con los mejores deseos académicos,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">${branding.name} ${branding.year}</p>
      </div>
    `;

    return this.send(
      person.email, person.fullName,
      '[SEMS] Acceso al Portal de Autores — Credenciales de ingreso',
      this.buildBaseLayout(content, branding),
      EmailType.CUSTOM,
      submission?.referenceCode ? undefined : undefined,
    );
  }
}
