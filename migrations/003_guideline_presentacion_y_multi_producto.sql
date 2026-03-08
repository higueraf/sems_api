-- =============================================================================
-- SEMS: Migración 003 — Insertar pauta de presentación y tabla pivote
-- Ejecutar: bash migrations/run-migration.sh
--           o manualmente con psql
-- =============================================================================

-- ── 1. Tabla pivote submission ↔ product_type (multi-selección) ───────────────
CREATE TABLE IF NOT EXISTS submission_product_types (
  "submissionId"   UUID NOT NULL,
  "productTypeId"  UUID NOT NULL,
  PRIMARY KEY ("submissionId", "productTypeId"),
  CONSTRAINT fk_spt_submission FOREIGN KEY ("submissionId")
    REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_spt_product_type FOREIGN KEY ("productTypeId")
    REFERENCES scientific_product_types(id) ON DELETE CASCADE
);

-- Migrar datos existentes
INSERT INTO submission_product_types ("submissionId", "productTypeId")
SELECT s.id, s."productTypeId"::uuid
FROM submissions s
WHERE s."productTypeId" IS NOT NULL
  AND s."productTypeId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT DO NOTHING;

-- ── 2. Insertar pauta de presentación con PPTX ───────────────────────────────
DO $$
DECLARE
  v_event_id  UUID;
  v_max_order INT;
  v_file_url  TEXT := '/uploads/guidelines/plantilla-presentacion-umayor.pptx';
  v_file_name TEXT := 'PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx';
  v_mime      TEXT := 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
BEGIN
  -- Obtener evento activo
  SELECT id INTO v_event_id FROM events WHERE "isActive" = TRUE LIMIT 1;
  IF v_event_id IS NULL THEN
    RAISE NOTICE 'Sin evento activo. Omitiendo inserción.';
    RETURN;
  END IF;

  -- Evitar duplicados
  IF EXISTS (
    SELECT 1 FROM guidelines
    WHERE "eventId" = v_event_id::text AND "fileUrl" = v_file_url
  ) THEN
    RAISE NOTICE 'La pauta ya existe. Actualizando datos...';
    UPDATE guidelines
    SET
      "fileUrl"      = v_file_url,
      "fileName"     = v_file_name,
      "fileMimeType" = v_mime,
      "updatedAt"    = NOW()
    WHERE "eventId" = v_event_id::text AND "fileUrl" = v_file_url;
    RETURN;
  END IF;

  -- Calcular siguiente orden
  SELECT COALESCE(MAX("displayOrder"), 0) + 1
    INTO v_max_order
    FROM guidelines
   WHERE "eventId" = v_event_id::text;

  -- Insertar
  INSERT INTO guidelines (
    id, "eventId", title, content, category, "iconName",
    "displayOrder", "isVisible", "fileUrl", "fileName", "fileMimeType",
    "createdAt", "updatedAt"
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
    || '<li>Máximo <strong>10 diapositivas</strong> de contenido, más portada y bibliografía.</li>'
    || '<li>Incluya el logotipo institucional en la portada conforme a la plantilla.</li>'
    || '<li>No modifique los colores corporativos ni el encabezado/pie de página.</li>'
    || '<li>Tiempo de presentación: <strong>15 minutos</strong> de exposición + <strong>5 minutos</strong> de preguntas.</li>'
    || '</ul>',
    'submission',
    'Presentation',
    v_max_order,
    TRUE,
    v_file_url,
    v_file_name,
    v_mime,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Pauta de presentación insertada. Orden: %', v_max_order;
END
$$;

-- ── 3. Verificar resultado ────────────────────────────────────────────────────
SELECT id, title, "isVisible", "fileUrl", "fileName"
FROM guidelines
ORDER BY "displayOrder";
