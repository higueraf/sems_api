-- ============================================================
-- Migración 001: Tabla persons + vínculo a submission_authors
-- ============================================================
-- Ejecutar en producción ANTES de hacer deploy del nuevo código.
-- Es seguro ejecutarlo en cualquier orden (usa IF NOT EXISTS).
-- Los certificados existentes NO se ven afectados.
-- ============================================================

-- 1. Agregar valor 'author' al enum user_role si es un tipo enum de PostgreSQL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'author'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'author';
  END IF;
EXCEPTION WHEN others THEN
  -- Si user_role no es un tipo enum (es varchar), no hacer nada
  NULL;
END$$;

-- 2. Crear tabla persons (registro global de autores)
CREATE TABLE IF NOT EXISTS persons (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName"          varchar      NOT NULL,
  email               varchar      NOT NULL UNIQUE,
  "academicTitle"     varchar,
  affiliation         varchar,
  orcid               varchar,
  phone               varchar,
  "countryId"         uuid         REFERENCES countries(id),
  city                varchar,
  "identityDocType"   varchar,
  "identityDocNumber" varchar,
  "photoUrl"          text,
  "identityDocUrl"    text,
  "identityDocFileName" varchar,
  "userId"            uuid         REFERENCES users(id),
  "createdAt"         timestamp    NOT NULL DEFAULT NOW(),
  "updatedAt"         timestamp    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persons_email   ON persons (email);
CREATE INDEX IF NOT EXISTS idx_persons_userId  ON persons ("userId");

-- 3. Agregar columna personId a submission_authors (nullable para compatibilidad)
ALTER TABLE submission_authors
  ADD COLUMN IF NOT EXISTS "personId" uuid REFERENCES persons(id);

CREATE INDEX IF NOT EXISTS idx_submission_authors_personId
  ON submission_authors ("personId");

-- ============================================================
-- FIN de migración 001
-- Ejecutar migración 002 después para poblar los datos.
-- ============================================================
