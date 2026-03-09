#!/usr/bin/env node
/**
 * migrate-images-to-cloudinary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script one-shot: sube todas las imágenes almacenadas en la BD (logoUrl,
 * photoUrl de organizers y submission_authors) a Cloudinary y actualiza
 * las URLs en la base de datos.
 *
 * Uso:
 *   CLOUDINARY_CLOUD_NAME=xxx \
 *   CLOUDINARY_API_KEY=yyy \
 *   CLOUDINARY_API_SECRET=zzz \
 *   DATABASE_URL="postgresql://..." \
 *   node migrations/migrate-images-to-cloudinary.js
 *
 * También acepta un archivo .env en la raíz del proyecto.
 */

require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const { Client } = require('pg');
const https = require('https');
const http  = require('http');

// ── Configuración ────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const API_ORIGIN = process.env.APP_URL || 'https://sems-api.onrender.com';

const db = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}?sslmode=require`,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function uploadToCloudinary(buffer, publicId, folder) {
  return new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, folder: `sems/${folder}`, overwrite: true, resource_type: 'auto' },
      (err, result) => err ? reject(err) : resolve(result.secure_url),
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

function isLocalUrl(url) {
  return url && (url.startsWith('/uploads') || url.startsWith('http://localhost'));
}

// ── Migración ────────────────────────────────────────────────────────────────
async function migrate() {
  await db.connect();
  console.log('✔  BD conectada\n');

  let migrated = 0;
  let skipped  = 0;
  let errors   = 0;

  // ── 1. organizers.logoUrl ──────────────────────────────────────────────────
  const { rows: orgs } = await db.query(
    `SELECT id, "logoUrl", "photoUrl", "shortName" FROM organizers WHERE "logoUrl" IS NOT NULL OR "photoUrl" IS NOT NULL`
  );

  for (const org of orgs) {
    for (const field of ['logoUrl', 'photoUrl']) {
      const url = org[field];
      if (!url || !isLocalUrl(url)) { skipped++; continue; }

      const fullUrl = `${API_ORIGIN}${url}`;
      const folder  = field === 'logoUrl' ? 'logos' : 'photos';
      const pid     = field === 'logoUrl' ? `org-${org.id}` : `person-${org.id}`;

      try {
        console.log(`↑  [organizer/${field}] ${org.shortName || org.id} → ${fullUrl}`);
        const buffer   = await fetchBuffer(fullUrl);
        const newUrl   = await uploadToCloudinary(buffer, pid, folder);
        await db.query(`UPDATE organizers SET "${field}" = $1 WHERE id = $2`, [newUrl, org.id]);
        console.log(`   ✔ ${newUrl}\n`);
        migrated++;
      } catch (err) {
        console.error(`   ✘ Error: ${err.message}\n`);
        errors++;
      }
    }
  }

  // ── 2. submission_authors.photoUrl ─────────────────────────────────────────
  const { rows: authors } = await db.query(
    `SELECT id, "photoUrl" FROM submission_authors WHERE "photoUrl" IS NOT NULL`
  );

  for (const author of authors) {
    const url = author.photoUrl;
    if (!isLocalUrl(url)) { skipped++; continue; }

    const fullUrl = `${API_ORIGIN}${url}`;
    try {
      console.log(`↑  [author.photoUrl] ${author.id} → ${fullUrl}`);
      const buffer = await fetchBuffer(fullUrl);
      const newUrl = await uploadToCloudinary(buffer, `author-${author.id}`, 'photos');
      await db.query(`UPDATE submission_authors SET "photoUrl" = $1 WHERE id = $2`, [newUrl, author.id]);
      console.log(`   ✔ ${newUrl}\n`);
      migrated++;
    } catch (err) {
      console.error(`   ✘ Error: ${err.message}\n`);
      errors++;
    }
  }

  // ── 3. guidelines.fileUrl ──────────────────────────────────────────────────
  const { rows: guidelines } = await db.query(
    `SELECT id, "fileUrl", "fileName" FROM guidelines WHERE "fileUrl" IS NOT NULL`
  );

  for (const g of guidelines) {
    const url = g.fileUrl;
    if (!isLocalUrl(url)) { skipped++; continue; }

    const fullUrl = `${API_ORIGIN}${url}`;
    try {
      console.log(`↑  [guideline.fileUrl] ${g.fileName || g.id} → ${fullUrl}`);
      const buffer = await fetchBuffer(fullUrl);
      const newUrl = await uploadToCloudinary(buffer, `guideline-${g.id}`, 'guidelines');
      await db.query(`UPDATE guidelines SET "fileUrl" = $1 WHERE id = $2`, [newUrl, g.id]);
      console.log(`   ✔ ${newUrl}\n`);
      migrated++;
    } catch (err) {
      console.error(`   ✘ Error: ${err.message}\n`);
      errors++;
    }
  }

  await db.end();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  Migrados:  ${migrated}`);
  console.log(`⊘  Omitidos:  ${skipped} (ya en Cloudinary o null)`);
  console.log(`✘  Errores:   ${errors}`);
  console.log('─────────────────────────────────────────────');
  if (errors > 0) process.exit(1);
}

migrate().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
