export default () => ({
  nodeEnv:     process.env.NODE_ENV    || 'development',
  port:        parseInt(process.env.PORT, 10) || 3000,
  appUrl:      process.env.APP_URL     || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  database: {
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    name:     process.env.DB_NAME || 'sems_db',
    ssl:      process.env.DB_SSL === 'true',
  },

  jwt: {
    secret:    process.env.JWT_SECRET    || 'fallback-secret-dev-only',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  mail: {
    // ── Selector de transporte ──────────────────────────────────────────────
    // Valores: 'smtp' | 'resend' | 'gmail'
    // Si se omite, la factory auto-detecta según las variables disponibles
    // (prioridad: gmail → resend → smtp)
    transport: process.env.MAIL_TRANSPORT || '',

    // Dirección de remitente visible para el destinatario
    from: process.env.MAIL_FROM || 'SEMS <noreply@sems.edu>',

    // ── OPCIÓN A: SMTP (nodemailer) ─────────────────────────────────────────
    // Usar en: local, VPS, Railway, Fly.io, Hostinger, Render plan pago
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',

    // ── OPCIÓN B: Resend (API REST sobre HTTPS) ─────────────────────────────
    // Usar en: Render free, Vercel, Lambda, cualquier entorno sin SMTP
    resendApiKey: process.env.RESEND_API_KEY || '',

    // ── OPCIÓN C: Gmail API (Google Cloud — capa gratuita) ──────────────────
    // Usar en: cualquier entorno, sin costo, ~10.000 correos/día gratuitos
    //
    // Sub-opción C1: OAuth2 con Refresh Token (cuenta personal/G Suite individual)
    //   Requiere: GMAIL_USER + GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN
    //
    // Sub-opción C2: Service Account con Domain-Wide Delegation (Google Workspace)
    //   Requiere: GMAIL_USER + GMAIL_SERVICE_ACCOUNT_JSON
    gmailUser:               process.env.GMAIL_USER                || '',
    gmailClientId:           process.env.GMAIL_CLIENT_ID           || '',
    gmailClientSecret:       process.env.GMAIL_CLIENT_SECRET       || '',
    gmailRefreshToken:       process.env.GMAIL_REFRESH_TOKEN       || '',
    gmailServiceAccountJson: process.env.GMAIL_SERVICE_ACCOUNT_JSON || '',
  },

  upload: {
    dest:        process.env.UPLOAD_DEST    || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 15 * 1024 * 1024,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey:    process.env.CLOUDINARY_API_KEY    || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  b2: {
    keyId:    process.env.B2_KEY_ID   || '',
    appKey:   process.env.B2_APP_KEY  || '',
    endpoint: process.env.B2_ENDPOINT || '',
    bucket:   process.env.B2_BUCKET   || 'sems-docs',
  },
});
