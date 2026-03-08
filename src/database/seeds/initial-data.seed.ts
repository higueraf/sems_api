import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Country } from '../../entities/country.entity';
import { Event } from '../../entities/event.entity';
import { EventPageSection } from '../../entities/event-page-section.entity';
import { ThematicAxis } from '../../entities/thematic-axis.entity';
import { Organizer } from '../../entities/organizer.entity';
import { Guideline } from '../../entities/guideline.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { UserRole } from '../../common/enums/role.enum';
import {
  EventFormat, OrganizerRole, OrganizerType, GuidelineCategory,
} from '../../common/enums/submission-status.enum';

export async function seed(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const countryRepo = dataSource.getRepository(Country);
  const eventRepo = dataSource.getRepository(Event);
  const sectionRepo = dataSource.getRepository(EventPageSection);
  const axisRepo = dataSource.getRepository(ThematicAxis);
  const organizerRepo = dataSource.getRepository(Organizer);
  const guidelineRepo = dataSource.getRepository(Guideline);
  const productTypeRepo = dataSource.getRepository(ScientificProductType);

  // ─── Countries ───────────────────────────────────────────────────────────
  const countriesData = [
    { name: 'Colombia', isoCode: 'CO', flagEmoji: '🇨🇴' },
    { name: 'Ecuador', isoCode: 'EC', flagEmoji: '🇪🇨' },
    { name: 'Panamá', isoCode: 'PA', flagEmoji: '🇵🇦' },
    { name: 'México', isoCode: 'MX', flagEmoji: '🇲🇽' },
    { name: 'Chile', isoCode: 'CL', flagEmoji: '🇨🇱' },
    { name: 'Perú', isoCode: 'PE', flagEmoji: '🇵🇪' },
    { name: 'Uruguay', isoCode: 'UY', flagEmoji: '🇺🇾' },
    { name: 'Argentina', isoCode: 'AR', flagEmoji: '🇦🇷' },
    { name: 'España', isoCode: 'ES', flagEmoji: '🇪🇸' },
    { name: 'Venezuela', isoCode: 'VE', flagEmoji: '🇻🇪' },
    { name: 'Bolivia', isoCode: 'BO', flagEmoji: '🇧🇴' },
    { name: 'Paraguay', isoCode: 'PY', flagEmoji: '🇵🇾' },
    { name: 'Costa Rica', isoCode: 'CR', flagEmoji: '🇨🇷' },
    { name: 'Guatemala', isoCode: 'GT', flagEmoji: '🇬🇹' },
    { name: 'Honduras', isoCode: 'HN', flagEmoji: '🇭🇳' },
    { name: 'Nicaragua', isoCode: 'NI', flagEmoji: '🇳🇮' },
    { name: 'El Salvador', isoCode: 'SV', flagEmoji: '🇸🇻' },
    { name: 'Cuba', isoCode: 'CU', flagEmoji: '🇨🇺' },
    { name: 'República Dominicana', isoCode: 'DO', flagEmoji: '🇩🇴' },
    { name: 'Brasil', isoCode: 'BR', flagEmoji: '🇧🇷' },
    { name: 'Estados Unidos', isoCode: 'US', flagEmoji: '🇺🇸' },
    { name: 'Portugal', isoCode: 'PT', flagEmoji: '🇵🇹' },
  ];

  const savedCountries: Record<string, Country> = {};
  for (const c of countriesData) {
    let country = await countryRepo.findOne({ where: { isoCode: c.isoCode } });
    if (!country) {
      country = await countryRepo.save(countryRepo.create(c));
    }
    savedCountries[c.isoCode] = country;
  }
  console.log('✅ Countries seeded');

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminExists = await userRepo.findOne({ where: { email: 'admin@sems.edu' } });
  if (!adminExists) {
    // Pass plain text — @BeforeInsert() hook in User entity will hash it
    const admin = userRepo.create({
      email: 'admin@sems.edu',
      password: 'Admin2026!',
      firstName: 'Administrador',
      lastName: 'SEMS',
      role: UserRole.ADMIN,
      isActive: true,
    });
    await userRepo.save(admin);
  }

  const evalExists = await userRepo.findOne({ where: { email: 'evaluador@sems.edu' } });
  if (!evalExists) {
    const evaluador = userRepo.create({
      email: 'evaluador@sems.edu',
      password: 'Eval2026!',
      firstName: 'Evaluador',
      lastName: 'Científico',
      role: UserRole.EVALUATOR,
      isActive: true,
    });
    await userRepo.save(evaluador);
  }
  console.log('✅ Users seeded');

  // ─── Scientific Product Types ─────────────────────────────────────────────
  const productTypesData = [
    {
      name: 'Artículo Científico',
      description: 'Artículo de investigación con metodología, resultados y discusión.',
      maxAuthors: 4,
      minPages: 6,
      maxPages: 10,
      maxPresentationMinutes: 15,
      requiresFile: true,
      formatGuidelinesHtml: '<p>Formato Times New Roman 12pt, interlineado 1.5, máximo 10 páginas incluyendo bibliografía. Citas en formato APA 7ma edición.</p>',
    },
    {
      name: 'Capítulo de Libro',
      description: 'Capítulo para libro científico con revisión por pares.',
      maxAuthors: 4,
      minPages: 10,
      maxPages: 20,
      maxPresentationMinutes: 20,
      requiresFile: true,
      formatGuidelinesHtml: '<p>Formato Times New Roman 12pt, márgenes 2.5cm sup/inf, 3cm izq/der. Mínimo 10 páginas, máximo 20.</p>',
    },
    {
      name: 'Ponencia / Comunicación Oral',
      description: 'Presentación oral de investigación o avance de investigación.',
      maxAuthors: 4,
      minPages: 4,
      maxPages: 8,
      maxPresentationMinutes: 15,
      requiresFile: false,
      formatGuidelinesHtml: '<p>Resumen ampliado. Presentación de máximo 15 minutos. Se debe enviar el resumen en formato indicado.</p>',
    },
    {
      name: 'Póster Científico',
      description: 'Presentación en formato de cartel científico.',
      maxAuthors: 4,
      minPages: 1,
      maxPages: 2,
      maxPresentationMinutes: 5,
      requiresFile: true,
      formatGuidelinesHtml: '<p>Formato A0 (841 x 1189 mm). Debe incluir: título, autores, introducción, metodología, resultados y conclusiones.</p>',
    },
  ];

  const savedProductTypes: Record<string, ScientificProductType> = {};
  for (const pt of productTypesData) {
    let existing = await productTypeRepo.findOne({ where: { name: pt.name } });
    if (!existing) {
      existing = await productTypeRepo.save(productTypeRepo.create({ ...pt, isActive: true }));
    }
    savedProductTypes[pt.name] = existing;
  }
  console.log('✅ Scientific product types seeded');

  // ─── Event: II Simposio Internacional de Ciencia Abierta 2026 ─────────────
  let event = await eventRepo.findOne({
    where: { name: 'II Simposio Internacional de Ciencia Abierta 2026' },
  });

  if (!event) {
    event = await eventRepo.save(
      eventRepo.create({
        name: 'II Simposio Internacional de Ciencia Abierta 2026',
        edition: 'II',
        tagline: 'Innovación para Transformar el Conocimiento en Sociedad',
        description: `El II Simposio Internacional de Ciencia Abierta 2026 es un espacio académico internacional de carácter híbrido que busca promover la integración académica internacional para fortalecer la ciencia abierta, la innovación digital y la democratización del conocimiento como motor de transformación social.

Con una duración de 80 horas académicas certificadas, el simposio reúne a investigadores, docentes, estudiantes y profesionales de diversas disciplinas para compartir avances científicos, experiencias de innovación y reflexiones sobre el impacto del conocimiento en la sociedad.

El evento se realizará del 18 al 22 de mayo de 2026 en la Institución Universitaria Mayor de Cartagena (UMAYOR), Cartagena de Indias, Colombia, con participación internacional a través de plataformas digitales.`,
        startDate: new Date('2026-05-18'),
        endDate: new Date('2026-05-22'),
        location: 'Institución Universitaria Mayor de Cartagena (UMAYOR)',
        city: 'Cartagena de Indias',
        country: 'Colombia',
        format: EventFormat.HYBRID,
        certifiedHours: 80,
        expectedAttendees: 400,
        maxPresentations: 274,
        isActive: true,
        isAgendaPublished: false,
        submissionDeadline: new Date('2026-05-08'),
        reviewDeadline: new Date('2026-05-12'),
        contactEmail: 'david.moralesl@ute.edu.ec',
        contactPhone: '0989221612',
      }),
    );
  }
  console.log('✅ Event seeded');

  // ─── Thematic Axes ────────────────────────────────────────────────────────
  const axesData = [
    {
      name: 'Ciencia Abierta',
      description: 'Acceso abierto, datos abiertos, repositorios, transparencia científica y colaboración. Promoción del acceso libre a publicaciones científicas y datos de investigación.',
      color: '#007F3A',
      icon: 'BookOpen',
      displayOrder: 1,
    },
    {
      name: 'Humanidades, Comunicación y Sociedad',
      description: 'Comunicación científica, cultura digital, ética informacional, transformación social. Fortalecimiento de la comunicación científica digital.',
      color: '#E60553',
      icon: 'Users',
      displayOrder: 2,
    },
    {
      name: 'Economía, Empresa y Turismo',
      description: 'Innovación empresarial, economía digital, emprendimiento, desarrollo sostenible. Presentación de experiencias exitosas en innovación y ciencia abierta.',
      color: '#fcb900',
      icon: 'TrendingUp',
      displayOrder: 3,
    },
    {
      name: 'Tecnología e Innovación',
      description: 'Inteligencia artificial, transformación digital, tecnologías emergentes. Generación de espacios de diálogo entre academia, medios y sociedad.',
      color: '#0693e3',
      icon: 'Cpu',
      displayOrder: 4,
    },
    {
      name: 'Educación y Retos en el Aprendizaje',
      description: 'Educación digital, metodologías innovadoras, literacidad científica. Nuevos modelos pedagógicos para la era digital.',
      color: '#9b51e0',
      icon: 'GraduationCap',
      displayOrder: 5,
    },
    {
      name: 'Ciencias de la Salud',
      description: 'Investigación en salud, evidencia científica, bienestar social. Avances en ciencias biomédicas y salud pública.',
      color: '#00d084',
      icon: 'Heart',
      displayOrder: 6,
    },
  ];

  const savedAxes: Record<string, ThematicAxis> = {};
  for (const axisData of axesData) {
    let axis = await axisRepo.findOne({ where: { eventId: event.id, name: axisData.name } });
    if (!axis) {
      axis = await axisRepo.save(axisRepo.create({ ...axisData, eventId: event.id, isActive: true }));
    }
    savedAxes[axisData.name] = axis;
  }
  console.log('✅ Thematic axes seeded');

  // ─── Organizers ───────────────────────────────────────────────────────────
  const organizersData = [
    {
      type: OrganizerType.INSTITUTION,
      name: 'Institución Universitaria Mayor de Cartagena',
      shortName: 'UMAYOR',
      role: OrganizerRole.HOST,
      countryIso: 'CO',
      website: 'https://www.umayor.edu.co',
      displayOrder: 1,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Universidad UTE',
      shortName: 'UTE',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      website: 'https://www.ute.edu.ec',
      displayOrder: 2,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Universidad Estatal de Bolívar',
      shortName: 'UEB',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      website: 'https://www.ueb.edu.ec',
      displayOrder: 3,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Universidad Técnica de Ambato',
      shortName: 'UTA',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      website: 'https://www.uta.edu.ec',
      displayOrder: 4,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Universidad Estatal Península de Santa Elena',
      shortName: 'UPSE',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      displayOrder: 5,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Universidad Internacional Nueva Luz',
      shortName: 'UINL',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'PA',
      displayOrder: 6,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Federación Nacional de Periodistas del Ecuador',
      shortName: 'FENAPE',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      displayOrder: 7,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Red de Radios Universitarias del Ecuador',
      shortName: 'RRUE',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      displayOrder: 8,
    },
    {
      type: OrganizerType.INSTITUTION,
      name: 'Colegio de Periodistas de Bolívar',
      shortName: 'COLPB',
      role: OrganizerRole.CO_ORGANIZER,
      countryIso: 'EC',
      displayOrder: 9,
    },
    {
      type: OrganizerType.PERSON,
      name: 'Emilia Polo',
      title: 'Coordinadora General',
      role: OrganizerRole.ORGANIZING_COMMITTEE,
      countryIso: 'CO',
      displayOrder: 10,
    },
    {
      type: OrganizerType.PERSON,
      name: 'David Alexander Morales López',
      title: 'Coordinador Ecuador',
      role: OrganizerRole.CONTACT,
      countryIso: 'EC',
      email: 'david.moralesl@ute.edu.ec',
      phone: '0989221612',
      displayOrder: 11,
    },
    {
      type: OrganizerType.PERSON,
      name: 'María Fernanda Vargas Guerra',
      title: 'Coordinadora Panamá',
      role: OrganizerRole.CONTACT,
      countryIso: 'PA',
      email: 'mfvargas@uinl.edu.pa',
      phone: '+50762051779',
      displayOrder: 12,
    },
  ];

  for (const org of organizersData) {
    const exists = await organizerRepo.findOne({
      where: { eventId: event.id, name: org.name },
    });
    if (!exists) {
      const { countryIso, ...rest } = org;
      await organizerRepo.save(
        organizerRepo.create({
          ...rest,
          eventId: event.id,
          countryId: savedCountries[countryIso]?.id,
          isVisible: true,
        }),
      );
    }
  }
  console.log('✅ Organizers seeded');

  // ─── Guidelines ───────────────────────────────────────────────────────────
  const guidelinesData = [
    {
      title: 'Formato del Documento',
      content: `<ul>
        <li>Fuente: Times New Roman 12pt para párrafos</li>
        <li>Interlineado: 1.5 (sin sangría en párrafos)</li>
        <li>Títulos, figuras y tablas: fuente tamaño 10pt</li>
        <li>Máximo 10 páginas incluyendo bibliografía</li>
        <li>Documento en formato Word editable</li>
      </ul>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'FileText',
      displayOrder: 1,
    },
    {
      title: 'Estructura del Artículo',
      content: `<ol>
        <li><strong>Título en español</strong> (tamaño 14pt)</li>
        <li><strong>Título en inglés</strong></li>
        <li><strong>Datos de los autores</strong> (máximo 4): nombres, título, afiliación, email institucional, ORCID, país y ciudad</li>
        <li><strong>Resumen</strong> en español (máximo 250 palabras)</li>
        <li><strong>Palabras clave</strong> (máximo 6, orden alfabético)</li>
        <li><strong>Abstract</strong> en inglés</li>
        <li><strong>Keywords</strong> en inglés</li>
        <li><strong>Introducción</strong> (1 a 1.5 páginas)</li>
        <li><strong>Método de investigación</strong> (máximo 1 página)</li>
        <li><strong>Resultados</strong> (máximo 2 páginas)</li>
        <li><strong>Discusión</strong> (máximo 250 palabras)</li>
        <li><strong>Conclusiones</strong> (máximo 1 página)</li>
        <li><strong>Bibliografía</strong> en formato APA 7ma edición</li>
      </ol>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'AlignLeft',
      displayOrder: 2,
    },
    {
      title: 'Figuras y Tablas',
      content: `<ul>
        <li>Fuente tamaño 10pt para contenido de figuras y tablas</li>
        <li>Formato de imagen: "Imagen 1.- [Nombre de la imagen]"</li>
        <li>Formato de tabla: "Tabla 1 - [Nombre de la tabla]"</li>
        <li>Toda figura o tabla debe incluir su fuente de referencia</li>
      </ul>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'Image',
      displayOrder: 3,
    },
    {
      title: 'Plagio e Integridad Académica',
      content: `<ul>
        <li>El índice de similitud/plagio máximo permitido es del <strong>8%</strong></li>
        <li>Sistema de detección utilizado: <em>Compilatio Magister+</em></li>
        <li>El uso de IA debe citarse correctamente</li>
        <li>El incumplimiento de cualquier pauta implica el rechazo automático del trabajo</li>
      </ul>`,
      category: GuidelineCategory.EVALUATION,
      iconName: 'Shield',
      displayOrder: 4,
    },
    {
      title: 'Proceso de Envío',
      content: `<ul>
        <li>Eje temático: seleccionar uno de los 6 ejes disponibles</li>
        <li>Máximo 4 autores por trabajo</li>
        <li>Se debe incluir ORCID de cada autor</li>
        <li>Envío a través del formulario de postulación en línea</li>
        <li>Fecha límite de envío: <strong>8 de mayo de 2026</strong></li>
        <li>El autor de correspondencia recibirá confirmación por correo electrónico</li>
      </ul>`,
      category: GuidelineCategory.SUBMISSION,
      iconName: 'Upload',
      displayOrder: 5,
    },
    {
      title: 'Proceso de Revisión',
      content: `<ul>
        <li>Revisión por pares del comité científico</li>
        <li>Plazo de revisión hasta el <strong>12 de mayo de 2026</strong></li>
        <li>Posibles estados: Recibida, En Revisión, Revisión Requerida, Aprobada, Rechazada</li>
        <li>Se notificarán los resultados al correo del autor de correspondencia</li>
        <li>En caso de ajustes, se indicarán las observaciones a corregir</li>
      </ul>`,
      category: GuidelineCategory.EVALUATION,
      iconName: 'CheckCircle',
      displayOrder: 6,
    },
    {
      title: 'Publicación',
      content: `<ul>
        <li>Los trabajos aprobados serán publicados en las <strong>Memorias del Simposio con ISBN digital</strong></li>
        <li>Certificado de presentador con publicación: <strong>80 horas académicas</strong></li>
        <li>Certificado de asistencia: <strong>50 horas académicas</strong></li>
        <li>Certificado de miembro del Comité Científico según participación</li>
      </ul>`,
      category: GuidelineCategory.PUBLICATION,
      iconName: 'Award',
      displayOrder: 7,
    },
    {
      title: 'Bibliografía - Normas APA 7ma Edición',
      content: `<p>Toda la bibliografía debe seguir el formato APA 7ma edición:</p>
      <ul>
        <li><strong>Artículo de revista:</strong> Apellido, N. (Año). Título. <em>Revista</em>, Vol(Núm), pp-pp. https://doi.org/xxx</li>
        <li><strong>Libro:</strong> Apellido, N. (Año). <em>Título</em>. Editorial.</li>
        <li><strong>Capítulo:</strong> Apellido, N. (Año). Título capítulo. En E. Editor (Ed.), <em>Título libro</em> (pp. xx-xx). Editorial.</li>
        <li><strong>Sitio web:</strong> Apellido, N. (Año). Título. Recuperado de https://url</li>
      </ul>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'Book',
      displayOrder: 8,
    },
  ];

  for (const g of guidelinesData) {
    const exists = await guidelineRepo.findOne({
      where: { eventId: event.id, title: g.title },
    });
    if (!exists) {
      await guidelineRepo.save(
        guidelineRepo.create({ ...g, eventId: event.id, isVisible: true }),
      );
    }
  }
  console.log('✅ Guidelines seeded');

  // ─── Page Sections ────────────────────────────────────────────────────────
  const sectionsData = [
    {
      sectionKey: 'hero',
      title: 'II Simposio Internacional de Ciencia Abierta 2026',
      content: 'Innovación para Transformar el Conocimiento en Sociedad',
      metadata: {
        subtitle: '18 - 22 de mayo de 2026 | Cartagena de Indias, Colombia',
        format: 'Modalidad Híbrida',
        hours: '80 horas académicas certificadas',
        ctaText: 'Postula tu trabajo',
        bgImage: '',
      },
      displayOrder: 1,
      isVisible: true,
    },
    {
      sectionKey: 'about',
      title: 'Sobre el Simposio',
      content: `El II Simposio Internacional de Ciencia Abierta 2026 es un espacio académico internacional que busca promover la integración académica para fortalecer la ciencia abierta, la innovación digital y la democratización del conocimiento como motor de transformación social.

El evento reúne a investigadores, docentes, estudiantes y profesionales de diversas disciplinas para compartir avances científicos, experiencias de innovación y reflexiones sobre el impacto del conocimiento en la sociedad.`,
      metadata: {
        slogans: [
          'La Ciencia se Comparte, el Conocimiento Transforma.',
          'Abrimos la Ciencia, Conectamos el Mundo.',
        ],
      },
      displayOrder: 2,
      isVisible: true,
    },
    {
      sectionKey: 'objectives',
      title: 'Objetivos',
      content: '',
      metadata: {
        general: 'Promover la integración académica internacional para fortalecer la ciencia abierta, la innovación digital y la democratización del conocimiento como motor de transformación social.',
        specific: [
          'Promover el acceso abierto a publicaciones científicas y datos de investigación.',
          'Fortalecer la comunicación científica digital.',
          'Generar espacios de diálogo entre academia, medios y sociedad.',
          'Presentar experiencias exitosas en innovación y ciencia abierta.',
        ],
      },
      displayOrder: 3,
      isVisible: true,
    },
    {
      sectionKey: 'dates',
      title: 'Fechas Importantes',
      content: '',
      metadata: {
        dates: [
          { label: 'Inicio de recepción de trabajos', date: '20 de marzo de 2026', icon: 'Calendar' },
          { label: 'Cierre de recepción de trabajos', date: '8 de mayo de 2026', icon: 'Clock', highlight: true },
          { label: 'Revisión por pares y ajustes', date: 'Hasta el 12 de mayo de 2026', icon: 'CheckSquare' },
          { label: 'Desarrollo del Simposio', date: '18 - 22 de mayo de 2026', icon: 'Star', highlight: true },
          { label: 'Cierre académico y publicación', date: '23 - 30 de mayo de 2026', icon: 'BookOpen' },
        ],
      },
      displayOrder: 4,
      isVisible: true,
    },
    {
      sectionKey: 'certification',
      title: 'Certificación Académica',
      content: '',
      metadata: {
        totalHours: 80,
        levels: [
          {
            title: 'Asistente',
            hours: 50,
            description: 'Participación directa en las actividades académicas del simposio.',
            icon: 'Award',
          },
          {
            title: 'Presentador con Publicación',
            hours: 80,
            description: 'Presentación de ponencia y publicación en memorias con ISBN.',
            icon: 'Star',
            highlight: true,
          },
          {
            title: 'Comité Científico',
            hours: 'Según participación',
            description: 'Para miembros del comité científico evaluador.',
            icon: 'Users',
          },
        ],
      },
      displayOrder: 5,
      isVisible: true,
    },
    {
      sectionKey: 'beneficiaries',
      title: 'Beneficiarios',
      content: '',
      metadata: {
        direct: [
          'Docentes-investigadores nacionales e internacionales',
          'Investigadores de universidades e instituciones académicas',
          'Estudiantes de posgrado y pregrado',
          'Grupos de investigación',
          'Profesionales de comunicación, educación, salud y tecnología',
          'Periodistas y comunicadores científicos',
        ],
        indirect: [
          'Comunidad académica general',
          'Sector productivo',
          'Instituciones públicas',
          'Sociedad en general',
        ],
      },
      displayOrder: 6,
      isVisible: true,
    },
    {
      sectionKey: 'contact',
      title: 'Contacto',
      content: '',
      metadata: {
        contacts: [
          {
            name: 'David Alexander Morales López',
            role: 'Coordinador Ecuador',
            email: 'david.moralesl@ute.edu.ec',
            phone: '0989221612',
            institution: 'Universidad UTE',
            country: 'Ecuador',
          },
          {
            name: 'María Fernanda Vargas Guerra',
            role: 'Coordinadora Panamá',
            email: 'mfvargas@uinl.edu.pa',
            phone: '+50762051779',
            institution: 'Universidad Internacional Nueva Luz',
            country: 'Panamá',
          },
        ],
      },
      displayOrder: 7,
      isVisible: true,
    },
  ];

  for (const s of sectionsData) {
    const exists = await sectionRepo.findOne({
      where: { eventId: event.id, sectionKey: s.sectionKey },
    });
    if (!exists) {
      await sectionRepo.save(sectionRepo.create({ ...s, eventId: event.id }));
    }
  }
  console.log('✅ Page sections seeded');

  console.log('\n🎉 Seed completed successfully!');
  console.log('──────────────────────────────────');
  console.log('Admin credentials:');
  console.log('  Email:    admin@sems.edu');
  console.log('  Password: Admin2026!');
  console.log('Evaluator credentials:');
  console.log('  Email:    evaluador@sems.edu');
  console.log('  Password: Eval2026!');
  console.log('──────────────────────────────────');
}
