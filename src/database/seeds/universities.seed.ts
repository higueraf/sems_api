import { DataSource } from 'typeorm';
import { Country } from '../../entities/country.entity';
import { University } from '../../entities/university.entity';
import { Faculty } from '../../entities/faculty.entity';

/** Institución sede del evento — habilita reglas y campos especiales para sus estudiantes. */
const HOST_UNIVERSITY_NAME = 'Institución Universitaria Mayor de Cartagena (UMAYOR)';
const HOST_UNIVERSITY_COUNTRY_ISO = 'CO';

/** Facultades reales de UMAYOR (umayor.edu.co/facultades) — administrable desde el panel si cambian. */
const HOST_UNIVERSITY_FACULTIES = [
  'Arquitectura e Ingeniería',
  'Administración y Turismo',
  'Ciencias Sociales y Educación',
];

/**
 * Universidades más representativas por país (no exhaustivo).
 * Los nombres marcados fueron pedidos explícitamente para su inclusión.
 */
const UNIVERSITIES_BY_COUNTRY: Record<string, string[]> = {
  CO: [
    'Universidad Nacional de Colombia',
    'Universidad de los Andes',
    'Pontificia Universidad Javeriana',
    'Universidad del Rosario',
    'Universidad EAFIT',
    'Universidad de Antioquia',
    'Universidad del Valle',
    'Universidad Externado de Colombia',
    'Universidad Industrial de Santander',
    'Universidad del Norte',
    'Universidad de Cartagena',
    HOST_UNIVERSITY_NAME, // pedida explícitamente — umayor.edu.co
    'Pontificia Universidad Bolivariana',
    'Universidad Militar Nueva Granada',
    'Universidad Icesi',
  ],
  EC: [
    'Universidad UTE', // pedida explícitamente
    'Escuela Politécnica Nacional',
    'Universidad San Francisco de Quito',
    'Pontificia Universidad Católica del Ecuador',
    'Universidad de Cuenca',
    'Universidad Central del Ecuador',
    'Escuela Superior Politécnica del Litoral',
    'Universidad Técnica Particular de Loja',
    'Universidad Andina Simón Bolívar',
    'Universidad de Las Américas',
    'Universidad Católica de Santiago de Guayaquil',
  ],
  VE: [
    'Universidad Nacional Experimental Francisco de Miranda', // pedida explícitamente (UNEFM)
    'Universidad Central de Venezuela',
    'Universidad Simón Bolívar',
    'Universidad de Los Andes',
    'Universidad del Zulia',
    'Universidad Católica Andrés Bello',
    'Universidad de Carabobo',
    'Universidad de Oriente',
    'Universidad Nacional Experimental Simón Rodríguez',
    'Universidad Metropolitana',
  ],
  PE: [
    'Pontificia Universidad Católica del Perú',
    'Universidad Nacional Mayor de San Marcos',
    'Universidad de Lima',
    'Universidad del Pacífico',
    'Universidad Peruana Cayetano Heredia',
    'Universidad ESAN',
    'Universidad Nacional de Ingeniería',
    'Universidad de San Martín de Porres',
    'Universidad San Ignacio de Loyola',
    'Universidad Nacional Agraria La Molina',
  ],
  CL: [
    'Universidad de Chile',
    'Pontificia Universidad Católica de Chile',
    'Universidad de Concepción',
    'Universidad de Santiago de Chile',
    'Universidad Técnica Federico Santa María',
    'Universidad Adolfo Ibáñez',
    'Universidad Diego Portales',
    'Universidad Austral de Chile',
    'Pontificia Universidad Católica de Valparaíso',
    'Universidad Andrés Bello',
  ],
  AR: [
    'Universidad de Buenos Aires',
    'Universidad Nacional de Córdoba',
    'Universidad Nacional de La Plata',
    'Universidad Torcuato Di Tella',
    'Universidad de San Andrés',
    'Universidad Austral',
    'Universidad Católica Argentina',
    'Universidad Nacional del Litoral',
    'Universidad Nacional de Rosario',
    'Universidad de Belgrano',
  ],
  PA: [
    'Universidad de Panamá',
    'Universidad Tecnológica de Panamá',
    'Universidad Santa María La Antigua',
    'Universidad Latina de Panamá',
    'Universidad Especializada de las Américas',
    'Universidad del Istmo',
    'Universidad Interamericana de Panamá',
  ],
};

export async function seedUniversities(dataSource: DataSource) {
  const countryRepo = dataSource.getRepository(Country);
  const universityRepo = dataSource.getRepository(University);
  const facultyRepo = dataSource.getRepository(Faculty);

  let created = 0;
  let skippedExisting = 0;

  for (const [isoCode, names] of Object.entries(UNIVERSITIES_BY_COUNTRY)) {
    const country = await countryRepo.findOne({ where: { isoCode } });
    if (!country) {
      console.warn(`⚠️  País con isoCode "${isoCode}" no encontrado — ejecute primero el seed de países ("npm run seed"). Omitiendo sus universidades.`);
      continue;
    }

    for (const name of names) {
      const exists = await universityRepo
        .createQueryBuilder('u')
        .where('u.countryId = :countryId', { countryId: country.id })
        .andWhere('LOWER(u.name) = LOWER(:name)', { name })
        .getOne();

      if (exists) {
        skippedExisting++;
        continue;
      }

      await universityRepo.save(universityRepo.create({ name, countryId: country.id }));
      created++;
    }
  }

  console.log(`✅ Universidades sembradas: ${created} creadas, ${skippedExisting} ya existían.`);

  // ─── Marcar UMAYOR como institución sede + sembrar sus facultades ─────────
  const hostCountry = await countryRepo.findOne({ where: { isoCode: HOST_UNIVERSITY_COUNTRY_ISO } });
  const hostUniversity = hostCountry
    ? await universityRepo.findOne({ where: { name: HOST_UNIVERSITY_NAME, countryId: hostCountry.id } })
    : null;

  if (!hostUniversity) {
    console.warn(`⚠️  No se encontró "${HOST_UNIVERSITY_NAME}" — omitiendo marca de institución sede y facultades.`);
    return;
  }

  if (!hostUniversity.isHostInstitution) {
    hostUniversity.isHostInstitution = true;
    await universityRepo.save(hostUniversity);
    console.log(`✅ "${HOST_UNIVERSITY_NAME}" marcada como institución sede.`);
  }

  let facultiesCreated = 0;
  for (const name of HOST_UNIVERSITY_FACULTIES) {
    const exists = await facultyRepo.findOne({ where: { name, universityId: hostUniversity.id } });
    if (exists) continue;
    await facultyRepo.save(facultyRepo.create({ name, universityId: hostUniversity.id }));
    facultiesCreated++;
  }
  console.log(`✅ Facultades de UMAYOR sembradas: ${facultiesCreated} creadas.`);
}
