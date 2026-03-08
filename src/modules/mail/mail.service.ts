import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailLog, EmailType } from '../../entities/email-log.entity';
import { Submission } from '../../entities/submission.entity';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: false,
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    });
  }

  private async send(
    to: string,
    toName: string,
    subject: string,
    html: string,
    type: EmailType,
    relatedSubmissionId?: string,
    sentById?: string,
  ): Promise<boolean> {
    const from = this.configService.get<string>('mail.from');
    let success = false;
    let errorMessage: string | null = null;

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      success = true;
    } catch (err) {
      errorMessage = err.message;
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }

    await this.emailLogRepo.save(
      this.emailLogRepo.create({
        toEmail: to,
        toName,
        subject,
        body: html,
        type,
        relatedSubmissionId,
        success,
        errorMessage,
        sentById,
      }),
    );

    return success;
  }

  async sendSubmissionReceived(submission: Submission) {
    const correspondingAuthor = submission.authors.find((a) => a.isCorresponding) || submission.authors[0];
    if (!correspondingAuthor) return;

    const subject = `[SEMS] Postulación recibida - ${submission.referenceCode}`;
    const html = this.buildSubmissionReceivedEmail(submission, correspondingAuthor);

    return this.send(
      correspondingAuthor.email,
      correspondingAuthor.fullName,
      subject,
      html,
      EmailType.SUBMISSION_RECEIVED,
      submission.id,
    );
  }

  async sendStatusChanged(
    submission: Submission,
    newStatus: SubmissionStatus,
    notes?: string,
  ) {
    const correspondingAuthor = submission.authors.find((a) => a.isCorresponding) || submission.authors[0];
    if (!correspondingAuthor) return;

    const statusLabels: Record<string, string> = {
      under_review: 'En Revisión',
      revision_requested: 'Revisión Requerida',
      approved: 'Aprobada',
      rejected: 'Rechazada',
      withdrawn: 'Retirada',
      scheduled: 'Programada en Agenda',
    };

    const subject = `[SEMS] Estado de su postulación actualizado - ${submission.referenceCode}`;
    const html = this.buildStatusChangedEmail(submission, correspondingAuthor, statusLabels[newStatus] || newStatus, notes);

    return this.send(
      correspondingAuthor.email,
      correspondingAuthor.fullName,
      subject,
      html,
      EmailType.STATUS_CHANGED,
      submission.id,
    );
  }

  async sendScheduleAssigned(submission: Submission, slot: AgendaSlot) {
    const correspondingAuthor = submission.authors.find((a) => a.isCorresponding) || submission.authors[0];
    if (!correspondingAuthor) return;

    const subject = `[SEMS] Horario asignado - ${submission.referenceCode}`;
    const html = this.buildScheduleAssignedEmail(submission, correspondingAuthor, slot);

    return this.send(
      correspondingAuthor.email,
      correspondingAuthor.fullName,
      subject,
      html,
      EmailType.SCHEDULE_ASSIGNED,
      submission.id,
    );
  }

  async sendCustomEmail(
    toEmail: string,
    toName: string,
    subject: string,
    body: string,
    submissionId?: string,
    sentById?: string,
  ) {
    return this.send(toEmail, toName, subject, body, EmailType.CUSTOM, submissionId, sentById);
  }

  async findLogs(submissionId?: string) {
    const where = submissionId ? { relatedSubmissionId: submissionId } : {};
    return this.emailLogRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  private buildBaseLayout(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Roboto', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #007F3A; padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
          .header p { color: rgba(255,255,255,0.85); margin: 5px 0 0; font-size: 14px; }
          .body { padding: 30px; }
          .body p { color: #333; line-height: 1.6; }
          .info-box { background: #f0f9f4; border-left: 4px solid #007F3A; padding: 15px 20px; margin: 20px 0; border-radius: 0 4px 4px 0; }
          .info-box strong { color: #007F3A; }
          .badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 13px; font-weight: bold; }
          .badge-approved { background: #d4edda; color: #155724; }
          .badge-rejected { background: #f8d7da; color: #721c24; }
          .badge-revision { background: #fff3cd; color: #856404; }
          .badge-review { background: #cce5ff; color: #004085; }
          .badge-scheduled { background: #e2d9f3; color: #4a0080; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
          .btn { display: inline-block; background: #007F3A; color: white !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
          .accent { color: #E60553; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sistema de Gestión de Eventos Científicos</h1>
            <p>Scientific Event Management System - SEMS</p>
          </div>
          <div class="body">
            ${content}
          </div>
          <div class="footer">
            <p>Este es un mensaje automático. Por favor no responda a este correo.</p>
            <p>© ${new Date().getFullYear()} SEMS - Sistema de Gestión de Eventos Científicos</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private buildSubmissionReceivedEmail(submission: Submission, author: any): string {
    const content = `
      <h2>¡Postulación Recibida!</h2>
      <p>Estimado/a <strong>${author.fullName}</strong>,</p>
      <p>Hemos recibido su postulación exitosamente. A continuación encontrará el resumen de la misma:</p>
      <div class="info-box">
        <p><strong>Código de Referencia:</strong> ${submission.referenceCode}</p>
        <p><strong>Título:</strong> ${submission.titleEs}</p>
        <p><strong>Eje Temático:</strong> ${submission.thematicAxis?.name || 'N/A'}</p>
        <p><strong>Tipo de Producto:</strong> ${submission.productType?.name || 'N/A'}</p>
        <p><strong>Fecha de Recepción:</strong> ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Estado:</strong> <span class="badge badge-review">Recibida</span></p>
      </div>
      <p>Su postulación será revisada por nuestro comité científico. Le notificaremos sobre cualquier cambio en el estado de su postulación.</p>
      <p>Por favor, guarde su código de referencia <strong class="accent">${submission.referenceCode}</strong> para futuras consultas.</p>
      <p>Saludos cordiales,<br><strong>Comité Organizador</strong></p>
    `;
    return this.buildBaseLayout('Postulación Recibida', content);
  }

  private buildStatusChangedEmail(
    submission: Submission,
    author: any,
    statusLabel: string,
    notes?: string,
  ): string {
    const badgeClass = {
      'Aprobada': 'badge-approved',
      'Rechazada': 'badge-rejected',
      'Revisión Requerida': 'badge-revision',
      'En Revisión': 'badge-review',
      'Programada en Agenda': 'badge-scheduled',
    }[statusLabel] || 'badge-review';

    const content = `
      <h2>Actualización de Estado</h2>
      <p>Estimado/a <strong>${author.fullName}</strong>,</p>
      <p>Le informamos que el estado de su postulación ha sido actualizado:</p>
      <div class="info-box">
        <p><strong>Código de Referencia:</strong> ${submission.referenceCode}</p>
        <p><strong>Título:</strong> ${submission.titleEs}</p>
        <p><strong>Nuevo Estado:</strong> <span class="badge ${badgeClass}">${statusLabel}</span></p>
        ${notes ? `<p><strong>Observaciones:</strong> ${notes}</p>` : ''}
      </div>
      ${notes ? '<p>Por favor revise las observaciones indicadas y tome las acciones necesarias.</p>' : ''}
      <p>Para consultas sobre su postulación, comuníquese con el comité organizador citando su código de referencia.</p>
      <p>Saludos cordiales,<br><strong>Comité Organizador</strong></p>
    `;
    return this.buildBaseLayout('Estado de Postulación Actualizado', content);
  }

  private buildScheduleAssignedEmail(submission: Submission, author: any, slot: AgendaSlot): string {
    const dayStr = new Date(slot.day).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const content = `
      <h2>¡Horario Asignado!</h2>
      <p>Estimado/a <strong>${author.fullName}</strong>,</p>
      <p>Nos complace informarle que su presentación ha sido programada en la agenda del evento:</p>
      <div class="info-box">
        <p><strong>Código de Referencia:</strong> ${submission.referenceCode}</p>
        <p><strong>Título:</strong> ${submission.titleEs}</p>
        <p><strong>Fecha:</strong> ${dayStr}</p>
        <p><strong>Horario:</strong> ${slot.startTime} - ${slot.endTime}</p>
        <p><strong>Sala/Sala:</strong> ${slot.room || 'Por confirmar'}</p>
        ${slot.thematicAxis ? `<p><strong>Eje Temático:</strong> ${slot.thematicAxis.name}</p>` : ''}
      </div>
      <p>Por favor, confirme su participación respondiendo a este correo o contactando al equipo organizador.</p>
      <p>Saludos cordiales,<br><strong>Comité Organizador</strong></p>
    `;
    return this.buildBaseLayout('Horario de Presentación Asignado', content);
  }
}
