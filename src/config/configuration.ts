export default () => ({
  nodeEnv:     process.env.NODE_ENV     || 'development',
  port:        parseInt(process.env.PORT, 10) || 3000,
  appUrl:      process.env.APP_URL      || 'http://localhost:3000',
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
    secret:    process.env.JWT_SECRET     || 'fallback-secret-dev-only',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  mail: {
    // Selector de transporte: 'smtp' | 'resend' | 'gmail'
    // Si se omite, la factory auto-detecta (prioridad: gmail → resend → smtp)
    transport: process.env.MAIL_TRANSPORT || '',
    from:      process.env.MAIL_FROM      || 'SEMS <noreply@sems.edu>',

    // SMTP (nodemailer) — local, VPS, Railway, Render plan pago
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',

    // Resend (API REST) — Render free, serverless
    resendApiKey: process.env.RESEND_API_KEY || '',

    // Gmail API OAuth2 — cualquier entorno, ~10.000 correos/día gratis
    gmailUser:               process.env.GMAIL_USER                 || '',
    gmailClientId:           process.env.GMAIL_CLIENT_ID            || '',
    gmailClientSecret:       process.env.GMAIL_CLIENT_SECRET        || '',
    gmailRefreshToken:       process.env.GMAIL_REFRESH_TOKEN        || '',
    gmailServiceAccountJson: process.env.GMAIL_SERVICE_ACCOUNT_JSON || '',
  },

  upload: {
    // Directorio raíz de uploads en disco local.
    // Puede ser ruta absoluta (/var/www/sems/uploads) o relativa (./uploads).
    // Relativa → se resuelve desde process.cwd() (directorio de ejecución del servidor).
    //
    // Ejemplos por entorno:
    //   Render (efímero, sin cloud) → ./uploads   ← se resetea al redeploy
    //   VPS propio                  → /var/www/sems/uploads
    //   Docker con volumen          → /data/uploads  (volumen montado persistente)
    //
    // ⚠️  En Render plan gratuito el filesystem es efímero.
    //     Para producción real en Render: configurar Cloudinary + B2.
    //     Para VPS propio: usar ruta absoluta persistente.
    dest: process.env.UPLOAD_DEST || './uploads',

    // Tamaño máximo de archivo (bytes). Default: 15 MB.
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 15 * 1024 * 1024,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey:    process.env.CLOUDINARY_API_KEY     || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET  || '',
  },

  b2: {
    keyId:    process.env.B2_KEY_ID   || '',
    appKey:   process.env.B2_APP_KEY  || '',
    endpoint: process.env.B2_ENDPOINT || '',
    bucket:   process.env.B2_BUCKET   || 'sems-docs',
  },
});
