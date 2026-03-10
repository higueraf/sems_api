/**
 * Contrato que deben cumplir todos los transportes de correo.
 * El MailService opera exclusivamente contra esta interfaz,
 * sin conocer el proveedor concreto (SMTP o Resend).
 */
export interface MailTransport {
  /** Nombre del transporte — aparece en logs para identificar cuál está activo */
  readonly name: string;

  /**
   * Verifica que la configuración es correcta y el proveedor es alcanzable.
   * Se invoca al arrancar el módulo (onModuleInit).
   */
  verify(): Promise<void>;

  /**
   * Envía un correo electrónico.
   * @returns messageId devuelto por el proveedor (para trazabilidad en logs)
   * @throws Error con mensaje descriptivo si el envío falla
   */
  send(options: MailSendOptions): Promise<string>;
}

export interface MailSendOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
}
