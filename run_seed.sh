#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# SEMS - Script de Ejecución de Seed Inicial
# ════════════════════════════════════════════════════════════════════════════
# Uso: ./run_seed.sh [opciones]
# 
# Opciones:
#   -h, --help          Muestra esta ayuda
#   -d, --database      Nombre de la base de datos (default: sems_db)
#   -u, --user          Usuario de PostgreSQL (default: postgres)
#   -p, --port          Puerto de PostgreSQL (default: 5432)
#   -f, --force         Forzar ejecución incluso si hay datos
#   -v, --verbose       Modo verboso
#   --dry-run           Simular ejecución sin hacer cambios
# ════════════════════════════════════════════════════════════════════════════

# Configuración por defecto
DB_NAME="sems_db"
DB_USER="postgres"
DB_PORT="5432"
DB_HOST="localhost"
FORCE=false
VERBOSE=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/seed_initial_data.sql"

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función de ayuda
show_help() {
    echo "Uso: $0 [opciones]"
    echo ""
    echo "Opciones:"
    echo "  -h, --help          Muestra esta ayuda"
    echo "  -d, --database      Nombre de la base de datos (default: $DB_NAME)"
    echo "  -u, --user          Usuario de PostgreSQL (default: $DB_USER)"
    echo "  -p, --port          Puerto de PostgreSQL (default: $DB_PORT)"
    echo "  -H, --host          Host de PostgreSQL (default: $DB_HOST)"
    echo "  -f, --force         Forzar ejecución incluso si hay datos"
    echo "  -v, --verbose       Modo verboso"
    echo "  --dry-run           Simular ejecución sin hacer cambios"
    echo ""
    echo "Ejemplos:"
    echo "  $0                              # Usar configuración por defecto"
    echo "  $0 -d mi_db -u mi_user         # Base de datos y usuario personalizados"
    echo "  $0 --force --verbose           # Forzar ejecución con modo verboso"
    echo "  $0 --dry-run                   # Simular ejecución"
    echo ""
}

# Función de log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ADVERTENCIA: $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Verificar dependencias
check_dependencies() {
    log "Verificando dependencias..."
    
    if ! command -v psql &> /dev/null; then
        log_error "psql no está instalado. Por favor instala PostgreSQL client."
        exit 1
    fi
    
    if ! command -v pg_isready &> /dev/null; then
        log_warn "pg_isready no está disponible. Continuando sin verificación de conexión."
    fi
    
    if [[ ! -f "$SEED_FILE" ]]; then
        log_error "Archivo seed no encontrado: $SEED_FILE"
        exit 1
    fi
    
    log "Dependencias verificadas correctamente"
}

# Verificar conexión a la base de datos
check_connection() {
    log_info "Verificando conexión a la base de datos..."
    
    if command -v pg_isready &> /dev/null; then
        if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
            log_error "No se puede conectar a la base de datos $DB_NAME en $DB_HOST:$DB_PORT"
            log_error "Verifica que PostgreSQL esté corriendo y los datos de conexión sean correctos"
            exit 1
        fi
    fi
    
    log "Conexión a la base de datos verificada"
}

# Verificar si la base de datos tiene datos
check_existing_data() {
    if [[ "$FORCE" == "true" ]]; then
        log_info "Modo force activado - ignorando verificación de datos existentes"
        return 0
    fi
    
    log_info "Verificando datos existentes en la base de datos..."
    
    local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM events;" 2>/dev/null | tr -d ' ')
    
    if [[ -n "$count" && "$count" -gt 0 ]]; then
        log_warn "La base de datos ya contiene $count eventos"
        log_warn "Esto sugiere que el seed ya fue ejecutado o la base de datos no está vacía"
        log_warn "Usa --force para ejecutar de todos modos"
        
        read -p "¿Deseas continuar? (s/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            log_info "Ejecución cancelada por el usuario"
            exit 0
        fi
    fi
}

# Ejecutar seed
run_seed() {
    log "Iniciando ejecución del seed..."
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Configuración:"
        log_info "  Base de datos: $DB_NAME"
        log_info "  Usuario: $DB_USER"
        log_info "  Host: $DB_HOST"
        log_info "  Puerto: $DB_PORT"
        log_info "  Archivo seed: $SEED_FILE"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "MODO DRY RUN - No se realizarán cambios reales"
        log_info "Se ejecutaría: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SEED_FILE"
        return 0
    fi
    
    # Ejecutar el seed
    local start_time=$(date +%s)
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_FILE"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "Seed ejecutado exitosamente en ${duration}s"
        
        # Verificación final
        verify_seed
    else
        log_error "Error al ejecutar el seed"
        exit 1
    fi
}

# Verificar resultados del seed
verify_seed() {
    log_info "Verificando resultados del seed..."
    
    local event_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM events;" 2>/dev/null | tr -d ' ')
    local country_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM countries;" 2>/dev/null | tr -d ' ')
    local axis_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"thematicAxes\";" 2>/dev/null | tr -d ' ')
    local organizer_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM organizers;" 2>/dev/null | tr -d ' ')
    local admin_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>/dev/null | tr -d ' ')
    
    echo ""
    log "=== VERIFICACIÓN FINAL ==="
    log "Eventos creados: $event_count"
    log "Países creados: $country_count"
    log "Ejes temáticos creados: $axis_count"
    log "Organizadores creados: $organizer_count"
    log "Usuarios admin creados: $admin_count"
    log "========================"
    
    if [[ "$admin_count" -gt 0 ]]; then
        log ""
        log "ACCESO POR DEFECTO:"
        log "  Email: admin@sems.local"
        log "  Password: admin123"
        log ""
        log "IMPORTANTE: Cambia la contraseña del admin en producción"
    fi
    
    if [[ "$event_count" -gt 0 && "$country_count" -gt 0 && "$axis_count" -gt 0 ]]; then
        log "✅ Seed verificado exitosamente"
    else
        log_error "❌ Verificación falló - algunos datos no se insertaron correctamente"
        exit 1
    fi
}

# Parsear argumentos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--database)
                DB_NAME="$2"
                shift 2
                ;;
            -u|--user)
                DB_USER="$2"
                shift 2
                ;;
            -p|--port)
                DB_PORT="$2"
                shift 2
                ;;
            -H|--host)
                DB_HOST="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            *)
                log_error "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Función principal
main() {
    log "=== SEMS Seed Runner ==="
    
    parse_args "$@"
    check_dependencies
    check_connection
    check_existing_data
    run_seed
    
    log "=== Proceso completado ==="
}

# Ejecutar main con todos los argumentos
main "$@"
