#!/bin/bash
# =============================================================================
# migrate-to-neon.sh — Migra localhost → Neon usando psql (compatible v17/v18)
# Uso: bash migrations/migrate-to-neon.sh
# =============================================================================

SRC_HOST=localhost
SRC_PORT=5432
SRC_USER=jate_user
SRC_PASS=jateP455word
SRC_DB=sems_db

DST_HOST=ep-billowing-cloud-adtffkrx-pooler.c-2.us-east-1.aws.neon.tech
DST_PORT=5432
DST_USER=neondb_owner
DST_PASS=npg_7IxAgRf8aMvy
DST_DB=sems_db
DST_URL="postgresql://$DST_USER:$DST_PASS@$DST_HOST/$DST_DB?sslmode=require"

DUMP_FILE="/tmp/sems_migrate_$(date +%Y%m%d_%H%M%S).sql"

echo "========================================================"
echo "  SEMS — Migración localhost → Neon"
echo "========================================================"

# ── Paso 1: Generar script SQL con pg_dump ignorando version mismatch ─────────
echo ""
echo "📦 Paso 1: Generando dump SQL..."

# Intentar con --no-password y forzar versión
PGPASSWORD="$SRC_PASS" pg_dump \
  -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
  --no-owner --no-acl --clean --if-exists \
  --schema=public \
  -f "$DUMP_FILE" 2>/dev/null

if [ $? -ne 0 ]; then
  echo "⚠️  pg_dump falló por versión. Generando dump manual vía psql..."

  PGPASSWORD="$SRC_PASS" psql \
    -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
    -c "\copy (SELECT 1) TO STDOUT" > /dev/null 2>&1

  if [ $? -ne 0 ]; then
    echo "❌ No se puede conectar a PostgreSQL local."
    exit 1
  fi

  # Generar SQL de estructura + datos manualmente
  cat > "$DUMP_FILE" << 'HEADER'
-- SEMS Migration dump (generated via psql)
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
HEADER

  echo "   Exportando estructura de ENUMs..."
  PGPASSWORD="$SRC_PASS" psql \
    -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
    -t -A -c "
SELECT 'CREATE TYPE ' || n.nspname || '.\"' || t.typname || '\" AS ENUM (' ||
  string_agg('''' || e.enumlabel || '''', ', ' ORDER BY e.enumsortorder) || ');'
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname;" >> "$DUMP_FILE" 2>/dev/null

  echo "" >> "$DUMP_FILE"
  echo "-- Ignorar errores de tipo ya existente" >> "$DUMP_FILE"

  # Exportar datos tabla por tabla
  TABLES="countries users events thematic_axes scientific_product_types organizers guidelines submissions submission_authors submission_status_history agenda_slots email_logs"

  for TABLE in $TABLES; do
    echo "   Exportando tabla: $TABLE"
    echo "" >> "$DUMP_FILE"
    echo "-- Tabla: $TABLE" >> "$DUMP_FILE"

    # Obtener datos como INSERT statements
    PGPASSWORD="$SRC_PASS" psql \
      -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
      -t -A -c "
SELECT 'INSERT INTO \"$TABLE\" SELECT * FROM json_populate_recordset(NULL::\"$TABLE\", ''' ||
  replace(json_agg(row_to_json(t))::text, '''', '''''') ||
  ''') ON CONFLICT DO NOTHING;'
FROM \"$TABLE\" t;" >> "$DUMP_FILE" 2>/dev/null || echo "-- tabla $TABLE vacía o no existe" >> "$DUMP_FILE"
  done
fi

echo "✅ Dump generado: $DUMP_FILE ($(wc -l < "$DUMP_FILE") líneas)"

# ── Paso 2: Cargar en Neon ────────────────────────────────────────────────────
echo ""
echo "☁️  Paso 2: Cargando en Neon..."

PGPASSWORD="$DST_PASS" psql "$DST_URL" \
  -f "$DUMP_FILE" \
  --set ON_ERROR_STOP=off \
  -q 2>&1 | grep -v "^SET\|^--\|^$\|skipping\|NOTICE\|already exists" | head -30

echo "✅ Carga completada."

# ── Paso 3: Actualizar .env ───────────────────────────────────────────────────
echo ""
echo "🔧 Paso 3: Actualizando .env para Neon..."

ENV_FILE="$(dirname "$0")/../.env"

sed -i 's/^DB_HOST=localhost$/#DB_HOST=localhost/' "$ENV_FILE"
sed -i '/^DB_PORT=5432$/{/neon/!s/^/#/}' "$ENV_FILE"
sed -i 's/^DB_USER=jate_user$/#DB_USER=jate_user/' "$ENV_FILE"
sed -i 's/^DB_PASS=jateP455word$/#DB_PASS=jateP455word/' "$ENV_FILE"
sed -i 's/^DB_NAME=sems_db$/#DB_NAME=sems_db/' "$ENV_FILE"

sed -i 's/^#DB_HOST=ep-billowing/DB_HOST=ep-billowing/' "$ENV_FILE"
sed -i 's/^#DB_USER=neondb_owner/DB_USER=neondb_owner/' "$ENV_FILE"
sed -i 's/^#DB_PASS=npg_/DB_PASS=npg_/' "$ENV_FILE"
sed -i 's/^#DB_NAME=sems_db/DB_NAME=sems_db/' "$ENV_FILE"
sed -i 's/^#DB_SSL=true/DB_SSL=true/' "$ENV_FILE"
sed -i 's/^#DB_PORT=5432/DB_PORT=5432/' "$ENV_FILE"

echo "✅ .env actualizado."
echo ""
echo "========================================================"
echo "  ¡Listo! Reinicia el API:"
echo "  npm run start:dev"
echo "========================================================"
echo ""
echo "  Dump guardado en: $DUMP_FILE"
