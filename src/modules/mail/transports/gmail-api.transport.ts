import { google } from 'googleapis';
import { MailTransport, MailSendOptions, MailAttachment } from './mail-transport.interface';

interface GmailOAuth2Config {
  user: string; clientId: string; clientSecret: string; refreshToken: string;
}
interface GmailServiceAccountConfig {
  user: string; serviceAccountJson: string;
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

  private async getGmailClient() {
    return isOAuth2Config(this.config)
      ? this.getOAuth2GmailClient(this.config)
      : this.getServiceAccountGmailClient(this.config as GmailServiceAccountConfig);
  }

  private async getOAuth2GmailClient(cfg: GmailOAuth2Config) {
    const oauth2Client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret);
    oauth2Client.setCredentials({ refresh_token: cfg.refreshToken });
    const { token } = await oauth2Client.getAccessToken();
    if (!token) throw new Error('No se pudo obtener access token. Verifique GMAIL_REFRESH_TOKEN.');
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  private async getServiceAccountGmailClient(cfg: GmailServiceAccountConfig) {
    let credentials: object;
    try { credentials = JSON.parse(cfg.serviceAccountJson); }
    catch { throw new Error('GMAIL_SERVICE_ACCOUNT_JSON no es JSON válido.'); }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      clientOptions: { subject: cfg.user },
    });
    return google.gmail({ version: 'v1', auth: await auth.getClient() as any });
  }

  // ── Construcción del mensaje MIME con soporte de adjuntos ─────────────────

  private buildRfc2822Message(options: MailSendOptions): string {
    const outerBoundary = `outer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const innerBoundary = `inner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const hasAttachments = options.attachments && options.attachments.length > 0;

    const lines: string[] = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${this.encodeSubject(options.subject)}`,
      `MIME-Version: 1.0`,
    ];

    if (hasAttachments) {
      // multipart/mixed — contiene el cuerpo HTML + adjuntos
      lines.push(`Content-Type: multipart/mixed; boundary="${outerBoundary}"`);
      lines.push('');
      lines.push(`--${outerBoundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`);
      lines.push('');
      lines.push(`--${innerBoundary}`);
      lines.push(`Content-Type: text/plain; charset="UTF-8"`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(this.stripHtml(options.html));
      lines.push('');
      lines.push(`--${innerBoundary}`);
      lines.push(`Content-Type: text/html; charset="UTF-8"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push('');
      lines.push(Buffer.from(options.html, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${innerBoundary}--`);

      // Adjuntos
      for (const att of options.attachments!) {
        const encodedName = this.encodeSubject(att.filename);
        lines.push('');
        lines.push(`--${outerBoundary}`);
        lines.push(`Content-Type: ${att.contentType}; name="${encodedName}"`);
        lines.push(`Content-Transfer-Encoding: base64`);
        lines.push(`Content-Disposition: attachment; filename="${encodedName}"`);
        lines.push('');
        // Dividir base64 en líneas de 76 chars (RFC 2822)
        const b64 = att.content.toString('base64');
        for (let i = 0; i < b64.length; i += 76) {
          lines.push(b64.slice(i, i + 76));
        }
      }
      lines.push('');
      lines.push(`--${outerBoundary}--`);
    } else {
      // Sin adjuntos — multipart/alternative estándar
      lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`);
      lines.push('');
      lines.push(`--${innerBoundary}`);
      lines.push(`Content-Type: text/plain; charset="UTF-8"`);
      lines.push(`Content-Transfer-Encoding: quoted-printable`);
      lines.push('');
      lines.push(this.stripHtml(options.html));
      lines.push('');
      lines.push(`--${innerBoundary}`);
      lines.push(`Content-Type: text/html; charset="UTF-8"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push('');
      lines.push(Buffer.from(options.html, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${innerBoundary}--`);
    }

    const mime = lines.join('\r\n');
    return Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private encodeSubject(subject: string): string {
    return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
  }

  private stripHtml(html: string): string {
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 500) + '...';
  }

  async verify(): Promise<void> {
    const gmail = await this.getGmailClient();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    if (!profile.data.emailAddress) throw new Error('No se pudo obtener el perfil de Gmail.');
  }

  async send(options: MailSendOptions): Promise<string> {
    const gmail = await this.getGmailClient();
    const raw = this.buildRfc2822Message(options);
    const response = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return response.data.id ?? 'gmail-api-no-id';
  }
}
