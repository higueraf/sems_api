import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Certificate } from '../../entities/certificate.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { Organizer } from '../../entities/organizer.entity';
import { Event } from '../../entities/event.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionStatus, OrganizerType } from '../../common/enums/submission-status.enum';
import { StorageService } from '../storage/storage.service';
import { MailService } from '../mail/mail.service';
import { User } from '../../entities/user.entity';
import {
  GenerateCertificatesDto, BulkGenerateAndSendDto, CertificateFiltersDto,
} from './dto/certificate.dto';
import { ConfigService } from '@nestjs/config';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
// ─────────────────────────────────────────────────────────────────────────────

interface PdfOpts {
  authorName: string;
  isMainAuthor: boolean;
  titleEs: string;
  productTypeName: string;
  thematicAxisName: string;
  eventName: string;
  eventDates: string;
  eventCity: string;
  certificateNumber: string;
  verificationUrl: string;
  headerLogoBuffer?: Buffer;
  signatories: { name: string; title: string; institution: string }[];
  organizerLogoBuffers: { label: string; buffer: Buffer }[];
  qrBuffer?: Buffer;
  allAuthors?: string;
  createdAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLA 1: DIPLOMA — Landscape A4 con curvas verdes estilo ribbon
// ─────────────────────────────────────────────────────────────────────────────

async function buildDiplomaPdf(opts: PdfOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // Intentar cargar fondo desde assets/certificate-bg.jpg
    const bgPath = path.join(process.cwd(), 'assets', 'certificate-bg.jpg');
    let hasBg = false;
    if (fs.existsSync(bgPath)) {
      try {
        doc.image(bgPath, 0, 0, { width: W, height: H });
        hasBg = true;
      } catch (err) {
        // Falló carga de fondo
      }
    }

    if (!hasBg) {
      // ── Paleta verde y fondo blanco por defecto ──────────────────────────────
      const G1 = '#134e2c';  // oscuro
      const G2 = '#1b5e3b';  // medio oscuro
      const G3 = '#2e8b57';  // medio
      const G4 = '#52b788';  // claro
      const G5 = '#d8f3dc';  // muy claro
      const WHITE = '#ffffff';

      doc.rect(0, 0, W, H).fillColor(WHITE).fill();

      const drawLeftCurve = (color: string, cp1x: number, cp1y: number, cp2x: number, cp2y: number, endX: number) => {
        doc.fillColor(color).moveTo(0, 0).lineTo(0, H).lineTo(endX, H).bezierCurveTo(cp2x, cp2y, cp1x, cp1y, endX + 50, 0).closePath().fill();
      };
      drawLeftCurve(G5, W * 0.1, H * 0.3, W * 0.3, H * 0.8, W * 0.15);
      drawLeftCurve(G4, W * 0.05, H * 0.4, W * 0.25, H * 0.85, W * 0.1);
      drawLeftCurve(G3, W * 0.02, H * 0.5, W * 0.2, H * 0.9, W * 0.05);
      doc.fillColor(G1).moveTo(0, 0).lineTo(0, H).lineTo(W * 0.1, H).bezierCurveTo(W * 0.15, H * 0.7, W * 0.05, H * 0.3, W * 0.15, 0).closePath().fill();

      doc.fillColor(G2).moveTo(W, 0).lineTo(W - 150, 0).bezierCurveTo(W - 80, H * 0.1, W - 20, H * 0.2, W, H * 0.3).closePath().fill();
      doc.fillColor(G5).moveTo(W, 0).lineTo(W - 130, 0).bezierCurveTo(W - 70, H * 0.15, W - 10, H * 0.25, W, H * 0.35).closePath().fill();

      doc.fillColor(WHITE).fillOpacity(0.4);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          doc.circle(20 + c * 15, 20 + r * 15, 1.5).fill();
        }
      }
      doc.fillOpacity(1);

