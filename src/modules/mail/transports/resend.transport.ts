/**
 * ResendTransport
 * ─────────────────────────────────────────────────────────────────────────────
 * Transporte basado en la API REST de Resend (https://resend.com).
 *
 * Cuándo usar este transporte:
 *  - Render (plan gratuito) — bloquea SMTP saliente
 *  - Vercel, Netlify Functions, AWS Lambda y cualquier entorno serverless
 *  - Cualquier host que bloquee el puerto 587 / 465 / 25
 *
 * Variables de entorno requeridas:
 *  MAIL_TRANSPORT  = resend
 *  RESEND_API_KEY  = re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *  MAIL_FROM       = "Nombre <noreply@tu-dominio-verificado.com>"
 *
 * Nota sobre el remitente:
 *  El dominio del MAIL_FROM debe estar verificado en el panel de Resend.
 *  Para pruebas sin dominio propio usar: onboarding@resend.dev
 *  (solo entrega al email del dueño de la cuenta Resend).
 */
import { Resend } from 'resend';
import { MailTransport, MailSendOptions } from './mail-transport.interface';

export class ResendTransport implements MailTransport {
  readonly name = 'Resend (API REST)';
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async verify(): Promise<void> {
    // Llamada ligera para validar que la API key existe y es válida
    const { error } = await this.client.domains.list();
    if (error) throw new Error(`Resend API key inválida: ${error.message}`);
  }

  async send(options: MailSendOptions): Promise<string> {
    const { data, error } = await this.client.emails.send({
      from:    options.from,
      to:      [options.to],
      subject: options.subject,
      html:    options.html,
    });

    if (error) throw new Error(error.message);
    return data?.id ?? 'resend-no-id';
  }
}
