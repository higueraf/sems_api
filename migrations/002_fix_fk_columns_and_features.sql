-- =============================================================================
-- SEMS: Migración 002 — Corrección de columnas FK y nuevas funcionalidades
-- Fecha: 2026-03-08
-- Autor: Sistema
-- Descripción:
--   1. Tabla pivote submission_product_types para multi-selección de tipos
--   2. Columnas de archivo en guidelines (fileUrl, fileName, fileMimeType)
--   3. Inserta la pauta "Plantilla Oficial de Presentación de Ponencias" con PPTX
-- =============================================================================

-- ── 1. Tabla pivote para relación M:N submission ↔ product_type ──────────────
CREATE TABLE IF NOT EXISTS submission_product_types (
  "submissionId"   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  "productTypeId"  UUID NOT NULL REFERENCES scientific_product_types(id) ON DELETE CASCADE,
  PRIMARY KEY ("submissionId", "productTypeId")
);

-- Migrar datos existentes de productTypeId a la tabla pivote
INSERT INTO submission_product_types ("submissionId", "productTypeId")
SELECT id, "productTypeId"::uuid
FROM submissions
WHERE "productTypeId" IS NOT NULL
  AND "productTypeId" != ''
  AND "productTypeId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT DO NOTHING;

-- ── 2. Columnas de archivo en guidelines (idempotente) ───────────────────────
ALTER TABLE guidelines
  ADD COLUMN IF NOT EXISTS "fileUrl"       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "fileName"      VARCHAR DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "fileMimeType"  VARCHAR DEFAULT NULL;

-- ── 3. Insertar pauta "Plantilla de Presentación" ────────────────────────────
DO $$
DECLARE
  v_event_id     UUID;
  v_max_order    INT;
  v_file_url     TEXT := '/uploads/guidelines/plantilla-presentacion-umayor.pptx';
  v_file_name    TEXT := 'PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx';
  v_mime_type    TEXT := 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
BEGIN
  SELECT id INTO v_event_id FROM events WHERE "isActive" = TRUE LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'No hay evento activo. Pauta no insertada.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM guidelines
    WHERE "eventId" = v_event_id::text
      AND "fileUrl" = v_file_url
  ) THEN
    RAISE NOTICE 'La pauta de presentación ya existe. No se duplica.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX("displayOrder"), 0) + 1
    INTO v_max_order
    FROM guidelines
   WHERE "eventId" = v_event_id::text;

  INSERT INTO guidelines (
    id,
    "eventId",
    title,
    content,
    category,
    "iconName",
    "displayOrder",
    "isVisible",
    "fileUrl",
    "fileName",
    "fileMimeType",
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_event_id::text,
    'Plantilla Oficial de Presentación de Ponencias',
    '<p>Descargue la <strong>plantilla oficial</strong> en formato PowerPoint para preparar su presentación. '
    || 'Esta plantilla incluye la identidad visual de la Universidad Mayor y los lineamientos '
    || 'de formato requeridos para su exposición durante el evento.</p>'
    || '<ul>'
    || '<li>Fuente: <strong>Calibri</strong> o <strong>Arial</strong>, tamaño mínimo <strong>18 pt</strong> en el cuerpo.</li>'
    || '<li>El título de cada diapositiva en <strong>negrita</strong>, tamaño 24–28 pt.</li>'
    || '<li>Máximo <strong>10 diapositivas</strong> de contenido más portada y bibliografía.</li>'
    || '<li>Incluya el logotipo institucional en la portada conforme a la plantilla.</li>'
    || '<li>No modifique los colores corporativos ni el encabezado/pie de página.</li>'
    || '<li>Tiempo de presentación: <strong>15 minutos</strong> de exposición + 5 minutos de preguntas.</li>'
    || '</ul>',
    'submission',
    'Presentation',
    v_max_order,
    TRUE,
    v_file_url,
    v_file_name,
    v_mime_type,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Pauta de presentación insertada exitosamente.';
END
$$;

-- ── 4. Verificación final ─────────────────────────────────────────────────────
SELECT
  g.id,
  g.title,
  g.category,
  g."displayOrder",
  g."isVisible",
  g."fileUrl",
  g."fileName"
FROM guidelines g
ORDER BY g."displayOrder";
