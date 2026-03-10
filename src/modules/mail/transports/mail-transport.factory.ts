/**
 * MailTransportFactory
 * ─────────────────────────────────────────────────────────────────────────────
 * Determina qué transporte instanciar según las variables de entorno.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TRANSPORTES DISPONIBLES                                                │
 * ├──────────────┬────────────────────────────────────────────────────────  │
 * │  smtp        │ nodemailer + SMTP clásico                                │
 * │              │ Usar en: local, VPS, Railway, Fly.io, Hostinger          │
 * │              │ Requiere: MAIL_HOST, MAIL_USER, MAIL_PASS                │
 * ├──────────────┼─────────────────────────────────────────────────────── ─ │
 * │  resend      │ Resend API REST (HTTPS)                                  │
 * │              │ Usar en: Render free, Vercel, Lambda, entornos sin SMTP  │
 * │              │ Requiere: RESEND_API_KEY                                  │
 * ├──────────────┼────────────────────────────────────────────────────────  │
 * │  gmail       │ Gmail API v1 (OAuth2 o Service Account)                  │
 * │              │ Usar en: cualquier entorno, capa gratuita Google Cloud   │
 * │              │ Requiere (OAuth2): GMAIL_USER + GMAIL_CLIENT_ID +        │
 * │              │                   GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN│
 * │              │ Requiere (SA):     GMAIL_USER + GMAIL_SERVICE_ACCOUNT_JSON │
 * └──────────────┴────────────────────────────────────────────────────────  ┘
 *
 * LÓGICA DE SELECCIÓN (orden de prioridad):
 *
 *  1. MAIL_TRANSPORT explícito (smtp | resend | gmail) → ese transporte
 *  2. Auto-detección por variables presentes:
 *     a. GMAIL_CLIENT_ID o GMAIL_SERVICE_ACCOUNT_JSON → gmail
 *     b. RESEND_API_KEY                               → resend
 *     c. MAIL_HOST + MAIL_USER + MAIL_PASS            → smtp
 *  3. Ninguna configuración válida → error descriptivo al arrancar
 */
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailTransport } from './mail-transport.interface';
import { SmtpTransport } from './smtp.transport';
import { ResendTransport } from './resend.transport';
import { GmailApiTransport } from './gmail-api.transport';

const logger = new Logger('MailTransportFactory');

