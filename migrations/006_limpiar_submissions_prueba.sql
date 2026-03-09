-- =============================================================================
-- SEMS — Limpieza de postulaciones de prueba
-- Ejecutar ANTES de pasar a producción con datos reales
-- Elimina: submissions, authors, status history
-- Conserva: eventos, ejes temáticos, pautas, organizadores, usuarios, países
-- =============================================================================
-- Uso:
--   Localhost:  PGPASSWORD=jateP455word psql -h localhost -p 5432 -U jate_user -d sems_db -f migrations/006_limpiar_submissions_prueba.sql
--   Neon:       PGPASSWORD=npg_7IxAgRf8aMvy psql "postgresql://neondb_owner:npg_7IxAgRf8aMvy@ep-billowing-cloud-adtffkrx-pooler.c-2.us-east-1.aws.neon.tech/sems_db?sslmode=require" -f migrations/006_limpiar_submissions_prueba.sql
-- =============================================================================

BEGIN;

-- 1. Mostrar cuántos registros hay antes de limpiar
DO $$
BEGIN
  RAISE NOTICE '=== ESTADO ANTES DE LIMPIAR ===';
  RAISE NOTICE 'submissions: %',           (SELECT COUNT(*) FROM submissions);
  RAISE NOTICE 'submission_authors: %',    (SELECT COUNT(*) FROM submission_authors);
  RAISE NOTICE 'submission_status_history: %', (SELECT COUNT(*) FROM submission_status_history);
  RAISE NOTICE 'email_logs: %',            (SELECT COUNT(*) FROM email_logs);
END $$;

-- 2. Limpiar en orden correcto (respetando FKs)
DELETE FROM submission_status_history;
DELETE FROM submission_authors;
DELETE FROM submissions;
DELETE FROM email_logs;  -- logs de correos enviados a postulantes

-- 3. Reiniciar secuencias si existieran (no aplica para UUID, pero por si acaso)
-- No hay secuencias que reiniciar en UUID

-- 4. Confirmar limpieza
DO $$
BEGIN
  RAISE NOTICE '=== ESTADO DESPUÉS DE LIMPIAR ===';
  RAISE NOTICE 'submissions: %',           (SELECT COUNT(*) FROM submissions);
  RAISE NOTICE 'submission_authors: %',    (SELECT COUNT(*) FROM submission_authors);
  RAISE NOTICE 'submission_status_history: %', (SELECT COUNT(*) FROM submission_status_history);
  RAISE NOTICE 'email_logs: %',            (SELECT COUNT(*) FROM email_logs);
  RAISE NOTICE '=== LO QUE SE CONSERVÓ ===';
  RAISE NOTICE 'events: %',               (SELECT COUNT(*) FROM events);
  RAISE NOTICE 'thematic_axes: %',        (SELECT COUNT(*) FROM thematic_axes);
  RAISE NOTICE 'guidelines: %',           (SELECT COUNT(*) FROM guidelines);
  RAISE NOTICE 'scientific_product_types: %', (SELECT COUNT(*) FROM scientific_product_types);
  RAISE NOTICE 'organizers: %',           (SELECT COUNT(*) FROM organizers);
  RAISE NOTICE 'users: %',               (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'countries: %',           (SELECT COUNT(*) FROM countries);
END $$;

COMMIT;
