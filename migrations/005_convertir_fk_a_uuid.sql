-- =============================================================================
-- SEMS Migración 005 — Convertir columnas FK de VARCHAR a UUID
-- TypeORM espera que las columnas referenciadas sean UUID.
-- Las columnas camelCase tienen los datos como strings UUID válidos,
-- solo necesitan cambiar de tipo VARCHAR → UUID.
-- =============================================================================

BEGIN;

-- ── Eliminar FK constraint residual que apunta a columna ya inexistente ───────
ALTER TABLE thematic_axes
  DROP CONSTRAINT IF EXISTS "FK_ce2329559e8d831b18a1a77ca0f";

-- ── event_page_sections.eventId  VARCHAR → UUID ───────────────────────────────
ALTER TABLE event_page_sections
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── thematic_axes.eventId  VARCHAR → UUID ─────────────────────────────────────
ALTER TABLE thematic_axes
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── guidelines.eventId  VARCHAR → UUID ───────────────────────────────────────
ALTER TABLE guidelines
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── organizers.eventId  VARCHAR → UUID ───────────────────────────────────────
ALTER TABLE organizers
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── organizers.countryId  VARCHAR → UUID (solo donde no sea vacío) ────────────
ALTER TABLE organizers
  ALTER COLUMN "countryId" TYPE UUID USING NULLIF("countryId", '')::uuid;

-- ── submissions.eventId  VARCHAR → UUID ──────────────────────────────────────
ALTER TABLE submissions
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── submissions.thematicAxisId  VARCHAR → UUID ────────────────────────────────
ALTER TABLE submissions
  ALTER COLUMN "thematicAxisId" TYPE UUID USING "thematicAxisId"::uuid;

-- ── submissions.productTypeId  VARCHAR → UUID ─────────────────────────────────
ALTER TABLE submissions
  ALTER COLUMN "productTypeId" TYPE UUID USING "productTypeId"::uuid;

-- ── submissions.countryId  VARCHAR → UUID ─────────────────────────────────────
ALTER TABLE submissions
  ALTER COLUMN "countryId" TYPE UUID USING NULLIF("countryId", '')::uuid;

-- ── submission_authors.submissionId  VARCHAR → UUID ───────────────────────────
ALTER TABLE submission_authors
  ALTER COLUMN "submissionId" TYPE UUID USING "submissionId"::uuid;

-- ── submission_authors.countryId  VARCHAR → UUID ──────────────────────────────
ALTER TABLE submission_authors
  ALTER COLUMN "countryId" TYPE UUID USING NULLIF("countryId", '')::uuid;

-- ── submission_status_history.submissionId  VARCHAR → UUID ────────────────────
ALTER TABLE submission_status_history
  ALTER COLUMN "submissionId" TYPE UUID USING "submissionId"::uuid;

-- ── submission_status_history.changedById  VARCHAR → UUID ─────────────────────
ALTER TABLE submission_status_history
  ALTER COLUMN "changedById" TYPE UUID USING NULLIF("changedById", '')::uuid;

-- ── agenda_slots.eventId  VARCHAR → UUID ──────────────────────────────────────
ALTER TABLE agenda_slots
  ALTER COLUMN "eventId" TYPE UUID USING "eventId"::uuid;

-- ── agenda_slots.submissionId  VARCHAR → UUID ─────────────────────────────────
ALTER TABLE agenda_slots
  ALTER COLUMN "submissionId" TYPE UUID USING NULLIF("submissionId", '')::uuid;

-- ── agenda_slots.thematicAxisId  VARCHAR → UUID ───────────────────────────────
ALTER TABLE agenda_slots
  ALTER COLUMN "thematicAxisId" TYPE UUID USING NULLIF("thematicAxisId", '')::uuid;

-- ── Insertar pauta de presentación (idempotente) ──────────────────────────────
DO $$
DECLARE
  v_event_id  UUID;
  v_max_order INT;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE "isActive" = TRUE LIMIT 1;
  IF v_event_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM guidelines
    WHERE "eventId" = v_event_id
      AND "fileUrl" = '/uploads/guidelines/plantilla-presentacion-umayor.pptx'
  ) THEN
    RAISE NOTICE 'Pauta ya existe.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX("displayOrder"), 0) + 1 INTO v_max_order
    FROM guidelines WHERE "eventId" = v_event_id;

  INSERT INTO guidelines (
    id, "eventId", title, content, category, "iconName",
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
    || '<li>Título en <strong>negrita</strong>, 24–28 pt.</li>'
    || '<li>Máximo <strong>10 diapositivas</strong> + portada y bibliografía.</li>'
    || '<li>No modifique colores corporativos ni encabezado/pie de página.</li>'
    || '<li><strong>15 min</strong> exposición + <strong>5 min</strong> preguntas.</li>'
    || '</ul>',
    'submission', 'Presentation',
    v_max_order, TRUE,
    '/uploads/guidelines/plantilla-presentacion-umayor.pptx',
    'PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    NOW(), NOW()
  );
  RAISE NOTICE 'Pauta insertada.';
END $$;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
  'event_page_sections','thematic_axes','guidelines','organizers',
  'submissions','submission_authors','submission_status_history','agenda_slots'
)
AND column_name IN (
  'eventId','thematicAxisId','productTypeId',
  'countryId','submissionId','changedById'
)
ORDER BY table_name, column_name;
