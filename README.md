# SEMS API — Scientific Event Management System

Backend NestJS + TypeORM + PostgreSQL para el **II Simposio Internacional de Ciencia Abierta 2026**.

## Requisitos

- Node.js >= 18
- PostgreSQL >= 14
- npm

## Configuración inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear base de datos

```bash
createdb sems_db
```

O desde psql:

```sql
CREATE DATABASE sems_db;
```

### 3. Configurar variables de entorno

El archivo `.env` ya existe con valores de desarrollo. Ajusta según tu entorno:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=sems_db

JWT_SECRET=sems_jwt_secret_change_in_production_2026
JWT_EXPIRES_IN=7d

PORT=3000
FRONTEND_URL=http://localhost:5173

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM="SEMS Simposio <noreply@sems.edu>"
```

> **Email**: Para Gmail usa una [App Password](https://support.google.com/accounts/answer/185833). Para desarrollo puedes usar [Mailtrap](https://mailtrap.io/).

### 4. Arrancar en modo desarrollo

```bash
npm run start:dev
```

TypeORM creará automáticamente todas las tablas (`synchronize: true`).

### 5. Ejecutar seed de datos iniciales

```bash
npm run seed
```

Carga:
- 22 países de Latinoamérica e Iberia con emojis de bandera
- Usuarios por defecto: `admin@sems.edu / Admin2026!` y `evaluador@sems.edu / Eval2026!`
- 4 tipos de producto científico
- Evento **II Simposio Internacional de Ciencia Abierta 2026**
- 6 ejes temáticos
- 12 organizadores (instituciones y personas)
- 8 pautas de publicación
- 7 secciones de contenido del sitio público

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo watch (desarrollo) |
| `npm run start` | Servidor en modo producción |
| `npm run build` | Compilar a JavaScript |
| `npm run seed` | Cargar datos iniciales |

## Estructura del proyecto

```
src/
├── common/
│   ├── decorators/       # @Public(), @Roles(), @CurrentUser()
│   ├── enums/            # SubmissionStatus, OrganizerRole, etc.
│   ├── filters/          # AllExceptionsFilter
│   └── guards/           # JwtAuthGuard, RolesGuard
├── config/               # configuration.ts (env vars)
├── database/
│   └── seeds/            # initial-data.seed.ts
├── entities/             # Todas las entidades TypeORM
├── modules/
│   ├── auth/             # Login, JWT Strategy
│   ├── users/            # CRUD usuarios
│   ├── countries/        # Países con banderas
│   ├── events/           # Gestión de eventos
│   ├── submissions/      # Postulaciones + flujo de estados
│   ├── agenda/           # Agenda con slots drag-and-drop
│   ├── organizers/       # Organizadores e instituciones
│   ├── guidelines/       # Pautas de publicación
│   ├── thematic-axes/    # Ejes temáticos
│   ├── scientific-product-types/ # Tipos de producto
│   ├── page-sections/    # Contenido dinámico del sitio
│   └── mail/             # Servicio de email (nodemailer)
├── app.module.ts
└── main.ts
```

## Endpoints principales

### Públicos (sin autenticación)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/events/active` | Evento activo |
| GET | `/api/events/:id/page-sections` | Secciones del sitio |
| GET | `/api/events/:id/thematic-axes` | Ejes temáticos |
| GET | `/api/events/:id/organizers` | Organizadores |
| GET | `/api/events/:id/guidelines` | Pautas |
| GET | `/api/events/:id/agenda` | Agenda publicada |
| POST | `/api/submissions` | Enviar postulación (multipart) |
| POST | `/api/submissions/check-by-email` | Verificar estado por email |
| GET | `/api/countries` | Lista de países |
| GET | `/api/scientific-product-types` | Tipos de producto |

### Protegidos (requieren JWT)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/submissions` | Listar postulaciones (admin/evaluador) |
| GET | `/api/submissions/:id` | Detalle de postulación |
| PATCH | `/api/submissions/:id/status` | Cambiar estado |
| POST | `/api/submissions/:id/email` | Enviar email personalizado |
| GET/POST/PATCH/DELETE | `/api/agenda/*` | Gestión de agenda |
| GET/POST/PATCH/DELETE | `/api/organizers/*` | CRUD organizadores |
| GET/POST/PATCH/DELETE | `/api/guidelines/*` | CRUD pautas |
| GET/POST/PATCH/DELETE | `/api/thematic-axes/*` | CRUD ejes temáticos |
| GET/POST/PATCH/DELETE | `/api/page-sections/*` | CMS secciones |
| GET/POST/PATCH/DELETE | `/api/users/*` | CRUD usuarios (admin) |

## Flujo de estados de postulaciones

```
received → under_review → revision_requested → received (ciclo de revisión)
         ↓                                   ↓
       rejected                           approved → scheduled
                                             ↓
                                          withdrawn
```

## Uploads

Los archivos subidos se guardan en `./uploads/` y se sirven estáticamente en `/uploads/filename`.

Formatos aceptados: `.pdf`, `.doc`, `.docx` (máximo 10 MB).
