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
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || 'SEMS <no-reply@sems.edu>',
  },

  upload: {
    dest:        process.env.UPLOAD_DEST    || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 15 * 1024 * 1024,
  },

  // ── Cloudinary — logos e imágenes (25 GB free permanentes) ─────────────────
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey:    process.env.CLOUDINARY_API_KEY    || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // ── Backblaze B2 — manuscritos Word/PDF (10 GB free permanentes) ────────────
  b2: {
    keyId:    process.env.B2_KEY_ID   || '',
    appKey:   process.env.B2_APP_KEY  || '',
    endpoint: process.env.B2_ENDPOINT || '',   // ej: s3.us-west-004.backblazeb2.com
    bucket:   process.env.B2_BUCKET   || 'sems-docs',
  },
});
