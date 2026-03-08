-- =============================================================================
-- SEMS: Script de migración y datos iniciales
-- Fecha: 2026-03-08
-- Descripción:
--   1. Agrega columnas file_url, file_name, file_mime_type a la tabla guidelines
--      (TypeORM synchronize: true lo hace automáticamente, pero este script es
--       el respaldo manual por si se requiere ejecutar explícitamente)
--   2. Inserta la pauta "Guía de Presentación de Ponencias" con la plantilla PPTX
-- =============================================================================

-- ── 1. Columnas nuevas en guidelines (idempotente) ───────────────────────────
ALTER TABLE guidelines
  ADD COLUMN IF NOT EXISTS file_url       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_name      VARCHAR DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_mime_type VARCHAR DEFAULT NULL;

-- ── 2. Insertar la pauta de guía de presentación ─────────────────────────────
DO $$
DECLARE
  v_event_id      UUID;
  v_max_order     INT;
  v_guideline_id  UUID;
  v_file_url      TEXT := '/uploads/guidelines/plantilla-presentacion-umayor.pptx';
  v_file_name     TEXT := 'PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx';
  v_mime_type     TEXT := 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
BEGIN
  SELECT id INTO v_event_id FROM events WHERE is_active = TRUE LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'No hay evento activo. No se inserto la pauta de presentacion.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM guidelines WHERE event_id = v_event_id AND file_url = v_file_url
  ) THEN
    RAISE NOTICE 'La pauta de presentacion ya existe. No se duplica.';
    RETURN;
  END IF;

  SELECT COALESCE(MAX(display_order), 0) + 1
    INTO v_max_order
    FROM guidelines
   WHERE event_id = v_event_id;

  INSERT INTO guidelines (
    id, event_id, title, content, category, icon_name,
    display_order, is_visible, file_url, file_name, file_mime_type,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_event_id,
    'Plantilla Oficial de Presentación de Ponencias',
    '<p>Descargue la plantilla oficial en formato PowerPoint para preparar su presentación. '
    || 'Esta plantilla incluye la identidad visual de la Universidad Mayor y los lineamientos '
    || 'de formato requeridos para su presentación durante el evento.</p>'
    || '<ul>'
    || '<li>Use fuente <strong>Calibri</strong> o <strong>Arial</strong>, tamaño mínimo 18 pt en el cuerpo.</li>'
    || '<li>El título de cada diapositiva debe ir en <strong>negrita</strong>, tamaño 24–28 pt.</li>'
    || '<li>Máximo <strong>10 diapositivas</strong> de contenido, más portada y bibliografía.</li>'
    || '<li>Incluya el logotipo institucional en la portada conforme a la plantilla.</li>'
    || '<li>No modifique los colores corporativos ni el encabezado/pie de página.</li>'
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
  )
  RETURNING id INTO v_guideline_id;

  RAISE NOTICE 'Pauta insertada con ID: %', v_guideline_id;
END
$$;

-- ── 3. Verificación final ─────────────────────────────────────────────────────
SELECT
  g.id,
  g.title,
  g.category,
  g.display_order,
  g.is_visible,
  g.file_url,
  g.file_name,
  e.name AS event_name
FROM guidelines g
JOIN events e ON e.id = g.event_id
ORDER BY g.display_order;