      doc.fillColor('#e0e0e0').fillOpacity(0.6);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          doc.circle(W - 80 + c * 12, H - 180 + r * 12, 1.5).fill();
        }
      }
      doc.fillOpacity(1);
    }

    // ── Área de contenido centrada (desplazada un poco a la derecha por las curvas)
    const CX = 140;
    const CW = W - CX - 60; // 60 de margen derecho
    
    // Constantes de color para textos
    const TXT_L = '#4a6358';
    const TXT_LL = '#7a9e8a';
    const G1 = '#134e2c';
    const G3 = '#007F3A'; // Verde de la imagen para el título

    // Logo principal (umayor) — ~50% más grande
    const LS = 98;
    const LY = 18;
    if (opts.headerLogoBuffer) {
      try { doc.image(opts.headerLogoBuffer, CX + (CW - LS) / 2, LY, { fit: [LS, LS] }); }
      catch { /* omitir */ }
    }

    // Nombre del evento
    const nameY = LY + LS + 10;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(G1)
      .text(opts.eventName.toUpperCase(), CX, nameY, { width: CW, align: 'center', characterSpacing: 0.5 });

    const subY = nameY + 16;
    doc.font('Helvetica').fontSize(9).fillColor(TXT_L)
      .text(`${opts.eventCity}   ·   ${opts.eventDates}`, CX, subY, { width: CW, align: 'center' });

    // “Confiere el presente certificado a:”
    const confY = subY + 28;
    doc.font('Helvetica').fontSize(12).fillColor('#333333')
      .text('Confiere el presente certificado a:', CX, confY, { width: CW, align: 'center' });

    // Nombre del autor — bold grande, centrado
    doc.font('Helvetica-Bold').fontSize(32).fillColor('#000000')
      .text(opts.authorName.toUpperCase(), CX, confY + 22, { width: CW, align: 'center' });

    // Usar doc.y para evitar solapamiento con el texto siguiente
    const afterAuthorY = doc.y + 6;

    // Línea verde separadora pequeña bajo el nombre
    doc.rect(CX + CW / 2 - 40, afterAuthorY, 80, 2).fillColor(G3).fill();
    doc.circle(CX + CW / 2, afterAuthorY + 1, 4.5).fillColor(G3).fill();

    // Rol: “PONENTE” para ponencias/comunicaciones orales; “AUTOR/A PRINCIPAL”/”CO-AUTOR/A” para el resto
    const ptLower = (opts.productTypeName || '').toLowerCase();
    const isPonencia = ptLower.includes('ponencia') || ptLower.includes('comunicaci');
    const rolLabel = isPonencia ? 'PONENTE' : (opts.isMainAuthor ? 'AUTOR/A PRINCIPAL' : 'CO-AUTOR/A');

    const rolY = afterAuthorY + 16;
    doc.font('Helvetica').fontSize(12).fillColor('#555555')
      .text('en calidad de ', CX, rolY, { width: CW, align: 'center', continued: true })
      .font('Helvetica-Bold').fillColor(G3)
      .text(rolLabel);

    // “por su participación con la producción científica titulada:”
    const descY = rolY + 22;
    doc.font('Helvetica').fontSize(12).fillColor('#555555')
      .text('por su participación con la producción científica titulada:', CX, descY, { width: CW, align: 'center' });

    // Título de la ponencia
    const titleY = descY + 25;
    const shortTitle = opts.titleEs.length > 150 ? opts.titleEs.substring(0, 150) + '…' : opts.titleEs;
    doc.font('Helvetica-BoldOblique').fontSize(15).fillColor(G3)
      .text(`”${shortTitle}”`, CX + 20, titleY, { width: CW - 40, align: 'center' });

    // Eje Temático (solo eje, sin tipo de producción)
    if (opts.thematicAxisName) {
      const detY = doc.y + 12;
      doc.font('Helvetica').fontSize(11).fillColor('#777777')
        .text(`Eje Temático: ${opts.thematicAxisName}`, CX, detY, { width: CW, align: 'center' });
    }

    // Logos organizadores en el footer — más grandes y mejor centrados
    const orgLogos = opts.organizerLogoBuffers;
    if (orgLogos.length > 0) {
      const QR_SPACE = 110; // espacio reservado para QR a la derecha
      const footerW = W - CX - QR_SPACE; // ancho disponible para logos
      const MAX = Math.min(orgLogos.length, 6);
      const LS2 = 58;
      const GAP = Math.max(14, Math.min(28, (footerW - MAX * LS2) / Math.max(MAX - 1, 1)));
      const totalLW = MAX * LS2 + (MAX - 1) * GAP;
      const startX = CX + (footerW - totalLW) / 2;
      const logoY = H - 85;

      for (let i = 0; i < MAX; i++) {
        try {
          doc.image(orgLogos[i].buffer, startX + i * (LS2 + GAP), logoY, { fit: [LS2, LS2] });
        } catch { /* omitir */ }
      }
    }

    // QR — esquina inferior derecha en un recuadro redondeado suave
    const QS = 55;
    const QX = W - 90;
    const QY = H - 100;
    
    doc.roundedRect(QX - 8, QY - 8, QS + 16, QS + 16 + 15, 8).fillColor('#f8f9fa').fill();
    
    if (opts.qrBuffer) {
      try { doc.image(opts.qrBuffer, QX, QY, { width: QS, height: QS }); }
      catch { /* omitir */ }
    }
    doc.font('Helvetica').fontSize(6).fillColor(TXT_LL)
      .text(`CERT-${opts.certificateNumber}`, QX - 8, QY + QS + 6, { width: QS + 16, align: 'center' });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLA 2: CARTA — Portrait A4 estilo carta institucional UMAYOR
