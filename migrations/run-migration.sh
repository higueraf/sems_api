#!/usr/bin/env bash
# =============================================================================
# run-migration.sh  — SEMS
# Ejecuta TODAS las migraciones SQL en orden numérico.
# Uso: cd migrations && bash run-migration.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  No se encontró .env en $ENV_FILE"
  exit 1
fi

# Cargar variables
set -a
source "$ENV_FILE"
set +a

echo "🗄️  Conectando a PostgreSQL: ${DB_HOST}:${DB_PORT}/${DB_NAME} como ${DB_USER}"

# Procesar archivos SQL en orden numérico
for SQL_FILE in $(ls "$SCRIPT_DIR"/*.sql | sort -V); do
  echo ""
  echo "▶️  Ejecutando: $(basename "$SQL_FILE")"
  PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    -f "$SQL_FILE"
  echo "✅  Completado: $(basename "$SQL_FILE")"
done

echo ""
echo "🎉  Todas las migraciones ejecutadas correctamente."
