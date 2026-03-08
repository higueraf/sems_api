# SEMS — Registro de Cambios 2026-03-08

## Resumen de correcciones y nuevas funcionalidades

### 🐛 Bug Fix crítico: Ejes Temáticos no listados en formulario de postulación

**Causa raíz:** Las entidades TypeORM tenían `@JoinColumn({ name: 'event_id' })` (snake_case)
pero las columnas en la BD donde viven los datos son camelCase (`eventId`, `thematicAxisId`, etc.).
TypeORM generaba las relaciones JOIN sobre columnas vacías (`event_id = NULL`), de modo que
`findActive()` devolvía el evento sin sus `thematicAxes`.

**Solución aplicada:**
- Todas las entidades corregidas para usar `@JoinColumn({ name: 'eventId' })` (camelCase).
- Al reiniciar el API con `synchronize: true`, TypeORM alinea el FK al campo correcto.
- El `Submit.tsx` ahora carga los ejes temáticos desde el endpoint dedicado `/thematic-axes?eventId=...`
  en lugar de depender de `event?.thematicAxes`.

**Entidades modificadas:**
- `thematic-axis.entity.ts`
- `guideline.entity.ts`
- `event-page-section.entity.ts`
- `organizer.entity.ts`
- `agenda-slot.entity.ts`
- `submission.entity.ts`
- `submission-author.entity.ts`
- `submission-status-history.entity.ts`

---

### ✨ Nueva funcionalidad: Multi-selección de Tipo de Producto Científico

**Frontend (`Submit.tsx`):**
- El campo "Tipo de Producto Científico" ahora es una lista de **checkboxes** que permite
  seleccionar uno o más tipos.
- El schema Zod valida que se seleccione **al menos uno**.
- Se envía `productTypeIds[]` en el formData y `productTypeId` (primer elemento) para
  compatibilidad con el campo original.
- En el paso "Confirmar" se muestran todos los tipos seleccionados.

**Base de datos:**
- Nueva tabla `submission_product_types` (relación M:N) creada por la migración 003.
- Los datos existentes en `submissions.productTypeId` se migran automáticamente a la tabla pivote.

---

### ✨ Nueva funcionalidad: Descarga de archivos en Pautas (Guidelines)

**Área pública (`Guidelines.tsx`):**
- Cada pauta que tenga un archivo adjunto muestra un botón de descarga con ícono según el tipo
  (PDF → rojo, PPTX → naranja, DOCX → azul).
- El enlace usa `download` attribute para forzar la descarga.

**Panel admin (`GuidelinesAdmin.tsx`):**
- Ya implementado: subida rápida de archivos directamente desde la lista de pautas.
- Formulario de creación/edición incluye zona de arrastre para adjuntar PDF/PPTX/DOCX.
- Al guardar una nueva pauta se puede subir el archivo en el mismo flujo.

**API Backend:**
- `POST /guidelines/:id/upload` — sube el archivo adjunto.
- `DELETE /guidelines/:id/upload` — elimina el archivo adjunto.
- Los archivos se sirven como activos estáticos desde `/uploads/guidelines/`.

---

### ✨ Nueva pauta: Plantilla Oficial de Presentación de Ponencias

- Archivo `PLANTILLA_DIAPOSITIVA_PP_UMAYOR.pptx` copiado a:
  `sems_api/uploads/guidelines/plantilla-presentacion-umayor.pptx`
- Pauta insertada via migración SQL 003 con contenido, categoría `submission` e ícono `Presentation`.
- Visible públicamente con botón de descarga PPTX.

---

## Pasos para aplicar los cambios

### 1. Backend — reiniciar el servidor NestJS

```bash
cd ~/Desktop/sems_api
# Detener proceso actual (Ctrl+C si está en primer plano, o:)
# pkill -f "node dist/main" || true

npm run start:dev
```

TypeORM con `synchronize: true` actualizará automáticamente el esquema FK.

### 2. Base de datos — ejecutar migración 003

```bash
cd ~/Desktop/sems_api
bash migrations/run-migration.sh
```

O ejecutar solo el archivo 003:

```bash
PGPASSWORD=jateP455word psql -h localhost -p 5432 -U jate_user -d sems_db \
  -f migrations/003_guideline_presentacion_y_multi_producto.sql
```

### 3. Frontend — rebuilding

```bash
cd ~/Desktop/sems_ui
npm run dev
```

---

## Verificación

Después de reiniciar:

1. Abrir `http://localhost:5173/postular`
2. El selector "Eje Temático" debe mostrar los 6 ejes del evento activo.
3. "Tipo de Producto Científico" muestra checkboxes multi-selección.
4. Abrir `http://localhost:5173/pautas`
5. La última pauta debe mostrar el botón de descarga PPTX.