// ─────────────────────────────────────────────────────────────────────────────

async function buildCartaPdf(opts: PdfOpts): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    // ── Paleta y Estilos ────────────────────────────────────────────────────
    const BLACK = '#000000';
    const TXT   = '#2b2b2b';
    const WHITE = '#ffffff';

    // Fondo blanco
    doc.rect(0, 0, W, H).fillColor(WHITE).fill();

    // ── Círculos y Triángulos decorativos tenues (fondo) ────────────────────
    const drawFaintShapes = () => {
      doc.lineWidth(4).strokeColor('#f4f4f4');
      // Arriba izquierda
      doc.circle(60, 180, 25).stroke();
      doc.polygon([40, 260], [20, 300], [60, 300]).stroke();
      // Abajo derecha
      doc.circle(W - 60, H - 200, 30).stroke();
      doc.circle(W - 80, H - 280, 20).stroke();
      doc.polygon([W - 50, 400], [W - 20, 460], [W - 80, 460]).stroke();
      // Centro tenue
      doc.circle(W / 2 + 100, H / 2 + 150, 45).stroke();
    };
    drawFaintShapes();

    // ── Logo Superior (umayor) ──────────────────────────────────────────────
    if (opts.headerLogoBuffer) {
      try { doc.image(opts.headerLogoBuffer, 45, 30, { fit: [90, 90] }); }
      catch { /* omitir */ }
    }

    // ── Título Principal ────────────────────────────────────────────────────
    const titleTopY = 160;
    doc.font('Helvetica-Bold').fontSize(26).fillColor(BLACK)
      .text('CERTIFICADO DE', 60, titleTopY)
      .text('PUBLICACIÓN ', 60, titleTopY + 32, { continued: true })
      .text('CAPÍTULO DE', { continued: false })
      .text('LIBRO', 60, titleTopY + 64);

    // Línea negra bajo el título
    const sepY = titleTopY + 105;
    doc.rect(60, sepY, W - 120, 2).fillColor(BLACK).fill();

    // ── Contenido de la carta ───────────────────────────────────────────────
    const contentY = sepY + 30;
    
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK)
      .text('SE CERTIFICA QUE:', 60, contentY);

    const textY = contentY + 20;
    const authorsStr = opts.allAuthors || opts.authorName;
    const titleUpper = opts.titleEs.toUpperCase();

    // Párrafo 1
    doc.font('Helvetica').fontSize(10).fillColor(TXT)
      .text('El capítulo titulado ', 60, textY, { continued: true, width: W - 120, align: 'justify', lineGap: 3 })
      .font('Helvetica-Bold')
      .text(`“${titleUpper}”`, { continued: true })
      .font('Helvetica')
      .text(', elaborado por ', { continued: true })
      .font('Helvetica-Bold')
      .text(authorsStr.toUpperCase(), { continued: true })
      .font('Helvetica')
      .text(', es un resultado de investigación original, el cual ha sido ', { continued: true })
      .font('Helvetica-Bold')
      .text('APROBADO PARA PUBLICACIÓN ', { continued: true })
      .font('Helvetica')
      .text('tras haber superado un proceso de evaluación académica por pares bajo la modalidad de doble ciego.');

    doc.moveDown(1.5);

    // Párrafo 2
    doc.font('Helvetica')
      .text('Este capítulo forma parte del libro de investigación ', { continued: true, width: W - 120, align: 'justify', lineGap: 3 })
      .font('Helvetica-Bold')
      .text('“INNOVACIÓN EN ACCIÓN: SOLUCIONES TECNOLÓGICAS QUE TRANSFORMAN SALUD, INDUSTRIA Y SOCIEDAD”', { continued: true })
      .font('Helvetica')
      .text(', con ISBN físico 978-628-97432-7-2 y electrónico 978-628-97432-9-6, el cual será publicado por el Sello Editorial de la Institución Universitaria Mayor de Cartagena (UMAYOR), conforme a sus políticas de calidad editorial, procesos de gestión científica y lineamientos para la producción de nuevo conocimiento.');

    doc.moveDown(1.5);

    // Párrafo 3
    doc.font('Helvetica')
      .text('El manuscrito fue evaluado bajo criterios de rigurosidad científica y solidez metodológica, cumpliendo con los estándares para publicaciones de nuevo conocimiento. Este capítulo se integra a la obra bajo el ISBN impreso 978-628-97432-7-2 y ISBN digital 978-628-97432-9-6.', { width: W - 120, align: 'justify', lineGap: 3 });

    doc.moveDown(1.5);

    // Párrafo 4 (Fecha expedición)
    const d = opts.createdAt || new Date();
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dateStr = `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    
    doc.font('Helvetica')
      .text(`Expedido en Colombia, Cartagena de Indias, el ${dateStr}.`, { width: W - 120, align: 'left' });

    // ── Firma ───────────────────────────────────────────────────────────────
    const sigY = doc.y + 40;
    
    // Dibujar trazo de firma simbólico (estilo genérico como en la imagen)
    doc.lineWidth(1.5).strokeColor(BLACK);
    doc.moveTo(60, sigY + 25).bezierCurveTo(90, sigY - 10, 110, sigY + 40, 150, sigY + 10).stroke();
    doc.moveTo(150, sigY + 10).bezierCurveTo(170, sigY - 5, 180, sigY + 20, 200, sigY + 5).stroke();
    
    // Línea para la firma
    doc.lineWidth(1).strokeColor(BLACK);
    doc.moveTo(60, sigY + 30).lineTo(220, sigY + 30).stroke();

    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK)
      .text('FERNANDO PARRA LÓPEZ', 60, sigY + 35);
    doc.font('Helvetica').fontSize(10).fillColor(TXT)
      .text('Líder del Sello Editorial / Editor Académico\nSello Editorial UMAYOR\nInstitución Universitaria Mayor de Cartagena – UMAYOR', 60, sigY + 48, { lineGap: 2 });

    // ── Footer ──────────────────────────────────────────────────────────────
    const footerY = H - 85;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1b5e3b')
      .text('www.umayor.edu.co', 0, footerY, { align: 'center', width: W });
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
      .text('Cartagena de Indias - Centro Histórico - K3 # 36-95 Calle de la Factoría', 0, footerY + 15, { align: 'center', width: W });

    // ── Patrón Geométrico Inferior ──────────────────────────────────────────
    const patternY = H - 35;
    const colors = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'];
    const sW = W / 10;
    
    for (let i = 0; i < 10; i++) {
      const cx = i * sW + sW / 2;
      const cy = patternY + 15;
      doc.lineWidth(4).strokeColor(colors[i]);
      
      if (i % 3 === 0) {
        // Cuadrado hueco
        doc.rect(cx - 8, cy - 8, 16, 16).stroke();
      } else if (i % 3 === 1) {
        // Círculo hueco
        doc.circle(cx, cy, 9).stroke();
      } else {
        // Triángulo hueco
        doc.polygon([cx, cy - 9], [cx - 10, cy + 8], [cx + 10, cy + 8]).stroke();
      }
    }
    
    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Router: elige la plantilla según el estilo solicitado
// ─────────────────────────────────────────────────────────────────────────────

async function buildCertificatePdf(opts: PdfOpts, style: 'diploma' | 'carta' = 'diploma'): Promise<Buffer> {
  return style === 'carta' ? buildCartaPdf(opts) : buildDiplomaPdf(opts);
}

// ─────────────────────────────────────────────────────────────────────────────

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    @InjectRepository(Certificate)         private certRepo: Repository<Certificate>,
    @InjectRepository(Submission)          private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionAuthor)    private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(ScientificProductType) private productTypeRepo: Repository<ScientificProductType>,
    @InjectRepository(Organizer)           private organizerRepo: Repository<Organizer>,
    @InjectRepository(Event)               private eventRepo: Repository<Event>,
    @InjectRepository(SubmissionStatusHistory) private historyRepo: Repository<SubmissionStatusHistory>,
    private readonly storage: StorageService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ── Generar número correlativo ───────────────────────────────────────────────

  private async generateCertificateNumber(eventId: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const year = new Date().getFullYear();
      const last = await manager
        .createQueryBuilder(Certificate, 'c')
        .where('c.eventId = :eventId', { eventId })
        .andWhere("c.certificateNumber LIKE :prefix", { prefix: `CERT-${year}-%` })
        .orderBy('c.certificateNumber', 'DESC')
        .getOne();

      let seq = 1;
      if (last?.certificateNumber) {
        const parts = last.certificateNumber.split('-');
        seq = parseInt(parts[parts.length - 1], 10) + 1;
      }
      return `CERT-${year}-${String(seq).padStart(4, '0')}`;
    });
  }

  // ── Obtener logos de organizadores para el PDF ───────────────────────────────

  /** Resuelve cualquier formato de URL (b2://, local://, http://) y retorna el Buffer */
  private async resolveLogoBuffer(logoUrl: string): Promise<Buffer | null> {
    if (!logoUrl) return null;
    try {
      const resolvedUrl = await this.storage.getSignedUrl(logoUrl, 300);
      if (!resolvedUrl) return null;
      return await fetchImageBuffer(resolvedUrl);
    } catch {
      return null;
    }
  }

  /**
   * Logos para el FOOTER del certificado.
   * Excluye el primer organizador (menor displayOrder = umayor) que va en el encabezado.
   */
  private async getOrganizerLogos(eventId: string): Promise<{ label: string; buffer: Buffer }[]> {
    const organizers = await this.organizerRepo.find({
      where: { eventId, isVisible: true, type: OrganizerType.INSTITUTION },
      order: { displayOrder: 'ASC' },
    });

    // El primero (umayor) ya va en el encabezado → lo omitimos del footer
    const footerOrgs = organizers.slice(1);

    const results: { label: string; buffer: Buffer }[] = [];
    for (const org of footerOrgs) {
      if (!org.logoUrl) continue;
      const buffer = await this.resolveLogoBuffer(org.logoUrl);
      if (buffer) results.push({ label: org.shortName || org.name, buffer });
    }
    return results;
  }

  /**
   * Logo del encabezado: primera institución organizadora (menor displayOrder).
   * Se asume que es la institución anfitriona principal (umayor).
   */
  private async getHeaderLogo(eventId: string): Promise<Buffer | undefined> {
    const org = await this.organizerRepo.findOne({
      where: { eventId, isVisible: true, type: OrganizerType.INSTITUTION },
      order: { displayOrder: 'ASC' },
    });
    if (!org?.logoUrl) return undefined;
    return (await this.resolveLogoBuffer(org.logoUrl)) ?? undefined;
  }

  /** Retorna hasta 3 firmantes (organizadores tipo persona) */
  private async getSignatories(eventId: string): Promise<{ name: string; title: string; institution: string }[]> {
    const persons = await this.organizerRepo.find({
      where: { eventId, isVisible: true, type: OrganizerType.PERSON },
      order: { displayOrder: 'ASC' },
      take: 3,
    });
    return persons.map(p => ({
      name: [p.title, p.name].filter(Boolean).join(' '),
      title: p.institutionalPosition ?? '',
      institution: p.description ?? '',
    }));
  }

  // ── Generar certificados para una postulación + tipo de producto ─────────────

  async generateForSubmissionProductType(
    dto: GenerateCertificatesDto,
    user: User,
  ): Promise<Certificate[]> {
    const { submissionId, productTypeId } = dto;

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: ['authors', 'thematicAxis', 'productType', 'event'],
    });
    if (!submission) throw new NotFoundException('Postulación no encontrada');

    const allIds = submission.productTypeIds ?? [submission.productTypeId];
    if (!allIds.includes(productTypeId)) {
      throw new BadRequestException('El tipo de producto no pertenece a esta postulación');
    }

    const productType = await this.productTypeRepo.findOne({ where: { id: productTypeId } });
    const event = submission.event ?? await this.eventRepo.findOne({ where: { id: submission.eventId } });
    const [organizerLogos, headerLogoBuffer, signatories] = await Promise.all([
      this.getOrganizerLogos(submission.eventId),
      this.getHeaderLogo(submission.eventId),
      this.getSignatories(submission.eventId),
    ]);

    const appUrl = this.config.get<string>('app.url') || 'http://localhost:5173';
    const created: Certificate[] = [];

    for (const author of submission.authors) {
      let existing = await this.certRepo.findOne({
        where: { submissionId, authorId: author.id, productTypeId },
      });

      const certNumber       = existing?.certificateNumber ?? await this.generateCertificateNumber(submission.eventId);
      const verificationCode = existing?.verificationCode ?? uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
      const isMainAuthor     = author.isCorresponding || author.authorOrder === 0;
      const verificationUrl  = `${appUrl}/certificado/${verificationCode}`;

      const eventDates = this.formatEventDates(event);

      // Generar QR code
      let qrBuffer: Buffer | undefined;
      try {
        qrBuffer = await QRCode.toBuffer(verificationUrl, {
          type: 'png',
          width: 200,
          margin: 1,
          color: { dark: '#003918', light: '#ffffff' },
        });
      } catch (err) {
        this.logger.warn(`No se pudo generar QR para ${verificationCode}: ${err.message}`);
      }

      let pdfBufferDiploma: Buffer;
      try {
        const pdfOpts = {
          authorName:       author.fullName,
          isMainAuthor,
          titleEs:          submission.titleEs,
          productTypeName:  productType?.name ?? 'Producción Científica',
          thematicAxisName: submission.thematicAxis?.name ?? '',
          eventName:        event?.name ?? 'II Simposio Internacional de Ciencia Abierta',
          eventDates,
          eventCity:        event?.city ?? event?.location ?? 'Cartagena de Indias, Colombia',
          certificateNumber: certNumber,
          verificationUrl,
          headerLogoBuffer,
          signatories,
          organizerLogoBuffers: organizerLogos,
          qrBuffer,
        };
        pdfBufferDiploma = await buildCertificatePdf(pdfOpts, 'diploma');
      } catch (err) {
        this.logger.error(`Error generando PDFs certificado para ${author.fullName}: ${err.message}`);
        throw new BadRequestException('Error al generar los PDFs del certificado');
      }

      // Subir el PDF al storage
      const sanitizedName = author.fullName.replace(/\s+/g, '-');
      const fileNameDiploma = `${certNumber}-${sanitizedName}-diploma.pdf`;
      let fileUrlDiploma = '';

      try {
        fileUrlDiploma = await this.storage.upload(
          { buffer: pdfBufferDiploma, originalname: fileNameDiploma, mimetype: 'application/pdf', size: pdfBufferDiploma.length } as any,
          'guidelines', // carpeta pública
          `cert-${verificationCode}-diploma`,
        );
      } catch (err) {
        this.logger.error(`Error subiendo PDF certificado: ${err.message}`);
      }

      if (existing) {
        existing.fileUrl       = fileUrlDiploma;
        existing.fileName      = fileNameDiploma;
        existing.emailSentAt   = null as any; // reset status
        created.push(await this.certRepo.save(existing));
        this.logger.log(`📜 Certificado ${certNumber} REGENERADO para ${author.fullName}`);
      } else {
        const cert = this.certRepo.create({
          certificateNumber: certNumber,
          submissionId,
          authorId:          author.id,
          productTypeId,
          productTypeName:   productType?.name ?? '',
          verificationCode,
          fileUrl:           fileUrlDiploma,
          fileName:          fileNameDiploma,
          issuedAt:          new Date(),
          eventId:           submission.eventId,
        });
        created.push(await this.certRepo.save(cert));
        this.logger.log(`📜 Certificado ${certNumber} generado para ${author.fullName}`);
      }
    }

    return created;
  }

  // ── Enviar certificados por correo ───────────────────────────────────────────

  async sendCertificates(certificateIds: string[], user: User): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const certId of certificateIds) {
      const cert = await this.certRepo.findOne({
        where: { id: certId },
        relations: ['author', 'submission', 'submission.event'],
      });
      if (!cert) continue;

      // Descargar PDFs para adjuntar
      const pdfAttachments: { buffer: Buffer; fileName: string }[] = [];

      // Función auxiliar para obtener el buffer (por HTTP o Disco)
      const getBufferForUrl = async (url: string | null): Promise<Buffer | null> => {
        if (!url) return null;
        if (url.startsWith('/uploads/')) {
          const filePath = path.join(process.cwd(), url);
          if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
          return null;
        }
        if (url.startsWith('http')) {
          return await fetchImageBuffer(url);
        }
        const signedUrl = await this.storage.getSignedUrl(url, 300);
        if (signedUrl) return await fetchImageBuffer(signedUrl);
        return null;
      };

      // Descargar PDF Diploma
      try {
        const buffer = await getBufferForUrl(cert.fileUrl);
        if (buffer) {
          pdfAttachments.push({ buffer, fileName: cert.fileName || 'diploma.pdf' });
        }
      } catch (err) {
        this.logger.warn(`No se pudo obtener PDF Diploma del storage para ${certId}: ${err.message}`);
      }

      const author      = cert.author;
      const appUrl      = this.config.get<string>('app.url') || 'http://localhost:5173';
      const verifyUrl   = `${appUrl}/certificado/${cert.verificationCode}`;

      const html = this.buildCertificateEmailHtml(
        author.fullName,
        cert.submission?.titleEs ?? '',
        cert.productTypeName ?? '',
        cert.certificateNumber,
        verifyUrl,
      );

      const ok = await this.mailService.sendCertificateEmail(
        author.email,
        author.fullName,
        `Certificado de Participación — ${cert.certificateNumber}`,
        html,
        cert.submissionId,
        user.id,
        pdfAttachments,
      ).catch(() => false);

      if (ok) {
        cert.emailSentAt = new Date();
        await this.certRepo.save(cert);
        sent++;
      } else {
        failed++;
      }
    }

    // Si todos los certificados de la postulación+productType han sido enviados, actualizar productStatuses
    if (sent > 0) {
      await this.markProductTypeAsCertificateSent(certificateIds);
    }

    return { sent, failed };
  }

  private async markProductTypeAsCertificateSent(certificateIds: string[]) {
    // Obtener combinaciones únicas submissionId+productTypeId que ya tienen todos enviados
    const certs = await this.certRepo.findByIds(certificateIds);
    const groups = new Map<string, string>(); // `${submissionId}:${productTypeId}` → submissionId
    for (const c of certs) {
      if (c.emailSentAt) groups.set(`${c.submissionId}:${c.productTypeId}`, c.submissionId);
    }

    for (const [key] of groups) {
      const [submissionId, productTypeId] = key.split(':');
      const total   = await this.certRepo.count({ where: { submissionId, productTypeId } });
      const sent    = await this.certRepo.count({ where: { submissionId, productTypeId, emailSentAt: Not(IsNull()) } });
      if (total > 0 && sent === total) {
        const sub = await this.submissionRepo.findOne({ where: { id: submissionId } });
        if (sub) {
          const updated = { ...(sub.productStatuses ?? {}), [productTypeId]: SubmissionStatus.CERTIFICATE_SENT };
          await this.submissionRepo.update(submissionId, { productStatuses: updated });
          await this.historyRepo.save(this.historyRepo.create({
            submissionId,
            previousStatus: SubmissionStatus.EXECUTED,
            newStatus:      SubmissionStatus.CERTIFICATE_SENT,
            notes:          'Certificados enviados a todos los autores',
            changedById:    null,
            productTypeId,
          }));
        }
      }
    }
  }

  // ── Generar + enviar en un solo paso ─────────────────────────────────────────

  async generateAndSend(dto: GenerateCertificatesDto, user: User) {
    const certs = await this.generateForSubmissionProductType(dto, user);
    const result = await this.sendCertificates(certs.map(c => c.id), user);
    return { generated: certs.length, ...result };
  }

  // ── Envío masivo ─────────────────────────────────────────────────────────────

  async bulkGenerateAndSend(dto: BulkGenerateAndSendDto, user: User) {
    const { eventId, productTypeId } = dto;

    // Buscar todas las postulaciones del evento con productStatus = executed para el tipo indicado
    const allSubmissions = await this.submissionRepo.find({ where: { eventId } });

    const targets = allSubmissions.filter(s => {
      const statuses = s.productStatuses ?? {};
      const ids      = s.productTypeIds ?? [s.productTypeId];
      if (productTypeId) {
        return ids.includes(productTypeId) && statuses[productTypeId] === SubmissionStatus.EXECUTED;
      }
      // Si no se especifica tipo, buscar cualquier tipo en executed
      return ids.some(id => statuses[id] === SubmissionStatus.EXECUTED);
    });

    let totalGenerated = 0;
    let totalSent      = 0;
    let totalFailed    = 0;

    for (const sub of targets) {
      const ids = productTypeId
        ? [productTypeId]
        : (sub.productTypeIds ?? [sub.productTypeId]).filter(id => (sub.productStatuses ?? {})[id] === SubmissionStatus.EXECUTED);

      for (const ptId of ids) {
        try {
          const result = await this.generateAndSend({ submissionId: sub.id, productTypeId: ptId }, user);
          totalGenerated += result.generated;
          totalSent      += result.sent;
          totalFailed    += result.failed;
        } catch (err) {
          this.logger.error(`Error en envío masivo para ${sub.referenceCode}: ${err.message}`);
          totalFailed++;
        }
      }
    }

    return { processed: targets.length, generated: totalGenerated, sent: totalSent, failed: totalFailed };
  }

  // ── Listar certificados ───────────────────────────────────────────────────────

  async findAll(filters: CertificateFiltersDto) {
    const qb = this.certRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.author', 'author')
      .leftJoinAndSelect('c.submission', 'sub')
      .leftJoinAndSelect('c.productType', 'pt')
      .orderBy('c.issuedAt', 'DESC');

    if (filters.eventId)       qb.andWhere('c.eventId = :eid',           { eid: filters.eventId });
    if (filters.productTypeId) qb.andWhere('c.productTypeId = :ptId',    { ptId: filters.productTypeId });
    if (filters.submissionId)  qb.andWhere('c.submissionId = :sid',      { sid: filters.submissionId });
    if (filters.sent === 'true')  qb.andWhere('c.emailSentAt IS NOT NULL');
    if (filters.sent === 'false') qb.andWhere('c.emailSentAt IS NULL');

    return qb.getMany();
  }

  // ── Verificación pública ─────────────────────────────────────────────────────

  async verify(verificationCode: string) {
    const cert = await this.certRepo.findOne({
      where: { verificationCode },
      relations: ['author', 'submission', 'submission.event', 'productType'],
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado');
    return {
      valid:             true,
      certificateNumber: cert.certificateNumber,
      authorName:        cert.author.fullName,
      titleEs:           cert.submission.titleEs,
      productTypeName:   cert.productTypeName,
      eventName:         cert.submission.event?.name ?? '',
      issuedAt:          cert.issuedAt,
      emailSentAt:       cert.emailSentAt,
    };
  }

  // ── Descarga ────────────────────────────────────────────────────────────────

  async getDownloadUrl(id: string): Promise<{ url: string; fileName: string }> {
    const cert = await this.certRepo.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certificado no encontrado');
    if (!cert.fileUrl) throw new BadRequestException('El certificado no tiene archivo generado');
    const url = await this.storage.getSignedUrl(cert.fileUrl, 3600);
    return { url, fileName: cert.fileName };
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const cert = await this.certRepo.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certificado no encontrado');
    if (cert.fileUrl) await this.storage.delete(cert.fileUrl).catch(() => null);
    await this.certRepo.remove(cert);
    return { deleted: true };
  }

  // ── Template email certificado ───────────────────────────────────────────────

  private buildCertificateEmailHtml(
    authorName: string,
    titleEs: string,
    productTypeName: string,
    certificateNumber: string,
    verificationUrl: string,
  ): string {
    const year = new Date().getFullYear();
    const shortTitle = titleEs.length > 80 ? titleEs.substring(0, 80) + '...' : titleEs;
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Certificado de Participación</title></head>
<body style="margin:0;padding:0;background-color:#f0f4f1;font-family:Arial,Helvetica,sans-serif;">
  <div style="background-color:#f0f4f1;padding:20px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
      <div style="background-color:#003918;padding:20px 30px;color:white;">
        <div style="font-size:11px;color:#7ee8a2;text-transform:uppercase;margin-bottom:5px;">II Simposio Internacional de Ciencia Abierta</div>
        <h1 style="margin:0;font-size:22px;font-weight:bold;">Certificado de Participación</h1>
        <p style="margin:5px 0 0;font-size:13px;color:#a7f3d0;">Documento oficial del evento</p>
      </div>
      <div style="padding:30px;">
        <p style="color:#374840;font-size:15px;">Estimado/a <strong>${authorName}</strong>,</p>
        <p style="color:#374840;font-size:14px;line-height:1.6;">
          Es un placer hacerle entrega de su <strong>Certificado de Participación</strong> en el
          <strong>II Simposio Internacional de Ciencia Abierta 2026</strong>.
        </p>
        <div style="background:#f0f9f4;border-left:4px solid #003918;padding:16px;margin:20px 0;border-radius:4px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Tipo de producción</p>
          <p style="margin:0;font-size:14px;color:#003918;font-weight:bold;">${productTypeName}</p>
          <p style="margin:8px 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Trabajo presentado</p>
          <p style="margin:0;font-size:14px;color:#374840;">"${shortTitle}"</p>
          <p style="margin:8px 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:bold;">N° de Certificado</p>
          <p style="margin:0;font-size:16px;color:#003918;font-weight:bold;font-family:monospace;">${certificateNumber}</p>
        </div>
        <p style="color:#374840;font-size:14px;">El certificado en formato PDF se adjunta a este correo. También puede verificar su autenticidad en línea:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${verificationUrl}" style="background-color:#003918;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">
            Verificar Certificado
          </a>
        </div>
        <p style="color:#374840;font-size:13px;">URL de verificación: <a href="${verificationUrl}" style="color:#007F3A;">${verificationUrl}</a></p>
      </div>
      <div style="background:#f0f4f1;padding:16px 30px;text-align:center;font-size:11px;color:#6b7280;">
        © ${year} II Simposio Internacional de Ciencia Abierta. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private formatEventDates(event: Event | null): string {
    if (!event?.startDate) return '2026';
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!event.endDate || event.startDate === event.endDate) return fmt(new Date(event.startDate));
    const s = new Date(event.startDate);
    const e = new Date(event.endDate);
    return `${s.getDate()}–${e.getDate()} de ${e.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  }
}
