#!/bin/bash
# =============================================================================
# fix-db.sh  — Elimina columnas snake_case residuales
# Uso: bash migrations/fix-db.sh   (desde ~/Desktop/sems_api)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Cargar variables del .env manualmente (compatible con sh y bash)
DB_HOST=$(grep '^DB_HOST' "$ENV_FILE" | cut -d'=' -f2)
DB_PORT=$(grep '^DB_PORT' "$ENV_FILE" | cut -d'=' -f2)
DB_USER=$(grep '^DB_USER' "$ENV_FILE" | cut -d'=' -f2)
DB_PASS=$(grep '^DB_PASS' "$ENV_FILE" | cut -d'=' -f2)
DB_NAME=$(grep '^DB_NAME' "$ENV_FILE" | cut -d'=' -f2)

echo "🔧 Conectando a $DB_NAME en $DB_HOST:$DB_PORT..."

PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -f "$SCRIPT_DIR/004_eliminar_columnas_snake_case.sql"

echo ""
echo "✅ Listo. Ahora reinicia el API: npm run start:dev"
