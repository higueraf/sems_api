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
  // 4 tipos en total. Activos: Ponencia (pptx) + Capítulo de Libro (docx).
  // Inactivos (uso futuro): Artículo Científico, Póster Científico.
  const productTypesData = [
    {
      name: 'Ponencia / Comunicación Oral',
      description: 'Presentación oral de investigación o avance de investigación en formato PowerPoint. Máximo 15 minutos de exposición.',
      maxAuthors: 4,
      minPages: null as any,
      maxPages: null as any,
      maxPresentationMinutes: 15,
      requiresFile: true,
      allowedFileFormats: 'pptx',
      formatGuidelinesHtml: '<p>Presentación en formato PowerPoint (pptx). Máximo 15 minutos. Debe incluir: título, autores, introducción, desarrollo y conclusiones.</p>',
      isActive: true,
    },
    {
      name: 'Capítulo de Libro',
      description: 'Capítulo para libro científico con revisión por pares. Incluye investigaciones completas con metodología, resultados, discusión y conclusiones.',
      maxAuthors: 4,
      minPages: 6,
      maxPages: 20,
      maxPresentationMinutes: 20,
      requiresFile: true,
      allowedFileFormats: 'docx',
      formatGuidelinesHtml: `<p><strong>Formato:</strong> Times New Roman 12pt, interlineado 1.5, márgenes 2.5cm sup/inf – 3cm izq/der.</p>
<p><strong>Extensión:</strong> mínimo 6 páginas, máximo 20 (incluye bibliografía).</p>
<p><strong>Estructura obligatoria:</strong> Título (español e inglés), Autores (máx. 4) con ORCID, Resumen (máx. 250 palabras), Palabras clave (máx. 6), Abstract, Keywords, Introducción, Metodología, Resultados, Discusión, Conclusiones, Bibliografía APA 7ma edición.</p>
<p><strong>Figuras y tablas:</strong> fuente 10pt, con título y fuente de referencia.</p>`,
      isActive: true,
    },
    {
      name: 'Artículo Científico',
      description: 'Artículo de investigación con metodología, resultados y discusión.',
      maxAuthors: 4,
      minPages: 6,
      maxPages: 10,
      maxPresentationMinutes: 15,
      requiresFile: true,
      allowedFileFormats: 'docx',
      formatGuidelinesHtml: '<p>Formato Times New Roman 12pt, interlineado 1.5, máximo 10 páginas incluyendo bibliografía. Citas en formato APA 7ma edición.</p>',
      isActive: false,
    },
    {
      name: 'Póster Científico',
      description: 'Presentación en formato de cartel científico.',
      maxAuthors: 4,
      minPages: 1,
      maxPages: 2,
      maxPresentationMinutes: 5,
      requiresFile: true,
      allowedFileFormats: 'pdf',
      formatGuidelinesHtml: '<p>Formato A0 (841 x 1189 mm). Debe incluir: título, autores, introducción, metodología, resultados y conclusiones.</p>',
      isActive: false,
    },
  ];

  const savedProductTypes: Record<string, ScientificProductType> = {};
  for (const { isActive, ...pt } of productTypesData) {
    let existing = await productTypeRepo.findOne({ where: { name: pt.name } });
    if (!existing) {
      existing = await productTypeRepo.save(
        productTypeRepo.create({ ...pt, isActive }),
      );
    } else {
      // Actualiza los campos clave en registros existentes
      Object.assign(existing, { ...pt, isActive });
      await productTypeRepo.save(existing);
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

  // ─── Guidelines — 1 pauta por tipo de producto ───────────────────────────
  // Estrategia: ocultar TODAS las pautas anteriores del evento,
  // luego crear/actualizar las pautas canónicas vinculadas a su tipo de producto.
  await guidelineRepo.update({ eventId: event.id }, { isVisible: false });

  const guidelinesData = [
    {
      title: 'Capítulo de Libro',
      productTypeName: 'Capítulo de Libro',
      content: `<h3>Formato del documento</h3>
<ul>
  <li>Fuente: <strong>Times New Roman 12pt</strong> para párrafos; 10pt para títulos de figuras y tablas</li>
  <li>Interlineado: <strong>1.5</strong> (sin sangría en párrafos)</li>
  <li>Márgenes: <strong>2.5 cm</strong> superior e inferior — <strong>3 cm</strong> izquierdo y derecho</li>
  <li>Extensión: mínimo <strong>6 páginas</strong>, máximo <strong>20 páginas</strong> (incluye bibliografía)</li>
  <li>Archivo: Word editable (<strong>.docx</strong>)</li>
  <li>Figuras: <em>"Imagen 1.- [Nombre]"</em> — Tablas: <em>"Tabla 1 - [Nombre]"</em>. Toda figura o tabla debe incluir su fuente</li>
</ul>

<h3>Estructura obligatoria</h3>
<ol>
  <li><strong>Título en español</strong> (14pt) y <strong>título en inglés</strong></li>
  <li><strong>Datos de los autores</strong> (máx. 4): nombres completos, título académico, institución/afiliación, email institucional, ORCID, país y ciudad</li>
  <li><strong>Resumen</strong> en español (máx. 250 palabras)</li>
  <li><strong>Palabras clave</strong> (máx. 6, orden alfabético)</li>
  <li><strong>Abstract</strong> en inglés</li>
  <li><strong>Keywords</strong> en inglés</li>
  <li><strong>Introducción</strong> (1 a 1.5 páginas)</li>
  <li><strong>Método de investigación</strong> (máx. 1 página)</li>
  <li><strong>Resultados</strong> (máx. 2 páginas)</li>
  <li><strong>Discusión</strong> (máx. 250 palabras)</li>
  <li><strong>Conclusiones</strong> (máx. 1 página)</li>
  <li><strong>Bibliografía</strong> en formato APA 7ma edición</li>
</ol>

<h3>Bibliografía — APA 7ma edición</h3>
<ul>
  <li><strong>Artículo:</strong> Apellido, N. (Año). Título del artículo. <em>Nombre de la Revista</em>, Vol(N), pp–pp. https://doi.org/xxx</li>
  <li><strong>Libro:</strong> Apellido, N. (Año). <em>Título del libro</em>. Editorial.</li>
  <li><strong>Capítulo:</strong> Apellido, N. (Año). Título del capítulo. En N. Editor (Ed.), <em>Título del libro</em> (pp. xx–xx). Editorial.</li>
  <li><strong>Sitio web:</strong> Apellido, N. (Año). Título. Recuperado de https://url</li>
</ul>

<h3>Integridad académica</h3>
<ul>
  <li>Índice de similitud/plagio máximo permitido: <strong>8%</strong> (sistema <em>Compilatio Magister+</em>)</li>
  <li>El uso de IA generativa debe citarse correctamente</li>
  <li>El incumplimiento implica el <strong>rechazo automático</strong> del trabajo</li>
</ul>

<h3>Proceso de envío, revisión y publicación</h3>
<ul>
  <li><strong>Envío:</strong> formulario en línea — seleccionar eje temático, máx. 4 autores con ORCID. Fecha límite: <strong>8 de mayo de 2026</strong></li>
  <li><strong>Revisión:</strong> por pares del comité científico hasta el <strong>12 de mayo de 2026</strong>. Estados: Recibida › En Revisión › Revisión Requerida › Aprobada / Rechazada</li>
  <li><strong>Publicación:</strong> trabajos aprobados en <em>Memorias del Simposio con ISBN digital</em></li>
  <li>Certificado presentador con publicación: <strong>80 horas académicas</strong> | Certificado asistencia: <strong>50 horas</strong></li>
</ul>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'AlignLeft',
      displayOrder: 1,
    },
    {
      title: 'Ponencia / Comunicación Oral',
      productTypeName: 'Ponencia / Comunicación Oral',
      content: `<h3>Formato del archivo</h3>
<ul>
  <li>Archivo: presentación <strong>PowerPoint (.pptx)</strong></li>
  <li>Tiempo de exposición: máximo <strong>15 minutos</strong></li>
</ul>

<h3>Contenido sugerido de la presentación</h3>
<ol>
  <li><strong>Diapositiva de título:</strong> nombre del trabajo, autores (máx. 4), institución, email de contacto y ORCID</li>
  <li><strong>Introducción / Contexto:</strong> problema de investigación y justificación</li>
  <li><strong>Objetivos</strong></li>
  <li><strong>Metodología</strong></li>
  <li><strong>Resultados y discusión</strong></li>
  <li><strong>Conclusiones</strong></li>
  <li><strong>Referencias principales</strong> (APA 7ma edición)</li>
</ol>

<h3>Integridad académica</h3>
<ul>
  <li>Índice de similitud/plagio máximo permitido: <strong>8%</strong> (sistema <em>Compilatio Magister+</em>)</li>
  <li>El uso de IA generativa debe citarse correctamente</li>
  <li>El incumplimiento implica el <strong>rechazo automático</strong> del trabajo</li>
</ul>

<h3>Proceso de envío, revisión y publicación</h3>
<ul>
  <li><strong>Envío:</strong> formulario en línea — seleccionar eje temático, máx. 4 autores con ORCID. Fecha límite: <strong>8 de mayo de 2026</strong></li>
  <li><strong>Revisión:</strong> por pares del comité científico hasta el <strong>12 de mayo de 2026</strong></li>
  <li><strong>Publicación:</strong> ponencias aprobadas incluidas en <em>Memorias del Simposio con ISBN digital</em></li>
  <li>Certificado presentador con publicación: <strong>80 horas académicas</strong> | Certificado asistencia: <strong>50 horas</strong></li>
</ul>`,
      category: GuidelineCategory.FORMAT,
      iconName: 'Presentation',
      displayOrder: 2,
    },
  ];

  for (const { productTypeName, ...g } of guidelinesData) {
    const productType = savedProductTypes[productTypeName] ?? null;
    const productTypeId = productType?.id ?? null;

    // Buscar por título O por productTypeId (para manejar renombrados)
    let existing = await guidelineRepo.findOne({ where: { eventId: event.id, title: g.title } });
    if (!existing && productTypeId) {
      existing = await guidelineRepo.findOne({ where: { eventId: event.id, productTypeId } });
    }

    if (!existing) {
      await guidelineRepo.save(
        guidelineRepo.create({ ...g, eventId: event.id, isVisible: true, productTypeId }),
      );
    } else {
      Object.assign(existing, { ...g, isVisible: true, productTypeId });
      await guidelineRepo.save(existing);
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
