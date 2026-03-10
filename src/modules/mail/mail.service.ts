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

    this.logger.log('MailService initialized with host: ' + this.configService.get<string>('mail.host'));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEMPLATE BASE — encabezado y pie de página con el branding del simposio
  // ════════════════════════════════════════════════════════════════════════════

  private buildBaseLayout(content: string): string {
    const year = new Date().getFullYear();
    
    // Versión simplificada y compatible con clientes de correo
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>II Simposio Internacional de Ciencia Abierta</title>
  <style>
    /* Estilos inline para mejor compatibilidad con clientes de correo */
    .email-wrapper {
      width: 100%;
      background-color: #f0f4f1;
      padding: 20px 0;
      font-family: Arial, Helvetica, sans-serif;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    /* Header */
    .email-header {
      background-color: #003918;
      padding: 20px 30px;
      color: white;
    }
    .email-header-subtitle {
      font-size: 11px;
      font-weight: normal;
      text-transform: uppercase;
      color: #7ee8a2;
      margin-bottom: 5px;
    }
    .email-header-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .email-header-title span {
      color: #7ee8a2;
    }
    .email-header-meta {
      font-size: 12px;
      color: #a0d8b3;
    }
    .email-header-meta span {
      margin-right: 15px;
    }
    /* Content */
    .email-content {
      padding: 30px;
      color: #333333;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: bold;
      color: #003918;
      margin-bottom: 20px;
    }
    /* Info Box */
    .info-box {
      background-color: #f0f9f4;
      border-left: 4px solid #007F3A;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 4px 4px 0;
    }
    .info-box-title {
      font-size: 14px;
      font-weight: bold;
      color: #007F3A;
      text-transform: uppercase;
      margin-bottom: 15px;
    }
    .info-row {
      padding: 8px 0;
      border-bottom: 1px solid #d0e6d8;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: bold;
      color: #005c2a;
      display: inline-block;
      width: 140px;
    }
    .info-value {
      color: #374840;
    }
    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
    .badge-received { background: #dbeafe; color: #1e40af; }
    .badge-review { background: #e0f2fe; color: #0369a1; }
    .badge-revision { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dcfce7; color: #166534; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-scheduled { background: #ede9fe; color: #5b21b6; }
    /* Reference Code */
    .ref-code-block {
      background-color: #003918;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
    .ref-code-label {
      font-size: 12px;
      color: #7ee8a2;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .ref-code-value {
      font-family: 'Courier New', monospace;
      font-size: 24px;
      font-weight: bold;
      color: #7ee8a2;
    }
    /* Notes Box */
    .notes-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 4px 4px 0;
    }
    .notes-box-title {
      font-size: 12px;
      font-weight: bold;
      color: #92400e;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    /* Alert Box */
    .alert-box {
      background-color: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 4px 4px 0;
    }
    /* Success Box */
    .success-box {
      background-color: #007F3A;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
      color: white;
    }
    .success-box strong {
      color: #7ee8a2;
    }
    /* Divider */
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 25px 0;
    }
    /* Signature */
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .signature p {
      margin: 5px 0;
      color: #666;
    }
    .signature strong {
      color: #003918;
    }
    .signature .title {
      color: #007F3A;
    }
    /* Footer */
    .email-footer {
      background-color: #003918;
      color: white;
    }
    .footer-top {
      background-color: #007F3A;
      padding: 20px 30px;
    }
    .footer-brand {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .footer-brand span {
      color: #7ee8a2;
    }
    .footer-stats {
      font-size: 12px;
      color: #a0d8b3;
    }
    .footer-stats span {
      margin-right: 15px;
    }
    .footer-body {
      padding: 20px 30px;
      font-size: 12px;
      color: #a0d8b3;
    }
    .footer-links {
      margin-bottom: 10px;
    }
    .footer-links a {
      color: #7ee8a2;
      text-decoration: none;
      margin-right: 15px;
    }
    .footer-info {
      color: #6a8f76;
    }
    .footer-accent {
      height: 4px;
      background: linear-gradient(90deg, #007F3A, #E60553, #007F3A);
    }
    /* Lists */
    ul {
      padding-left: 20px;
      margin: 15px 0;
    }
    li {
      color: #374840;
      font-size: 14px;
      margin-bottom: 5px;
    }
    /* Links */
    a {
      color: #007F3A;
      text-decoration: underline;
    }
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-content { padding: 20px; }
      .email-header { padding: 15px 20px; }
      .footer-top, .footer-body { padding: 15px 20px; }
      .info-label { display: block; width: auto; margin-bottom: 5px; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f0f4f1; font-family:Arial, Helvetica, sans-serif;">
  <div class="email-wrapper" style="background-color:#f0f4f1; padding:20px 0;">
    <div class="email-container" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
      
      <!-- HEADER -->
      <div class="email-header" style="background-color:#003918; padding:20px 30px; color:white;">
        <div class="email-header-subtitle" style="font-size:11px; color:#7ee8a2; text-transform:uppercase; margin-bottom:5px;">
          II Simposio Internacional de Ciencia Abierta
        </div>
        <div class="email-header-title" style="font-size:24px; font-weight:bold; margin-bottom:10px;">
          CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> 2026
        </div>
        <div class="email-header-meta" style="font-size:12px; color:#a0d8b3;">
          <span>📅 18–22 mayo 2026</span>
          <span>📍 Cartagena de Indias</span>
          <span>🌐 Modalidad Híbrida</span>
        </div>
      </div>

      <!-- CONTENT -->
      <div class="email-content" style="padding:30px; color:#333333; line-height:1.6;">
        ${content}
      </div>

      <!-- FOOTER -->
      <div class="email-footer" style="background-color:#003918; color:white;">
        <div class="footer-top" style="background-color:#007F3A; padding:20px 30px;">
          <div class="footer-brand" style="font-size:16px; font-weight:bold; margin-bottom:10px;">
            CIENCIA <span style="color:#7ee8a2;">ABIERTA</span> 2026
          </div>
          <div class="footer-stats" style="font-size:12px; color:#a0d8b3;">
            <span>🎓 80h certificadas</span>
            <span>👥 +500 participantes</span>
            <span>📚 6 ejes temáticos</span>
          </div>
        </div>
        <div class="footer-body" style="padding:20px 30px; font-size:12px; color:#a0d8b3;">
          <div class="footer-links" style="margin-bottom:10px;">
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app" style="color:#7ee8a2; text-decoration:none; margin-right:15px;">Sitio oficial</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/pautas" style="color:#7ee8a2; text-decoration:none; margin-right:15px;">Pautas</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/verificar" style="color:#7ee8a2; text-decoration:none; margin-right:15px;">Verificar</a>
            <a href="https://segundo-simposio-ciencia-abierta.netlify.app/agenda" style="color:#7ee8a2; text-decoration:none;">Agenda</a>
          </div>
          <div class="footer-info" style="color:#6a8f76;">
            Este correo fue generado automáticamente por SEMS. Por favor no responda directamente a este mensaje.<br>
            © ${year} II Simposio Internacional de Ciencia Abierta · Cartagena de Indias, Colombia
          </div>
        </div>
        <div class="footer-accent" style="height:4px; background:linear-gradient(90deg, #007F3A, #E60553, #007F3A);"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEND CORE
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
    const from = this.configService.get<string>('mail.from');
    let success = false;
    let errorMessage: string | null = null;

    this.logger.debug(`Attempting to send email to ${to} (${toName})`);
    this.logger.debug(`Subject: ${subject}`);
    this.logger.debug(`HTML size: ${html.length} bytes`);

    try {
      const mailOptions = {
        from,
        to,
        subject,
        html,
      };

      this.logger.debug('Mail options:', mailOptions);
      
      const result = await this.transporter.sendMail(mailOptions);
      success = true;
      this.logger.log(`Email sent successfully to ${to}, messageId: ${result.messageId}`);
    } catch (err) {
      errorMessage = err.message;
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
    }

    try {
      await this.emailLogRepo.save(
        this.emailLogRepo.create({
          toEmail: to,
          toName,
          subject,
          body: html.substring(0, 1000), // Guardar solo los primeros 1000 chars para no saturar la DB
          type,
          relatedSubmissionId,
          success,
          errorMessage,
          sentById,
        }),
      );
      this.logger.debug('Email log saved to database');
    } catch (logError) {
      this.logger.error(`Failed to save email log: ${logError.message}`);
    }

    return success;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CORREOS AUTOMÁTICOS — mensajes prolijos y profesionales
  // ════════════════════════════════════════════════════════════════════════════

  async sendSubmissionReceived(submission: Submission) {
    const author = submission.authors?.find((a) => a.isCorresponding) || submission.authors?.[0];
    if (!author) {
      this.logger.error(`No author found for submission ${submission.id}`);
      return;
    }

    this.logger.log(`Preparing SUBMISSION_RECEIVED email for ${author.email}`);

    const receivedDate = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div class="greeting" style="font-size:18px; font-weight:bold; color:#003918; margin-bottom:20px;">
        Estimado/a ${author.fullName},
      </div>

      <p style="color:#333333; margin-bottom:16px;">
        Nos complace comunicarle que su postulación al <strong>II Simposio Internacional de Ciencia Abierta 2026</strong>
        ha sido <strong>recibida satisfactoriamente</strong> en nuestro sistema de gestión académica.
        En nombre del Comité Organizador, le damos la más cordial bienvenida y le agradecemos sinceramente
        su interés en contribuir con su producción científica a este importante espacio de divulgación y debate académico.
      </p>

      <div class="ref-code-block" style="background-color:#003918; border-radius:8px; padding:20px; margin:20px 0; text-align:center;">
        <div class="ref-code-label" style="font-size:12px; color:#7ee8a2; text-transform:uppercase; margin-bottom:5px;">
          Su código de referencia
        </div>
        <div class="ref-code-value" style="font-family:'Courier New', monospace; font-size:24px; font-weight:bold; color:#7ee8a2;">
          ${submission.referenceCode}
        </div>
      </div>

      <div class="info-box" style="background-color:#f0f9f4; border-left:4px solid #007F3A; padding:20px; margin:20px 0; border-radius:0 4px 4px 0;">
        <div class="info-box-title" style="font-size:14px; font-weight:bold; color:#007F3A; text-transform:uppercase; margin-bottom:15px;">
          Resumen de su postulación
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Título</span>
          <span class="info-value" style="color:#374840;">${submission.titleEs || 'No especificado'}</span>
        </div>
        ${submission.thematicAxis ? `
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Eje temático</span>
          <span class="info-value" style="color:#374840;">${submission.thematicAxis.name || 'No especificado'}</span>
        </div>` : ''}
        ${submission.productType ? `
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Tipo de producto</span>
          <span class="info-value" style="color:#374840;">${submission.productType.name || 'No especificado'}</span>
        </div>` : ''}
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Fecha de recepción</span>
          <span class="info-value" style="color:#374840;">${receivedDate}</span>
        </div>
        <div class="info-row" style="padding:8px 0;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Estado actual</span>
          <span class="info-value" style="color:#374840;">
            <span class="badge badge-received" style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; background:#dbeafe; color:#1e40af;">Recibida</span>
          </span>
        </div>
      </div>

      <p style="color:#333333; margin-bottom:16px;">
        Su trabajo ha ingresado al proceso de <strong>evaluación por parte de nuestro Comité Científico</strong>,
        conformado por investigadores con amplia trayectoria académica. Este proceso contempla la revisión de criterios
        de pertinencia temática, calidad metodológica, originalidad y adecuación a las pautas de publicación del simposio.
      </p>

      <p style="color:#333333; margin-bottom:16px;">
        Le notificaremos oportunamente por este mismo medio sobre cualquier actualización en el estado de su postulación.
        Le recomendamos <strong>conservar su código de referencia</strong>, ya que será el identificador único
        para todas las consultas y comunicaciones relacionadas con su trabajo.
      </p>

      <div class="notes-box" style="background-color:#fffbeb; border-left:4px solid #f59e0b; padding:15px 20px; margin:20px 0; border-radius:0 4px 4px 0;">
        <div class="notes-box-title" style="font-size:12px; font-weight:bold; color:#92400e; text-transform:uppercase; margin-bottom:8px;">
          📌 Recuerde
        </div>
        <p style="color:#333333; margin:0;">
          Puede consultar el estado de su postulación en cualquier momento ingresando a
          <a href="https://segundo-simposio-ciencia-abierta.netlify.app/verificar" style="color:#92400e; font-weight:600; text-decoration:underline;">
            nuestro sitio web
          </a>
          con su dirección de correo electrónico.
        </p>
      </div>

      <div class="signature" style="margin-top:30px; padding-top:20px; border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0; color:#666;">Con los mejores deseos académicos,</p>
        <p style="margin:5px 0; color:#666;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0; color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
        <p style="margin:5px 0; color:#999; font-size:12px;">Cartagena de Indias, Colombia · 18–22 de mayo de 2026</p>
      </div>
    `;

    return this.send(
      author.email,
      author.fullName,
      `[SEMS] Postulación recibida exitosamente — ${submission.referenceCode}`,
      this.buildBaseLayout(content),
      EmailType.SUBMISSION_RECEIVED,
      submission.id,
    );
  }

  async sendStatusChanged(submission: Submission, newStatus: SubmissionStatus, notes?: string) {
    const author = submission.authors?.find((a) => a.isCorresponding) || submission.authors?.[0];
    if (!author) {
      this.logger.error(`No author found for submission ${submission.id}`);
      return;
    }

    this.logger.log(`Preparing STATUS_CHANGED email for ${author.email} - New status: ${newStatus}`);

    const STATUS_INFO: Record<string, {
      label: string; badge: string; badgeColor: string; badgeBg: string;
      headline: string; intro: string; closing: string; extra?: string;
    }> = {
      under_review: {
        label: 'En Revisión', badge: 'badge-review', badgeBg: '#e0f2fe', badgeColor: '#0369a1',
        headline: 'Su postulación está siendo evaluada',
        intro: `Su trabajo ha sido asignado al <strong>Comité Científico</strong> para su evaluación formal.
          Nuestros revisores están analizando en detalle el contenido, la metodología y la pertinencia
          de su propuesta en relación con los lineamientos del simposio.`,
        closing: `Le informaremos el resultado de la evaluación a la brevedad posible.
          Agradecemos su paciencia durante este proceso.`,
      },
      revision_requested: {
        label: 'Revisión Requerida', badge: 'badge-revision', badgeBg: '#fef3c7', badgeColor: '#92400e',
        headline: 'Se requieren ajustes en su postulación',
        intro: `Tras la revisión inicial por parte del Comité Científico, se han identificado
          <strong>aspectos susceptibles de mejora</strong> en su trabajo. Le invitamos a revisar
          cuidadosamente las observaciones adjuntas y a realizar los ajustes correspondientes
          para que su postulación pueda ser considerada nuevamente.`,
        closing: `Una vez realizadas las correcciones, comuníquese con el equipo organizador
          para coordinar la resubmisión de su trabajo. Confiamos en que, con los ajustes indicados,
          su propuesta cumplirá plenamente los estándares del simposio.`,
        extra: notes ? `
          <div class="notes-box" style="background-color:#fffbeb; border-left:4px solid #f59e0b; padding:15px 20px; margin:20px 0; border-radius:0 4px 4px 0;">
            <div class="notes-box-title" style="font-size:12px; font-weight:bold; color:#92400e; text-transform:uppercase; margin-bottom:8px;">
              📋 Observaciones del Comité Científico
            </div>
            <p style="color:#333333; margin:0;">${notes}</p>
          </div>` : '',
      },
      approved: {
        label: 'Aprobada', badge: 'badge-approved', badgeBg: '#dcfce7', badgeColor: '#166534',
        headline: '¡Su postulación ha sido aprobada!',
        intro: `Nos complace comunicarle que su trabajo ha sido <strong>aprobado por el Comité Científico</strong>
          del II Simposio Internacional de Ciencia Abierta 2026. Esta decisión refleja la calidad
          y pertinencia de su propuesta, y nos llena de satisfacción poder contar con su contribución
          académica en este importante evento.`,
        closing: `En los próximos días recibirá información detallada sobre la programación de su presentación,
          incluyendo fecha, hora y modalidad asignadas. Le solicitamos estar atento/a a nuestras comunicaciones.`,
      },
      rejected: {
        label: 'No aprobada', badge: 'badge-rejected', badgeBg: '#fee2e2', badgeColor: '#991b1b',
        headline: 'Resultado de la evaluación de su postulación',
        intro: `Luego del proceso de evaluación llevado a cabo por nuestro Comité Científico,
          lamentamos informarle que su postulación <strong>no ha podido ser aprobada</strong>
          en la presente convocatoria. Esta decisión se ha tomado considerando los criterios
          de pertinencia, calidad metodológica y los lineamientos del simposio.`,
        closing: `Le animamos a tomar en cuenta las observaciones recibidas como una oportunidad
          de crecimiento académico, y le invitamos a participar en futuras convocatorias del simposio.
          Agradecemos sinceramente el tiempo y esfuerzo dedicados a su postulación.`,
        extra: notes ? `
          <div class="alert-box" style="background-color:#fef2f2; border-left:4px solid #dc2626; padding:15px 20px; margin:20px 0; border-radius:0 4px 4px 0;">
            <p style="color:#333333; margin:0;"><strong style="color:#991b1b;">Observaciones del Comité:</strong> ${notes}</p>
          </div>` : '',
      },
      scheduled: {
        label: 'Programada en Agenda', badge: 'badge-scheduled', badgeBg: '#ede9fe', badgeColor: '#5b21b6',
        headline: '¡Su presentación ha sido programada!',
        intro: `Tenemos el agrado de comunicarle que su trabajo ha sido <strong>incluido oficialmente
          en la agenda académica</strong> del II Simposio Internacional de Ciencia Abierta 2026.
          Próximamente recibirá un correo con los detalles completos de su presentación.`,
        closing: `Le recomendamos preparar su presentación con anticipación y familiarizarse con los
          recursos técnicos disponibles en la plataforma del evento. Estaremos encantados de apoyarle
          en todo lo que necesite.`,
      },
      withdrawn: {
        label: 'Retirada', badge: 'badge-received', badgeBg: '#dbeafe', badgeColor: '#1e40af',
        headline: 'Confirmación de retiro de postulación',
        intro: `Le confirmamos que su postulación ha sido <strong>retirada del proceso</strong>
          de evaluación del II Simposio Internacional de Ciencia Abierta 2026, conforme a su solicitud.`,
        closing: `Si en algún momento desea postular nuevamente o tiene alguna consulta,
          no dude en comunicarse con nuestro equipo organizador.`,
      },
    };

    const info = STATUS_INFO[newStatus] || {
      label: newStatus, badge: 'badge-review', badgeBg: '#e0f2fe', badgeColor: '#0369a1',
      headline: 'Actualización en su postulación',
      intro: 'El estado de su postulación ha sido actualizado.',
      closing: 'Para consultas, contacte al equipo organizador.',
    };

    const content = `
      <div class="greeting" style="font-size:18px; font-weight:bold; color:#003918; margin-bottom:20px;">
        Estimado/a ${author.fullName},
      </div>

      <p style="color:#333333; margin-bottom:16px;">${info.intro}</p>

      <div class="info-box" style="background-color:#f0f9f4; border-left:4px solid #007F3A; padding:20px; margin:20px 0; border-radius:0 4px 4px 0;">
        <div class="info-box-title" style="font-size:14px; font-weight:bold; color:#007F3A; text-transform:uppercase; margin-bottom:15px;">
          Información de su postulación
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Código de referencia</span>
          <span class="info-value" style="font-family:'Courier New', monospace; font-weight:bold; color:#003918;">${submission.referenceCode}</span>
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Título</span>
          <span class="info-value" style="color:#374840;">${submission.titleEs || 'No especificado'}</span>
        </div>
        <div class="info-row" style="padding:8px 0;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Nuevo estado</span>
          <span class="info-value" style="color:#374840;">
            <span class="badge" style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; background:${info.badgeBg}; color:${info.badgeColor};">${info.label}</span>
          </span>
        </div>
      </div>

      ${info.extra || ''}

      <p style="color:#333333; margin-bottom:16px;">${info.closing}</p>

      <div class="signature" style="margin-top:30px; padding-top:20px; border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0; color:#666;">Cordialmente,</p>
        <p style="margin:5px 0; color:#666;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0; color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      author.email,
      author.fullName,
      `[SEMS] ${info.headline} — ${submission.referenceCode}`,
      this.buildBaseLayout(content),
      EmailType.STATUS_CHANGED,
      submission.id,
    );
  }

  async sendScheduleAssigned(submission: Submission, slot: AgendaSlot) {
    const author = submission.authors?.find((a) => a.isCorresponding) || submission.authors?.[0];
    if (!author) {
      this.logger.error(`No author found for submission ${submission.id}`);
      return;
    }

    this.logger.log(`Preparing SCHEDULE_ASSIGNED email for ${author.email}`);

    const dayStr = new Date(slot.day).toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const content = `
      <div class="greeting" style="font-size:18px; font-weight:bold; color:#003918; margin-bottom:20px;">
        Estimado/a ${author.fullName},
      </div>

      <p style="color:#333333; margin-bottom:16px;">
        Nos complace informarle que su presentación ha sido <strong>oficialmente programada</strong>
        en la agenda académica del II Simposio Internacional de Ciencia Abierta 2026.
        A continuación encontrará los detalles de su participación:
      </p>

      <div class="info-box" style="background-color:#f0f9f4; border-left:4px solid #007F3A; padding:20px; margin:20px 0; border-radius:0 4px 4px 0;">
        <div class="info-box-title" style="font-size:14px; font-weight:bold; color:#007F3A; text-transform:uppercase; margin-bottom:15px;">
          Detalles de su presentación
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Código</span>
          <span class="info-value" style="font-family:'Courier New', monospace; font-weight:bold; color:#003918;">${submission.referenceCode}</span>
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Título</span>
          <span class="info-value" style="color:#374840;">${submission.titleEs || 'No especificado'}</span>
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Fecha</span>
          <span class="info-value" style="color:#374840;">${dayStr}</span>
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Horario</span>
          <span class="info-value" style="color:#374840;"><strong>${slot.startTime} – ${slot.endTime}</strong></span>
        </div>
        <div class="info-row" style="padding:8px 0; border-bottom:1px solid #d0e6d8;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Sala / Espacio</span>
          <span class="info-value" style="color:#374840;">${slot.room || 'Por confirmar'}</span>
        </div>
        ${slot.thematicAxis ? `
        <div class="info-row" style="padding:8px 0;">
          <span class="info-label" style="font-weight:bold; color:#005c2a; display:inline-block; width:140px;">Eje temático</span>
          <span class="info-value" style="color:#374840;">${slot.thematicAxis.name}</span>
        </div>` : ''}
      </div>

      <div class="success-box" style="background-color:#007F3A; border-radius:8px; padding:20px; margin:20px 0; text-align:center; color:white;">
        <p style="margin:0; color:white;">
          Le solicitamos <strong style="color:#7ee8a2;">confirmar su asistencia</strong> respondiendo a esta notificación
          o contactando al equipo organizador antes del <strong style="color:#7ee8a2;">10 de mayo de 2026</strong>.
        </p>
      </div>

      <p style="color:#333333; margin-bottom:16px;">
        Para garantizar el óptimo desarrollo de su presentación, le recomendamos:
      </p>
      <ul style="padding-left:20px; margin-bottom:16px; color:#374840;">
        <li style="margin-bottom:6px;">Preparar sus diapositivas en formato <strong>16:9 (widescreen)</strong></li>
        <li style="margin-bottom:6px;">Conectarse a la plataforma con al menos <strong>10 minutos de anticipación</strong></li>
        <li style="margin-bottom:6px;">Verificar el funcionamiento de su micrófono, cámara y conexión a internet</li>
        <li style="margin-bottom:6px;">Tener a mano el enlace de acceso a la sesión virtual</li>
      </ul>

      <div class="signature" style="margin-top:30px; padding-top:20px; border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0; color:#666;">Con entusiasmo por su participación,</p>
        <p style="margin:5px 0; color:#666;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0; color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      author.email,
      author.fullName,
      `[SEMS] Su presentación ha sido programada — ${submission.referenceCode}`,
      this.buildBaseLayout(content),
      EmailType.SCHEDULE_ASSIGNED,
      submission.id,
    );
  }

  // ── Correo personalizado — recibe HTML del editor WYSIWYG ─────────────────
  async sendCustomEmail(
    toEmail: string,
    toName: string,
    subject: string,
    body: string,  // HTML enriquecido del editor Quill
    submissionId?: string,
    sentById?: string,
  ) {
    this.logger.log(`Preparing CUSTOM email for ${toEmail}`);

    const content = `
      <div class="greeting" style="font-size:18px; font-weight:bold; color:#003918; margin-bottom:20px;">
        Estimado/a ${toName},
      </div>
      <div class="divider" style="height:1px; background-color:#e0e0e0; margin:25px 0;"></div>
      <div class="custom-content">${body}</div>
      <div class="divider" style="height:1px; background-color:#e0e0e0; margin:25px 0;"></div>
      <div class="signature" style="margin-top:30px; padding-top:20px; border-top:1px solid #e0e0e0;">
        <p style="margin:5px 0; color:#666;">Atentamente,</p>
        <p style="margin:5px 0; color:#666;"><strong style="color:#003918;">Comité Organizador</strong></p>
        <p style="margin:5px 0; color:#007F3A;">II Simposio Internacional de Ciencia Abierta 2026</p>
      </div>
    `;

    return this.send(
      toEmail,
      toName,
      subject,
      this.buildBaseLayout(content),
      EmailType.CUSTOM,
      submissionId,
      sentById,
    );
  }

  async findLogs(submissionId?: string) {
    const where = submissionId ? { relatedSubmissionId: submissionId } : {};
    return this.emailLogRepo.find({ 
      where, 
      order: { createdAt: 'DESC' },
      take: 100, // Limitar a 100 registros
    });
  }

  // Método de prueba para verificar la configuración
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error(`SMTP connection failed: ${error.message}`);
      return false;
    }
  }
}