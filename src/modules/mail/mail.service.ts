/**
 * MailService
 * ─────────────────────────────────────────────────────────────────────────────
 * Servicio de correo electrónico con soporte multi-transporte.
 *
 * El transporte concreto (SMTP o Resend) es seleccionado automáticamente
 * en el constructor a partir de las variables de entorno, mediante
 * la MailTransportFactory. El servicio opera siempre contra la interfaz
 * MailTransport, sin acoplarse a ningún proveedor específico.
 *
 * Para cambiar de proveedor basta con modificar las variables de entorno
 * y hacer un nuevo deploy — sin tocar código.
 *
 * Ver: src/modules/mail/transports/mail-transport.factory.ts
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog, EmailType } from '../../entities/email-log.entity';
import { Submission } from '../../entities/submission.entity';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { MailTransport, createMailTransport } from './transports';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport: MailTransport;
  private fromAddress: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
  ) {
    // La factory decide qué transporte instanciar según las env vars
    this.transport   = createMailTransport(configService);
    this.fromAddress = configService.get<string>('mail.from') || 'SEMS <noreply@sems.edu>';

    this.logger.log(
      `MailService inicializado | Transporte: ${this.transport.name} | From: ${this.fromAddress}`,
    );
  }

  /**
   * Verificación de conectividad al arrancar el módulo.
   * El resultado aparece en los logs del servidor (Render, PM2, etc.)
   * para diagnóstico inmediato sin necesidad de enviar un correo de prueba.
   */
  async onModuleInit() {
    try {
      await this.transport.verify();
      this.logger.log(`✅ [${this.transport.name}] Verificación exitosa — el servicio de correo está operativo`);
    } catch (err) {
      // No lanzamos para no bloquear el arranque; el error se registra claramente
      this.logger.warn(
        `⚠️  [${this.transport.name}] Verificación fallida: ${err.message}\n` +
        `   Compruebe las variables de entorno de correo en su panel de despliegue.`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEMPLATE BASE HTML
  // ════════════════════════════════════════════════════════════════════════════

  private buildBaseLayout(content: string): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>II Simposio Internacional de Ciencia Abierta</title>
  <style>
    .email-wrapper{width:100%;background-color:#f0f4f1;padding:20px 0;font-family:Arial,Helvetica,sans-serif;}
    .email-container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);}
    .info-box{background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;}
    .info-row{padding:8px 0;border-bottom:1px solid #d0e6d8;}
    .info-row:last-child{border-bottom:none;}
    .notes-box{background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;}
    .alert-box{background-color:#fef2f2;border-left:4px solid #dc2626;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;}
    ul{padding-left:20px;margin:15px 0;}
    li{color:#374840;font-size:14px;margin-bottom:5px;}
    a{color:#007F3A;text-decoration:underline;}
    @media only screen and (max-width:600px){
      .email-content{padding:20px!important;}
      .email-header{padding:15px 20px!important;}
      .footer-top,.footer-body{padding:15px 20px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f1;font-family:Arial,Helvetica,sans-serif;">
  <div style="background-color:#f0f4f1;padding:20px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">

      <!-- HEADER -->
      <div style="background-color:#003918;padding:20px 30px;color:white;">
        <div style="font-size:11px;color:#7ee8a2;text-transform:uppercase;margin-bottom:5px;">
          II Simposio Internacional de Ciencia Abierta
        </div>
        <div style="font-size:24px;font-weight:bold;margin-bottom:10px;">
          CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> 2026
        </div>
        <div style="font-size:12px;color:#a0d8b3;">
          <span style="margin-right:15px;">📅 18–22 mayo 2026</span>
          <span style="margin-right:15px;">📍 Cartagena de Indias</span>
          <span>🌐 Modalidad Híbrida</span>
        </div>
      </div>

      <!-- CONTENT -->
      <div class="email-content" style="padding:30px;color:#333333;line-height:1.6;">
        ${content}
      </div>

      <!-- FOOTER -->
      <div style="background-color:#003918;color:white;">
        <div style="background-color:#007F3A;padding:20px 30px;">
          <div style="font-size:16px;font-weight:bold;margin-bottom:10px;">
            CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> 2026
          </div>
          <div style="font-size:12px;color:#a0d8b3;">
            <span style="margin-right:15px;">🎓 80h certificadas</span>
            <span style="margin-right:15px;">👥 +500 participantes</span>
            <span>📚 6 ejes temáticos</span>
          </div>
        </div>
        <div style="padding:20px 30px;font-size:12px;color:#a0d8b3;">
          <div style="margin-bottom:10px;">
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Sitio oficial</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/pautas" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Pautas</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/verificar" style="color:#7ee8a2;text-decoration:none;margin-right:15px;">Verificar</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/agenda" style="color:#7ee8a2;text-decoration:none;">Agenda</a>
          </div>
          <div style="color:#6a8f76;">
            Este correo fue generado automáticamente por SEMS. Por favor no responda directamente.<br>
            © ${year} II Simposio Internacional de Ciencia Abierta · Cartagena de Indias, Colombia
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
  // SEND CORE — único punto de salida hacia el transporte activo
  // ════════════════════════════════════════════════════════════════════════════

  private async send(
    to: string,
    toName: string,
    subject: string,
    html: string,
    type: EmailType,
    relatedSubmissionId?: string,
    sentById?: string,
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
      });
      success = true;
      this.logger.log(`✅ Enviado a ${to} | ID: ${messageId}`);
    } catch (err) {
      errorMessage = err.message;
      this.logger.error(`❌ Error al enviar a ${to}: ${err.message}`);
    }

    // Persistir log sin bloquear la respuesta al cliente
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

    const receivedDate = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">
        Nos complace comunicarle que su postulación al <strong>II Simposio Internacional de Ciencia Abierta 2026</strong>
        ha sido <strong>recibida satisfactoriamente</strong> en nuestro sistema de gestión académica.
        En nombre del Comité Organizador, le agradecemos su interés en contribuir con su producción científica.
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
        ${submission.thematicAxis ? `
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Eje temático</span>
          <span style="color:#374840;">${submission.thematicAxis.name}</span>
        </div>` : ''}
        ${submission.productType ? `
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Tipo de producto</span>
          <span style="color:#374840;">${submission.productType.name}</span>
        </div>` : ''}
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
        <div style="font-size:12px;font-weight:bold;color:#92400e;text-transform:uppercase;margin-bottom:8px;">📌 Recuerde</div>
        <p style="color:#333333;margin:0;">
          Consulte el estado de su postulación en
          <a href="https://segundo-simposio-ciencia-abierta.netlify.app/verificar" style="color:#92400e;font-weight:600;">nuestro sitio web</a>
          con su correo electrónico.
        </p>
      </div>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con los mejores deseos académicos,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
        <p style="margin:5px 0;color:#999;font-size:12px;">Cartagena de Indias · 18–22 mayo 2026</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] Postulación recibida — ${submission.referenceCode}`,
      this.buildBaseLayout(content), EmailType.SUBMISSION_RECEIVED, submission.id,
    );
  }

  async sendStatusChanged(submission: Submission, newStatus: SubmissionStatus, notes?: string) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return;

    type StatusInfo = {
      label: string; badgeBg: string; badgeColor: string;
      headline: string; intro: string; closing: string; extra?: string;
    };

    const STATUS_MAP: Record<string, StatusInfo> = {
      under_review: {
        label: 'En Revisión', badgeBg: '#e0f2fe', badgeColor: '#0369a1',
        headline: 'Su postulación está siendo evaluada',
        intro: 'Su trabajo ha sido asignado al <strong>Comité Científico</strong> para su evaluación formal.',
        closing: 'Le informaremos el resultado a la brevedad. Agradecemos su paciencia.',
      },
      revision_requested: {
        label: 'Revisión Requerida', badgeBg: '#fef3c7', badgeColor: '#92400e',
        headline: 'Se requieren ajustes en su postulación',
        intro: 'Tras la revisión del Comité, se identificaron <strong>aspectos susceptibles de mejora</strong>. Por favor revise las observaciones adjuntas.',
        closing: 'Una vez realizadas las correcciones, contáctenos para coordinar la resubmisión.',
        extra: notes ? `
          <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
            <div style="font-size:12px;font-weight:bold;color:#92400e;text-transform:uppercase;margin-bottom:8px;">📋 Observaciones del Comité</div>
            <p style="color:#333333;margin:0;">${notes}</p>
          </div>` : '',
      },
      approved: {
        label: 'Aprobada', badgeBg: '#dcfce7', badgeColor: '#166534',
        headline: '¡Su postulación ha sido aprobada!',
        intro: 'Nos complace comunicarle que su trabajo ha sido <strong>aprobado por el Comité Científico</strong>.',
        closing: 'Próximamente recibirá información sobre la programación de su presentación.',
      },
      rejected: {
        label: 'No aprobada', badgeBg: '#fee2e2', badgeColor: '#991b1b',
        headline: 'Resultado de la evaluación',
        intro: 'Lamentamos informarle que su postulación <strong>no ha podido ser aprobada</strong> en la presente convocatoria.',
        closing: 'Le animamos a participar en futuras convocatorias. Agradecemos el esfuerzo dedicado.',
        extra: notes ? `
          <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:15px 20px;margin:20px 0;border-radius:0 4px 4px 0;">
            <p style="color:#333333;margin:0;"><strong style="color:#991b1b;">Observaciones:</strong> ${notes}</p>
          </div>` : '',
      },
      scheduled: {
        label: 'Programada', badgeBg: '#ede9fe', badgeColor: '#5b21b6',
        headline: '¡Su presentación ha sido programada!',
        intro: 'Su trabajo ha sido <strong>incluido en la agenda académica</strong> del Simposio.',
        closing: 'Próximamente recibirá los detalles completos de su presentación.',
      },
      withdrawn: {
        label: 'Retirada', badgeBg: '#dbeafe', badgeColor: '#1e40af',
        headline: 'Confirmación de retiro',
        intro: 'Le confirmamos que su postulación ha sido <strong>retirada del proceso</strong> conforme a su solicitud.',
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
        <div style="font-size:14px;font-weight:bold;color:#007F3A;text-transform:uppercase;margin-bottom:15px;">Información de su postulación</div>
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
        <p style="margin:5px 0;color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] ${info.headline} — ${submission.referenceCode}`,
      this.buildBaseLayout(content), EmailType.STATUS_CHANGED, submission.id,
    );
  }

  async sendScheduleAssigned(submission: Submission, slot: AgendaSlot) {
    const author = submission.authors?.find((a) => a.isCorresponding) ?? submission.authors?.[0];
    if (!author) return;

    const dayStr = new Date(slot.day).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${author.fullName},</div>
      <p style="color:#333333;margin-bottom:16px;">
        Su presentación ha sido <strong>oficialmente programada</strong> en la agenda del Simposio.
      </p>
      <div style="background-color:#f0f9f4;border-left:4px solid #007F3A;padding:20px;margin:20px 0;border-radius:0 4px 4px 0;">
        <div style="font-size:14px;font-weight:bold;color:#007F3A;text-transform:uppercase;margin-bottom:15px;">Detalles de su presentación</div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Código</span>
          <span style="font-family:'Courier New',monospace;font-weight:bold;color:#003918;">${submission.referenceCode}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Título</span>
          <span style="color:#374840;">${submission.titleEs}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Fecha</span>
          <span style="color:#374840;">${dayStr}</span>
        </div>
        <div style="padding:8px 0;border-bottom:1px solid #d0e6d8;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Horario</span>
          <span style="color:#374840;"><strong>${slot.startTime} – ${slot.endTime}</strong></span>
        </div>
        <div style="padding:8px 0;${slot.thematicAxis ? 'border-bottom:1px solid #d0e6d8;' : ''}">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Sala</span>
          <span style="color:#374840;">${slot.room || 'Por confirmar'}</span>
        </div>
        ${slot.thematicAxis ? `
        <div style="padding:8px 0;">
          <span style="font-weight:bold;color:#005c2a;display:inline-block;min-width:140px;">Eje temático</span>
          <span style="color:#374840;">${slot.thematicAxis.name}</span>
        </div>` : ''}
      </div>
      <div style="background-color:#007F3A;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;color:white;">
          Por favor <strong style="color:#7ee8a2;">confirme su asistencia</strong> antes del
          <strong style="color:#7ee8a2;">10 de mayo de 2026</strong>.
        </p>
      </div>
      <ul>
        <li>Prepare sus diapositivas en formato <strong>16:9 (widescreen)</strong></li>
        <li>Conéctese con al menos <strong>10 minutos de anticipación</strong></li>
        <li>Verifique micrófono, cámara y conexión a internet</li>
      </ul>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Con entusiasmo por su participación,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      author.email, author.fullName,
      `[SEMS] Su presentación ha sido programada — ${submission.referenceCode}`,
      this.buildBaseLayout(content), EmailType.SCHEDULE_ASSIGNED, submission.id,
    );
  }

  async sendCustomEmail(
    toEmail: string, toName: string, subject: string, body: string,
    submissionId?: string, sentById?: string,
  ) {
    const content = `
      <div style="font-size:18px;font-weight:bold;color:#003918;margin-bottom:20px;">Estimado/a ${toName},</div>
      <div style="height:1px;background-color:#e0e0e0;margin:25px 0;"></div>
      ${body}
      <div style="height:1px;background-color:#e0e0e0;margin:25px 0;"></div>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0;color:#666;">Atentamente,</p>
        <p style="margin:5px 0;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0;color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      toEmail, toName, subject,
      this.buildBaseLayout(content), EmailType.CUSTOM, submissionId, sentById,
    );
  }

  async findLogs(submissionId?: string) {
    const where = submissionId ? { relatedSubmissionId: submissionId } : {};
    return this.emailLogRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  /** Diagnóstico bajo demanda — útil desde un endpoint de health/admin */
  async testConnection(): Promise<{ ok: boolean; transport: string; message: string }> {
    try {
      await this.transport.verify();
      return { ok: true, transport: this.transport.name, message: 'Conexión verificada correctamente' };
    } catch (err) {
      return { ok: false, transport: this.transport.name, message: err.message };
    }
  }
}