export function createMailTransport(config: ConfigService): MailTransport {
  const explicitTransport = (config.get<string>('mail.transport') || '').toLowerCase().trim();

  // ── Variables SMTP ────────────────────────────────────────────────────────
  const smtpHost = config.get<string>('mail.host');
  const smtpUser = config.get<string>('mail.user');
  const smtpPass = config.get<string>('mail.pass');
  const smtpPort = config.get<number>('mail.port') || 587;

  // ── Variables Resend ──────────────────────────────────────────────────────
  const resendApiKey = config.get<string>('mail.resendApiKey');

  // ── Variables Gmail API ───────────────────────────────────────────────────
  const gmailUser               = config.get<string>('mail.gmailUser');
  const gmailClientId           = config.get<string>('mail.gmailClientId');
  const gmailClientSecret       = config.get<string>('mail.gmailClientSecret');
  const gmailRefreshToken       = config.get<string>('mail.gmailRefreshToken');
  const gmailServiceAccountJson = config.get<string>('mail.gmailServiceAccountJson');

  // ── Helpers de validación ─────────────────────────────────────────────────

  const buildSmtp = (): MailTransport => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error(
        '[MailTransportFactory] Transporte SMTP requiere: MAIL_HOST, MAIL_USER, MAIL_PASS',
      );
    }
    logger.log(`📧 Transporte: SMTP (nodemailer) — host: ${smtpHost}, user: ${smtpUser}`);
    return new SmtpTransport({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass });
  };

  const buildResend = (): MailTransport => {
    if (!resendApiKey) {
      throw new Error(
        '[MailTransportFactory] Transporte Resend requiere: RESEND_API_KEY',
      );
    }
    logger.log('📧 Transporte: Resend (API REST)');
    return new ResendTransport(resendApiKey);
  };

  const buildGmail = (): MailTransport => {
    if (!gmailUser) {
      throw new Error(
        '[MailTransportFactory] Transporte Gmail requiere al menos: GMAIL_USER',
      );
    }

    // Modalidad A: OAuth2 con Refresh Token (cuenta personal/G Suite individual)
    if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
      logger.log(`📧 Transporte: Gmail API (OAuth2) — user: ${gmailUser}`);
      return new GmailApiTransport({
        user: gmailUser,
        clientId: gmailClientId,
        clientSecret: gmailClientSecret,
        refreshToken: gmailRefreshToken,
      });
    }

    // Modalidad B: Service Account (Google Workspace con Domain-Wide Delegation)
    if (gmailServiceAccountJson) {
      logger.log(`📧 Transporte: Gmail API (Service Account) — user: ${gmailUser}`);
      return new GmailApiTransport({
        user: gmailUser,
        serviceAccountJson: gmailServiceAccountJson,
      });
    }

    throw new Error(
      '[MailTransportFactory] Transporte Gmail requiere una de estas combinaciones:\n' +
      '  OAuth2:          GMAIL_USER + GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN\n' +
      '  Service Account: GMAIL_USER + GMAIL_SERVICE_ACCOUNT_JSON',
    );
  };

  // ── Selección explícita vía MAIL_TRANSPORT ────────────────────────────────
  if (explicitTransport === 'smtp')   return buildSmtp();
  if (explicitTransport === 'resend') return buildResend();
  if (explicitTransport === 'gmail')  return buildGmail();

  if (explicitTransport && !['smtp', 'resend', 'gmail'].includes(explicitTransport)) {
    throw new Error(
      `[MailTransportFactory] Valor inválido para MAIL_TRANSPORT: "${explicitTransport}"\n` +
      `  Valores válidos: smtp | resend | gmail`,
    );
  }

  // ── Auto-detección (sin MAIL_TRANSPORT explícito) ─────────────────────────
  logger.log('🔍 MAIL_TRANSPORT no definido — iniciando auto-detección...');

  // Gmail tiene prioridad sobre los demás si sus variables están configuradas
  if (gmailUser && (gmailClientId || gmailServiceAccountJson)) {
    logger.log('🔍 Auto-detección: variables Gmail encontradas → usando Gmail API');
    return buildGmail();
  }

  if (resendApiKey) {
    logger.log('🔍 Auto-detección: RESEND_API_KEY encontrada → usando Resend');
    return buildResend();
  }

  if (smtpHost && smtpUser && smtpPass) {
    logger.log(`🔍 Auto-detección: variables SMTP encontradas → usando SMTP (${smtpHost})`);
    return buildSmtp();
  }

  // ── Sin configuración válida ──────────────────────────────────────────────
  throw new Error(
    '═══════════════════════════════════════════════════════════════\n' +
    ' [MailTransportFactory] Sin configuración de correo válida.\n' +
    ' Configure una de las siguientes opciones en las variables de entorno:\n\n' +
    '  OPCIÓN A — Gmail API (OAuth2) — capa gratuita Google Cloud:\n' +
    '    MAIL_TRANSPORT=gmail\n' +
    '    GMAIL_USER=tu@gmail.com\n' +
    '    GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com\n' +
    '    GMAIL_CLIENT_SECRET=GOCSPX-xxx\n' +
    '    GMAIL_REFRESH_TOKEN=1//0exxx\n\n' +
    '  OPCIÓN B — Resend (API REST, plan gratuito 3.000/mes):\n' +
    '    MAIL_TRANSPORT=resend\n' +
    '    RESEND_API_KEY=re_xxx\n\n' +
    '  OPCIÓN C — SMTP (local/VPS/Railway):\n' +
    '    MAIL_TRANSPORT=smtp\n' +
    '    MAIL_HOST=smtp.gmail.com\n' +
    '    MAIL_USER=tu@gmail.com\n' +
    '    MAIL_PASS=app_password_16_chars\n' +
    '═══════════════════════════════════════════════════════════════',
  );
}
