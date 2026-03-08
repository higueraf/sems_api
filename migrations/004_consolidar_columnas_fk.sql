-- =============================================================================
-- SEMS Migración 004 — Consolidación definitiva de columnas FK
-- Problema: cada tabla tenía DOS columnas para el mismo FK:
--   · camelCase (VARCHAR, con los datos reales, sin constraint FK)
--   · snake_case (UUID,    vacía,             con constraint FK real)
-- Solución:
--   1. Copiar datos camelCase → snake_case (cast a UUID)
--   2. Poner NOT NULL donde corresponde
--   3. Eliminar las columnas camelCase redundantes
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- thematic_axes : eventId (varchar) → event_id (uuid)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE thematic_axes
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE thematic_axes
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE thematic_axes
  DROP COLUMN IF EXISTS "eventId";

-- ─────────────────────────────────────────────────────────────────────────────
-- guidelines : eventId → event_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE guidelines
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE guidelines
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE guidelines
  DROP COLUMN IF EXISTS "eventId";

-- ─────────────────────────────────────────────────────────────────────────────
-- event_page_sections : eventId → event_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE event_page_sections
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE event_page_sections
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE event_page_sections
  DROP COLUMN IF EXISTS "eventId";

-- ─────────────────────────────────────────────────────────────────────────────
-- organizers : eventId → event_id  |  countryId → country_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE organizers
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE organizers
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE organizers
  DROP COLUMN IF EXISTS "eventId";

UPDATE organizers
   SET country_id = "countryId"::uuid
 WHERE country_id IS NULL AND "countryId" IS NOT NULL AND "countryId" != '';

ALTER TABLE organizers
  DROP COLUMN IF EXISTS "countryId";

-- ─────────────────────────────────────────────────────────────────────────────
-- submissions : eventId, thematicAxisId, productTypeId, countryId
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE submissions
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE submissions
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE submissions
  DROP COLUMN IF EXISTS "eventId";

-- ──
UPDATE submissions
   SET thematic_axis_id = "thematicAxisId"::uuid
 WHERE thematic_axis_id IS NULL AND "thematicAxisId" IS NOT NULL;

ALTER TABLE submissions
  ALTER COLUMN thematic_axis_id SET NOT NULL;

ALTER TABLE submissions
  DROP COLUMN IF EXISTS "thematicAxisId";

-- ──
UPDATE submissions
   SET product_type_id = "productTypeId"::uuid
 WHERE product_type_id IS NULL AND "productTypeId" IS NOT NULL;

ALTER TABLE submissions
  ALTER COLUMN product_type_id SET NOT NULL;

ALTER TABLE submissions
  DROP COLUMN IF EXISTS "productTypeId";

-- ──
UPDATE submissions
   SET country_id = "countryId"::uuid
 WHERE country_id IS NULL AND "countryId" IS NOT NULL AND "countryId" != '';

ALTER TABLE submissions
  DROP COLUMN IF EXISTS "countryId";

-- ─────────────────────────────────────────────────────────────────────────────
-- submission_authors : submissionId → submission_id  |  countryId → country_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE submission_authors
   SET submission_id = "submissionId"::uuid
 WHERE submission_id IS NULL AND "submissionId" IS NOT NULL;

ALTER TABLE submission_authors
  ALTER COLUMN submission_id SET NOT NULL;

ALTER TABLE submission_authors
  DROP COLUMN IF EXISTS "submissionId";

UPDATE submission_authors
   SET country_id = "countryId"::uuid
 WHERE country_id IS NULL AND "countryId" IS NOT NULL AND "countryId" != '';

ALTER TABLE submission_authors
  DROP COLUMN IF EXISTS "countryId";

-- ─────────────────────────────────────────────────────────────────────────────
-- submission_status_history : submissionId → submission_id  |  changedById → changed_by_id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE submission_status_history
   SET submission_id = "submissionId"::uuid
 WHERE submission_id IS NULL AND "submissionId" IS NOT NULL;

ALTER TABLE submission_status_history
  ALTER COLUMN submission_id SET NOT NULL;

ALTER TABLE submission_status_history
  DROP COLUMN IF EXISTS "submissionId";

UPDATE submission_status_history
   SET changed_by_id = "changedById"::uuid
 WHERE changed_by_id IS NULL AND "changedById" IS NOT NULL AND "changedById" != '';

ALTER TABLE submission_status_history
  DROP COLUMN IF EXISTS "changedById";

-- ─────────────────────────────────────────────────────────────────────────────
-- agenda_slots : eventId, submissionId, thematicAxisId
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE agenda_slots
   SET event_id = "eventId"::uuid
 WHERE event_id IS NULL AND "eventId" IS NOT NULL;

ALTER TABLE agenda_slots
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE agenda_slots
  DROP COLUMN IF EXISTS "eventId";

UPDATE agenda_slots
   SET submission_id = "submissionId"::uuid
 WHERE submission_id IS NULL AND "submissionId" IS NOT NULL AND "submissionId" != '';

ALTER TABLE agenda_slots
  DROP COLUMN IF EXISTS "submissionId";

UPDATE agenda_slots
   SET thematic_axis_id = "thematicAxisId"::uuid
 WHERE thematic_axis_id IS NULL AND "thematicAxisId" IS NOT NULL AND "thematicAxisId" != '';

ALTER TABLE agenda_slots
  DROP COLUMN IF EXISTS "thematicAxisId";

-- ─────────────────────────────────────────────────────────────────────────────
-- Insertar pauta de presentación (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_event_id  UUID;
  v_max_order INT;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE "isActive" = TRUE LIMIT 1;
  IF v_event_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM guidelines
    WHERE event_id = v_event_id
      AND "fileUrl" = '/uploads/guidelines/plantilla-presentacion-umayor.pptx'
  ) THEN
    RAISE NOTICE 'Pauta ya existe, omitiendo.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX("displayOrder"), 0) + 1 INTO v_max_order
    FROM guidelines WHERE event_id = v_event_id;

  INSERT INTO guidelines (
    id, event_id, title, content, category, "iconName",
    "displayOrder", "isVisible", "fileUrl", "fileName", "fileMimeType",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(), v_event_id,
    'Plantilla Oficial de Presentación de Ponencias',
    '<p>Descargue la <strong>plantilla oficial</strong> en formato PowerPoint para preparar '
    || 'su presentación. Incluye la identidad visual de la Universidad Mayor y los lineamientos '
    || 'de formato requeridos para el evento.</p>'
    || '<ul>'
    || '<li>Fuente: <strong>Calibri</strong> o <strong>Arial</strong>, mínimo <strong>18 pt</strong>.</li>'
    || '<li>Título de diapositiva en <strong>negrita</strong>, 24–28 pt.</li>'
    || '<li>Máximo <strong>10 diapositivas</strong> de contenido + portada y bibliografía.</li>'
    || '<li>No modifique colores corporativos ni encabezado/pie de página.</li>'
    || '<li>Tiempo: <strong>15 min</strong> exposición + <strong>5 min</strong> preguntas.</li>'
    || '</ul>',
    'submission', 'Presentation',
    v_max_order, TRUE,
    '/uploads/guidelines/plantilla-presentacion-umayor.pptx',
    'PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    NOW(), NOW()
  );
  RAISE NOTICE 'Pauta de presentación insertada.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación final
-- ─────────────────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'thematic_axes','guidelines','event_page_sections',
  'organizers','submissions','submission_authors',
  'submission_status_history','agenda_slots'
)
AND column_name IN (
  'event_id','thematic_axis_id','product_type_id',
  'country_id','submission_id','changed_by_id'
)
ORDER BY table_name, column_name;
