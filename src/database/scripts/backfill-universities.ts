/**
 * Backfill de universidades a partir del texto libre histórico en `affiliation`.
 *
 * Qué hace:
 *  1. Recolecta pares (affiliation, countryId) distintos desde `persons` y
 *     `submission_authors` que todavía no tienen `universityId`.
 *  2. Por cada par con countryId conocido, crea (o reutiliza, case-insensitive)
 *     una fila en `universities` y actualiza `universityId` en los registros
 *     que coincidan (mismo país + mismo texto de afiliación, sin distinguir mayúsculas).
 *  3. Los registros con `affiliation` pero SIN `countryId` no se pueden migrar
 *     automáticamente (University.countryId es obligatorio) — se listan al final
 *     para revisión manual desde el panel admin de Universidades.
 *
 * No borra la columna `affiliation`: solo puebla `universityId` en paralelo.
 * Es seguro volver a ejecutarlo (idempotente: omite filas que ya tienen universityId).
 *
 * Uso:
 *   cd sems_api
 *   npx ts-node -r tsconfig-paths/register src/database/scripts/backfill-universities.ts
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../../entities/user.entity';
import { Country } from '../../entities/country.entity';
import { Event } from '../../entities/event.entity';
import { EventVideo } from '../../entities/event-video.entity';
import { EventPageSection } from '../../entities/event-page-section.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { ThematicAxis } from '../../entities/thematic-axis.entity';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizerMember } from '../../entities/organizer-member.entity';
import { Guideline } from '../../entities/guideline.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionFile } from '../../entities/submission-file.entity';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { EmailLog } from '../../entities/email-log.entity';
import { Workshop } from '../../entities/workshop.entity';
import { Certificate } from '../../entities/certificate.entity';
import { Person } from '../../entities/person.entity';
import { University } from '../../entities/university.entity';
import { Faculty } from '../../entities/faculty.entity';
import { ResearchGroup } from '../../entities/research-group.entity';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'sems_db',
  // Lista completa (igual que app.module.ts) — TypeORM necesita la metadata de
  // toda entidad referenciada por una relación, aunque este script no la use.
  entities: [
    User, Country, Event, EventVideo, EventPageSection, ScientificProductType,
    ThematicAxis, Organizer, OrganizerMember, Guideline, Submission, SubmissionAuthor,
    SubmissionStatusHistory, SubmissionFile, AgendaSlot, EmailLog, Workshop,
    Certificate, Person, University, Faculty, ResearchGroup,
  ],
  synchronize: true,
});

interface AffiliationRow {
  affiliation: string;
  countryId: string | null;
}

async function collectDistinct(query: string): Promise<AffiliationRow[]> {
  return dataSource.query(query);
}

async function run() {
  await dataSource.initialize();
  console.log('📦 Conectado. Analizando afiliaciones existentes...\n');

  const universityRepo = dataSource.getRepository(University);

  const personRows: AffiliationRow[] = await collectDistinct(`
    SELECT DISTINCT TRIM(affiliation) AS affiliation, "countryId"
    FROM persons
    WHERE affiliation IS NOT NULL AND TRIM(affiliation) != '' AND "universityId" IS NULL
  `);
  const authorRows: AffiliationRow[] = await collectDistinct(`
    SELECT DISTINCT TRIM(affiliation) AS affiliation, "countryId"
    FROM submission_authors
    WHERE affiliation IS NOT NULL AND TRIM(affiliation) != '' AND "universityId" IS NULL
  `);

  const withCountry = [...personRows, ...authorRows].filter((r) => r.countryId);
  const withoutCountry = [...personRows, ...authorRows].filter((r) => !r.countryId);

  // Deduplicar por (affiliation lower, countryId)
  const seen = new Set<string>();
  const pairs: AffiliationRow[] = [];
  for (const r of withCountry) {
    const key = `${r.countryId}::${r.affiliation.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(r);
  }

  console.log(`🔎 ${pairs.length} combinaciones (universidad, país) distintas por migrar.`);
  if (withoutCountry.length) {
    console.log(`⚠️  ${withoutCountry.length} registros tienen afiliación pero SIN país — no se migran automáticamente:`);
    const distinctNoCountry = [...new Set(withoutCountry.map((r) => r.affiliation))];
    distinctNoCountry.slice(0, 30).forEach((a) => console.log(`    - "${a}"`));
    if (distinctNoCountry.length > 30) console.log(`    ... y ${distinctNoCountry.length - 30} más.`);
  }

  let created = 0;
  let reused = 0;

  for (const { affiliation, countryId } of pairs) {
    let university = await universityRepo
      .createQueryBuilder('u')
      .where('u.countryId = :countryId', { countryId })
      .andWhere('LOWER(u.name) = LOWER(:name)', { name: affiliation })
      .getOne();

    if (university) {
      reused++;
    } else {
      university = await universityRepo.save(universityRepo.create({ name: affiliation, countryId }));
      created++;
    }

    await dataSource.query(
      `UPDATE persons SET "universityId" = $1
       WHERE "countryId" = $2 AND LOWER(TRIM(affiliation)) = LOWER($3) AND "universityId" IS NULL`,
      [university.id, countryId, affiliation],
    );
    await dataSource.query(
      `UPDATE submission_authors SET "universityId" = $1
       WHERE "countryId" = $2 AND LOWER(TRIM(affiliation)) = LOWER($3) AND "universityId" IS NULL`,
      [university.id, countryId, affiliation],
    );
  }

  console.log(`\n✅ Backfill completo: ${created} universidades creadas, ${reused} reutilizadas.`);
  console.log('   Revisa el catálogo en el panel admin (Universidades) para fusionar duplicados por typos.');

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Backfill falló:', err);
  process.exit(1);
});
