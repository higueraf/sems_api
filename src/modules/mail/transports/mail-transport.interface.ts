/**
 * Contrato que deben cumplir todos los transportes de correo.
 */
export interface MailTransport {
  readonly name: string;
  verify(): Promise<void>;
  send(options: MailSendOptions): Promise<string>;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailSendOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}
