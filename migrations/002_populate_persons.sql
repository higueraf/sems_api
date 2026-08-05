-- ============================================================
-- Migración 002: Poblar tabla persons con datos existentes
-- ============================================================
-- Ejecutar DESPUÉS de la migración 001 y del deploy del nuevo código.
-- Agrupa los submission_authors por email (deduplicando).
-- Vincula personId en submission_authors.
-- Los certificados NO se modifican (siguen apuntando a submission_authors.id).
-- ============================================================

-- 1. Insertar una persona por email único desde submission_authors
WITH normalized AS (
  SELECT *, LOWER(TRIM(email)) AS norm_email
  FROM submission_authors
  WHERE email IS NOT NULL AND TRIM(email) != ''
)
INSERT INTO persons (
  id,
  "fullName",
  email,
  "academicTitle",
  affiliation,
  orcid,
  phone,
  "countryId",
  city,
  "identityDocType",
  "identityDocNumber",
  "photoUrl",
  "identityDocUrl",
  "identityDocFileName"
)
SELECT
  gen_random_uuid(),
  MIN(sa."fullName"),
  sa.norm_email,
  MIN(sa."academicTitle"),
  MIN(sa.affiliation),
  MIN(sa.orcid),
  MIN(sa.phone),
  -- Tomar el countryId más reciente (MIN puede elegir NULL, usar MAX)
  (SELECT sa2."countryId" FROM normalized sa2
   WHERE sa2.norm_email = sa.norm_email
   AND sa2."countryId" IS NOT NULL
   ORDER BY sa2."createdAt" DESC LIMIT 1),
  MIN(sa.city),
  MIN(sa."identityDocType"),
  -- Para identityDocNumber: preferir el que no sea nulo
  (SELECT sa2."identityDocNumber" FROM normalized sa2
   WHERE sa2.norm_email = sa.norm_email
   AND sa2."identityDocNumber" IS NOT NULL
   ORDER BY sa2."createdAt" DESC LIMIT 1),
  -- Foto: tomar la más reciente no nula
  (SELECT sa2."photoUrl" FROM normalized sa2
   WHERE sa2.norm_email = sa.norm_email
   AND sa2."photoUrl" IS NOT NULL
   ORDER BY sa2."createdAt" DESC LIMIT 1),
  -- Documento de identidad: el más reciente no nulo
  (SELECT sa2."identityDocUrl" FROM normalized sa2
   WHERE sa2.norm_email = sa.norm_email
   AND sa2."identityDocUrl" IS NOT NULL
   ORDER BY sa2."createdAt" DESC LIMIT 1),
  (SELECT sa2."identityDocFileName" FROM normalized sa2
   WHERE sa2.norm_email = sa.norm_email
   AND sa2."identityDocFileName" IS NOT NULL
   ORDER BY sa2."createdAt" DESC LIMIT 1)
FROM normalized sa
GROUP BY sa.norm_email
ON CONFLICT (email) DO NOTHING;

-- 2. Vincular personId en submission_authors
UPDATE submission_authors sa
SET "personId" = p.id
FROM persons p
WHERE LOWER(TRIM(sa.email)) = p.email
  AND sa."personId" IS NULL;

-- 3. Verificación: mostrar cuántas personas se crearon y cuántos autores se vincularon
SELECT
  (SELECT COUNT(*) FROM persons)                            AS total_persons,
  (SELECT COUNT(*) FROM submission_authors WHERE "personId" IS NOT NULL) AS authors_linked,
  (SELECT COUNT(*) FROM submission_authors WHERE "personId" IS NULL)     AS authors_unlinked;

-- ============================================================
-- FIN de migración 002
-- ============================================================
