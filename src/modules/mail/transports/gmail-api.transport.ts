/**
 * GmailApiTransport
 * ─────────────────────────────────────────────────────────────────────────────
 * Transporte que usa la Gmail API REST directamente (NO nodemailer como relay).
 *
 * Arquitectura:
 *   OAuth2 refresh_token → access_token → Gmail API v1 /messages/send
 *
 * Esto evita completamente SMTP y cualquier problema de autenticación básica.
 * El correo se construye en formato RFC 2822, se codifica en base64url y se
 * envía via HTTPS a https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 */
import { google } from 'googleapis';
import { MailTransport, MailSendOptions } from './mail-transport.interface';

interface GmailOAuth2Config {
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GmailServiceAccountConfig {
  user: string;
  serviceAccountJson: string;
}

type GmailConfig = GmailOAuth2Config | GmailServiceAccountConfig;

function isOAuth2Config(c: GmailConfig): c is GmailOAuth2Config {
  return 'clientId' in c && !!c.clientId;
}

export class GmailApiTransport implements MailTransport {
  readonly name: string;
  private config: GmailConfig;

  constructor(config: GmailConfig) {
    this.config = config;
    this.name = isOAuth2Config(config)
      ? `Gmail API (OAuth2) — ${config.user}`
      : `Gmail API (Service Account) — ${(config as GmailServiceAccountConfig).user}`;
  }

  // ── Obtiene un cliente Gmail API autenticado ──────────────────────────────

  private async getGmailClient() {
    if (isOAuth2Config(this.config)) {
      return this.getOAuth2GmailClient(this.config);
    }
    return this.getServiceAccountGmailClient(this.config as GmailServiceAccountConfig);
  }

  private async getOAuth2GmailClient(cfg: GmailOAuth2Config) {
    // Sin redirect_uri — no se necesita para renovar tokens
    const oauth2Client = new google.auth.OAuth2(
      cfg.clientId,
      cfg.clientSecret,
    );

    oauth2Client.setCredentials({ refresh_token: cfg.refreshToken });

    // Verificar que el token es renovable antes de proceder
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error(
        'No se pudo obtener access token. Verifique GMAIL_REFRESH_TOKEN, ' +
        'GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET.',
      );
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  private async getServiceAccountGmailClient(cfg: GmailServiceAccountConfig) {
    let credentials: object;
    try {
      credentials = JSON.parse(cfg.serviceAccountJson);
    } catch {
      throw new Error('GMAIL_SERVICE_ACCOUNT_JSON no es un JSON válido.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      clientOptions: { subject: cfg.user },
    });

    return google.gmail({ version: 'v1', auth: await auth.getClient() as any });
  }

  // ── Construye el mensaje en formato RFC 2822 codificado en base64url ──────
  //
  // Gmail API requiere el correo completo en formato MIME estándar,
  // codificado en base64url (no base64 regular — usa - y _ en vez de + y /)

  private buildRfc2822Message(options: MailSendOptions): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const mime = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${this.encodeSubject(options.subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      this.stripHtml(options.html),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(options.html, 'utf-8').toString('base64'),
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    // base64url: reemplaza + por - y / por _ y elimina padding =
    return Buffer.from(mime)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Codifica el subject en RFC 2047 para soportar UTF-8 / caracteres especiales
  private encodeSubject(subject: string): string {
    return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  }

  // Versión texto plano del HTML para clientes sin soporte HTML
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 500) + '...';
  }

  // ── Implementación de la interfaz MailTransport ───────────────────────────

  async verify(): Promise<void> {
    // Verificamos obteniendo el perfil del usuario — llamada ligera y segura
    const gmail = await this.getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });

    const email = profile.data.emailAddress;
    if (!email) throw new Error('No se pudo obtener el perfil de Gmail.');
  }

  async send(options: MailSendOptions): Promise<string> {
    const gmail = await this.getGmailClient();

    const raw = this.buildRfc2822Message(options);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return response.data.id ?? 'gmail-api-no-id';
  }
}
