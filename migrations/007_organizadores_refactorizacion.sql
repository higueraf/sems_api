-- ============================================================
-- Migración 007: Refactorización de Organizadores
-- Fecha: 2026-03-08
-- Descripción:
--   1. Agrega columnas faltantes en `organizers`
--      (institutionalPosition, description)
--   2. Crea la tabla `organizer_members` con su enum de roles
--   3. Agrega columna `photoUrl` en `submission_authors`
--
-- IDEMPOTENTE: seguro de ejecutar varias veces (usa IF NOT EXISTS
-- y DO $$ ... $$ para los ALTER TABLE condicionales).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Columnas nuevas en `organizers`
-- ────────────────────────────────────────────────────────────

-- 1a. institutionalPosition (cargo dentro de la institución, solo personas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizers' AND column_name = 'institutionalPosition'
  ) THEN
    ALTER TABLE organizers ADD COLUMN "institutionalPosition" character varying;
    RAISE NOTICE 'Columna organizers.institutionalPosition agregada.';
  ELSE
    RAISE NOTICE 'Columna organizers.institutionalPosition ya existe, omitida.';
  END IF;
END $$;

-- 1b. description (descripción larga de la institución)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizers' AND column_name = 'description'
  ) THEN
    ALTER TABLE organizers ADD COLUMN "description" text;
    RAISE NOTICE 'Columna organizers.description agregada.';
  ELSE
    RAISE NOTICE 'Columna organizers.description ya existe, omitida.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Tabla `organizer_members`
-- ────────────────────────────────────────────────────────────

-- 2a. Enum de roles de miembro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'organizer_members_role_enum'
  ) THEN
    CREATE TYPE organizer_members_role_enum AS ENUM (
      'rector',
      'vice_rector',
      'dean',
      'director',
      'researcher',
      'coordinator',
      'speaker',
      'panelist',
      'committee',
      'contact',
      'other'
    );
    RAISE NOTICE 'Enum organizer_members_role_enum creado.';
  ELSE
    RAISE NOTICE 'Enum organizer_members_role_enum ya existe, omitido.';
  END IF;
END $$;

-- 2b. Tabla organizer_members
CREATE TABLE IF NOT EXISTS organizer_members (
  id                    uuid          NOT NULL DEFAULT uuid_generate_v4(),
  "organizerId"         uuid          NOT NULL,
  "fullName"            character varying NOT NULL,
  "academicTitle"       character varying,
  "institutionalPosition" character varying,
  role                  organizer_members_role_enum NOT NULL DEFAULT 'committee',
  "roleLabel"           character varying,
  bio                   text,
  email                 character varying,
  phone                 character varying,
  "photoUrl"            text,
  "countryId"           uuid,
  "displayOrder"        integer       NOT NULL DEFAULT 0,
  "isVisible"           boolean       NOT NULL DEFAULT true,
  "createdAt"           timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt"           timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT "PK_organizer_members" PRIMARY KEY (id),

  CONSTRAINT "FK_organizer_members_organizer"
    FOREIGN KEY ("organizerId")
    REFERENCES organizers(id)
    ON DELETE CASCADE,

  CONSTRAINT "FK_organizer_members_country"
    FOREIGN KEY ("countryId")
    REFERENCES countries(id)
    ON DELETE SET NULL
);

-- Índice para búsquedas por institución
CREATE INDEX IF NOT EXISTS "IDX_organizer_members_organizerId"
  ON organizer_members ("organizerId");

-- Índice para filtrar visibles por orden
CREATE INDEX IF NOT EXISTS "IDX_organizer_members_order"
  ON organizer_members ("organizerId", "displayOrder");

DO $$
BEGIN
  RAISE NOTICE 'Tabla organizer_members verificada/creada correctamente.';
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. Columna `photoUrl` en `submission_authors`
--    Para subir foto del ponente tras aprobación del trabajo
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submission_authors' AND column_name = 'photoUrl'
  ) THEN
    ALTER TABLE submission_authors ADD COLUMN "photoUrl" text;
    RAISE NOTICE 'Columna submission_authors.photoUrl agregada.';
  ELSE
    RAISE NOTICE 'Columna submission_authors.photoUrl ya existe, omitida.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Verificación final
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_cols_org   int;
  v_cols_auth  int;
  v_members    int;
BEGIN
  SELECT COUNT(*) INTO v_cols_org
  FROM information_schema.columns
  WHERE table_name = 'organizers'
    AND column_name IN ('institutionalPosition', 'description', 'photoUrl', 'title', 'bio', 'email', 'phone');

  SELECT COUNT(*) INTO v_cols_auth
  FROM information_schema.columns
  WHERE table_name = 'submission_authors' AND column_name = 'photoUrl';

  SELECT COUNT(*) INTO v_members
  FROM information_schema.tables
  WHERE table_name = 'organizer_members';

  RAISE NOTICE '────────────────────────────────────────────────';
  RAISE NOTICE 'RESUMEN DE MIGRACIÓN 007:';
  RAISE NOTICE '  organizers — columnas de persona presentes: %/7', v_cols_org;
  RAISE NOTICE '  submission_authors.photoUrl presente:        %/1', v_cols_auth;
  RAISE NOTICE '  organizer_members tabla presente:            %/1', v_members;
  RAISE NOTICE '────────────────────────────────────────────────';

  IF v_cols_org < 7 OR v_cols_auth < 1 OR v_members < 1 THEN
    RAISE EXCEPTION 'Migración incompleta. Revisar mensajes anteriores.';
  END IF;
END $$;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- FIN de migración 007
-- ────────────────────────────────────────────────────────────
