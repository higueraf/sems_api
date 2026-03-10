/**
 * SmtpTransport
 * ─────────────────────────────────────────────────────────────────────────────
 * Transporte basado en nodemailer/SMTP.
 *
 * Cuándo usar este transporte:
 *  - Servidores propios, VPS o cualquier host que NO bloquee el puerto 587
 *  - Desarrollo local (siempre funciona)
 *  - Render con plan de pago (tienen SMTP habilitado)
 *  - Hostinger, DigitalOcean, Railway, Fly.io, etc.
 *
 * Variables de entorno requeridas:
 *  MAIL_TRANSPORT = smtp   (o simplemente omitir RESEND_API_KEY)
 *  MAIL_HOST      = smtp.gmail.com
 *  MAIL_PORT      = 587
 *  MAIL_USER      = tu@gmail.com
 *  MAIL_PASS      = tu_app_password_de_16_caracteres
 *  MAIL_FROM      = "Nombre <tu@gmail.com>"
 */
import * as nodemailer from 'nodemailer';
import { MailTransport, MailSendOptions } from './mail-transport.interface';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export class SmtpTransport implements MailTransport {
  readonly name = 'SMTP (nodemailer)';
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,      // false = STARTTLS en puerto 587 (recomendado)
      requireTLS: true,   // fuerza STARTTLS; rechaza conexiones sin cifrado
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false, // compatibilidad con CAs intermedios de Gmail
      },
      connectionTimeout: 30_000,
      greetingTimeout:   20_000,
      socketTimeout:     60_000,
    });
  }

  async verify(): Promise<void> {
    // nodemailer.verify() hace un handshake SMTP real
    await this.transporter.verify();
  }

  async send(options: MailSendOptions): Promise<string> {
    const result = await this.transporter.sendMail({
      from:    options.from,
      to:      options.to,
      subject: options.subject,
      html:    options.html,
    });
    return result.messageId ?? 'smtp-no-id';
  }
}
