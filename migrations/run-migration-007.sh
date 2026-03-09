#!/usr/bin/env bash
# =============================================================
# run-migration-007.sh
# Aplica la migración 007 a la base de datos de producción (Neon)
# Uso:  bash migrations/run-migration-007.sh
#       bash migrations/run-migration-007.sh --dry-run   (solo verifica)
# =============================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✘${NC}  $*" >&2; }
info() { echo -e "${CYAN}→${NC}  $*"; }

# ── Configuración Neon (producción) ───────────────────────────
NEON_HOST="ep-billowing-cloud-adtffkrx-pooler.c-2.us-east-1.aws.neon.tech"
NEON_DB="sems_db"
NEON_USER="neondb_owner"
NEON_PASS="npg_7IxAgRf8aMvy"
NEON_DSN="postgresql://${NEON_USER}:${NEON_PASS}@${NEON_HOST}/${NEON_DB}?sslmode=require"

MIGRATION_FILE="$(dirname "$0")/007_organizadores_refactorizacion.sql"
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Banner ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  SEMS — Migración 007: Refactorización Organizadores${NC}"
echo -e "${BOLD}  Destino: Neon (producción)${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo ""

# ── Verificar psql ────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  err "psql no encontrado. Instala postgresql-client."
  exit 1
fi
ok "psql disponible ($(psql --version | head -1))"

# ── Verificar archivo de migración ────────────────────────────
if [[ ! -f "$MIGRATION_FILE" ]]; then
  err "Archivo no encontrado: $MIGRATION_FILE"
  exit 1
fi
ok "Archivo de migración: $MIGRATION_FILE"

# ── Verificar conexión ────────────────────────────────────────
info "Verificando conexión a Neon..."
if ! PGPASSWORD="$NEON_PASS" psql "$NEON_DSN" -c "SELECT 1;" &>/dev/null; then
  err "No se pudo conectar a Neon. Verifica credenciales y red."
  exit 1
fi
ok "Conexión a Neon establecida"

# ── Estado actual de la BD ────────────────────────────────────
echo ""
echo -e "${BOLD}Estado actual en producción:${NC}"

PGPASSWORD="$NEON_PASS" psql "$NEON_DSN" -t -A -c "
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='organizers' AND column_name='institutionalPosition')
   AS has_institutional_position,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='organizers' AND column_name='description')
   AS has_description,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name='organizer_members')
   AS has_members_table,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name='submission_authors' AND column_name='photoUrl')
   AS has_author_photo;
" | while IFS='|' read -r pos desc members photo; do
  [[ "$pos"     == "1" ]] && ok "organizers.institutionalPosition  — YA EXISTE" \
                          || warn "organizers.institutionalPosition  — FALTA (se creará)"
  [[ "$desc"    == "1" ]] && ok "organizers.description            — YA EXISTE" \
                          || warn "organizers.description            — FALTA (se creará)"
  [[ "$members" == "1" ]] && ok "Tabla organizer_members           — YA EXISTE" \
                          || warn "Tabla organizer_members           — FALTA (se creará)"
  [[ "$photo"   == "1" ]] && ok "submission_authors.photoUrl       — YA EXISTE" \
                          || warn "submission_authors.photoUrl       — FALTA (se creará)"
done

echo ""

# ── Modo dry-run ──────────────────────────────────────────────
if $DRY_RUN; then
  warn "Modo --dry-run: verificación completada sin aplicar cambios."
  exit 0
fi

# ── Confirmación ──────────────────────────────────────────────
echo -e "${YELLOW}¿Aplicar migración 007 en producción (Neon)?${NC}"
read -rp "  Escribe 'si' para continuar: " CONFIRM
if [[ "$CONFIRM" != "si" ]]; then
  warn "Migración cancelada por el usuario."
  exit 0
fi

# ── Ejecutar migración ────────────────────────────────────────
echo ""
info "Ejecutando migración..."
echo "────────────────────────────────────────────────────────"

if PGPASSWORD="$NEON_PASS" psql "$NEON_DSN" \
    --set ON_ERROR_STOP=1 \
    -v VERBOSITY=verbose \
    -f "$MIGRATION_FILE"; then

  echo "────────────────────────────────────────────────────────"
  echo ""
  ok "Migración 007 aplicada exitosamente."

  # ── Verificación post-migración ───────────────────────────
  echo ""
  echo -e "${BOLD}Verificación post-migración:${NC}"

  PGPASSWORD="$NEON_PASS" psql "$NEON_DSN" -c "
  SELECT
    'organizers' AS tabla,
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_name = 'organizers'
    AND column_name IN ('institutionalPosition','description','type','photoUrl','title','bio','email','phone')
  UNION ALL
  SELECT
    'submission_authors',
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_name = 'submission_authors'
    AND column_name = 'photoUrl'
  UNION ALL
  SELECT
    'organizer_members (tabla)',
    table_name,
    'TABLE'
  FROM information_schema.tables
  WHERE table_name = 'organizer_members'
  ORDER BY 1, 2;
  "

  echo ""
  echo -e "${BOLD}Columnas de organizer_members:${NC}"
  PGPASSWORD="$NEON_PASS" psql "$NEON_DSN" -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'organizer_members'
  ORDER BY ordinal_position;
  "

else
  echo "────────────────────────────────────────────────────────"
  err "La migración falló. El bloque TRANSACTION fue revertido automáticamente."
  err "La base de datos de producción NO fue modificada."
  exit 1
fi

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Migración 007 completada sin errores ✔${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo ""
