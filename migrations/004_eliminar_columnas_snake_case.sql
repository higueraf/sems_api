-- =============================================================================
-- SEMS Migración 004 — Eliminar columnas snake_case duplicadas y vacías
-- La BD ya usa camelCase correctamente. Las columnas snake_case son residuos
-- generados por versiones anteriores de @JoinColumn y deben eliminarse.
-- =============================================================================

BEGIN;

-- ── agenda_slots ─────────────────────────────────────────────────────────────
ALTER TABLE agenda_slots
  DROP COLUMN IF EXISTS event_id,
  DROP COLUMN IF EXISTS submission_id,
  DROP COLUMN IF EXISTS thematic_axis_id;

-- ── event_page_sections ───────────────────────────────────────────────────────
ALTER TABLE event_page_sections
  DROP COLUMN IF EXISTS event_id;

-- ── guidelines ────────────────────────────────────────────────────────────────
ALTER TABLE guidelines
  DROP COLUMN IF EXISTS event_id;

-- ── organizers ────────────────────────────────────────────────────────────────
ALTER TABLE organizers
  DROP COLUMN IF EXISTS event_id,
  DROP COLUMN IF EXISTS country_id;

-- ── submissions ───────────────────────────────────────────────────────────────
ALTER TABLE submissions
  DROP COLUMN IF EXISTS event_id,
  DROP COLUMN IF EXISTS thematic_axis_id,
  DROP COLUMN IF EXISTS product_type_id,
  DROP COLUMN IF EXISTS country_id;

-- ── submission_authors ────────────────────────────────────────────────────────
ALTER TABLE submission_authors
  DROP COLUMN IF EXISTS submission_id,
  DROP COLUMN IF EXISTS country_id;

-- ── submission_status_history ─────────────────────────────────────────────────
ALTER TABLE submission_status_history
  DROP COLUMN IF EXISTS submission_id,
  DROP COLUMN IF EXISTS changed_by_id;

-- ── Insertar pauta de presentación con PPTX (idempotente) ─────────────────────
DO $$
DECLARE
  v_event_id  UUID;
  v_max_order INT;
BEGIN
  SELECT id INTO v_event_id FROM events WHERE "isActive" = TRUE LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Sin evento activo, omitiendo inserción de pauta.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM guidelines
    WHERE "eventId" = v_event_id::text
      AND "fileUrl" = '/uploads/guidelines/plantilla-presentacion-umayor.pptx'
  ) THEN
    RAISE NOTICE 'Pauta ya existe, omitiendo.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX("displayOrder"), 0) + 1
    INTO v_max_order
    FROM guidelines
   WHERE "eventId" = v_event_id::text;

  INSERT INTO guidelines (
    id, "eventId", title, content, category, "iconName",
    "displayOrder", "isVisible", "fileUrl", "fileName", "fileMimeType",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_event_id::text,
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
  RAISE NOTICE 'Pauta de presentación insertada en orden %', v_max_order;
END $$;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
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
-- Si la consulta retorna 0 filas, la limpieza fue exitosa.
