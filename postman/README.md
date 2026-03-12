# SEMS API - Postman Collection

Esta carpeta contiene los archivos necesarios para probar el API SEMS con Postman.

## 📁 Archivos

### 1. `SEMS_API_Collection.postman_collection.json`
Colección completa de requests para el API SEMS que incluye:

#### 🔐 **Autenticación**
- **Login**: Iniciar sesión y obtener token JWT
- **Register User**: Crear nuevo usuario

#### 📅 **Eventos**
- **Get Current Event**: Obtener evento activo
- **Get All Events**: Listar todos los eventos (admin)

#### 📄 **Postulaciones (Submissions)**
- **Create Submission**: Crear nueva postulación con archivo
- **Get My Submissions**: Obtener mis postulaciones (usuario autenticado)
- **Get All Submissions**: Listar todas las postulaciones (admin)
- **Get Submission by ID**: Obtener postulación específica
- **Update Submission Status**: Cambiar estado de postulación
- **Send Custom Email**: Enviar email personalizado
- **Upload File Version**: Subir nueva versión de archivo

#### 👥 **Usuarios (Admin)**
- **Get All Users**: Listar todos los usuarios
- **Create User**: Crear nuevo usuario
- **Update User**: Actualizar usuario existente

#### 🏢 **Organizadores**
- **Get All Organizers**: Listar organizadores
- **Create Organizer**: Crear nuevo organizador

#### 🎯 **Ejes Temáticos**
- **Get All Thematic Axes**: Listar ejes temáticos
- **Create Thematic Axis**: Crear nuevo eje temático

#### 📋 **Pautas (Guidelines)**
- **Get All Guidelines**: Listar pautas
- **Create Guideline**: Crear nueva pauta

#### 🌍 **Países**
- **Get All Countries**: Listar países
- **Create Country**: Crear nuevo país

#### 📁 **Archivos y Storage**
- **Get Public File**: Descargar archivo público
- **Get Private File**: Descargar archivo privado (requiere auth)

#### 💚 **Health Check**
- **API Health**: Verificar salud del API
- **Database Health**: Verificar conexión a BD
- **Storage Health**: Verificar servicios de storage

### 2. `SEMS_API_Environment.postman_environment.json`
Variables de entorno para cambiar fácilmente entre ambientes:

#### 🔧 **Configuración Base**
- `base_url`: URL del API (localhost:3000, staging, producción)
- `admin_email`: Email del administrador
- `admin_password`: Contraseña del administrador

#### 🔐 **Autenticación (Automáticas)**
- `auth_token`: Token JWT (se llena automáticamente después del login)
- `bearer_token`: Token con formato Bearer (se llena automáticamente)
- `user_id`: ID del usuario actual (se llena automáticamente)
- `user_email`: Email del usuario actual (Se llena automáticamente)
- `user_role`: Rol del usuario actual (Se llena automáticamente)

#### 📄 **Postulaciones**
- `submission_id`: ID de postulación para pruebas
- `new_status`: Estado para actualizar (RECEIVED, UNDER_REVIEW, APPROVED, etc.)
- `status_notes`: Notas del cambio de estado
- `thematic_axis_id`: ID del eje temático
- `scientific_product_type_id`: ID del tipo de producto científico

#### 📧 **Email**
- `to_email`: Email destinatario
- `to_name`: Nombre del destinatario
- `email_subject`: Asunto del email
- `email_body`: Cuerpo del email

#### 🏢 **Gestión de Contenido**
- `event_id`: ID del evento actual
- `organizer_name`, `organizer_short_name`, `organizer_role`, etc.
- `axis_name`, `axis_description`, `axis_color`, etc.
- `guideline_title`, `guideline_content`, `guideline_category`, etc.
- `country_name`, `country_iso`, `country_flag`, etc.

#### 👥 **Usuarios**
- `new_user_email`, `new_user_password`, `new_user_first_name`, etc.
- `update_first_name`, `update_last_name`, `update_role`, `is_active`

#### 📁 **Archivos**
- `folder`: Nombre de carpeta (submissions, authors, logos)
- `filename`: Nombre del archivo a descargar

## 🚀 **Cómo Usar**

### 1. Importar en Postman

1. Abrir Postman
2. Click en **Import**
3. Seleccionar los dos archivos:
   - `SEMS_API_Collection.postman_collection.json`
   - `SEMS_API_Environment.postman_environment.json`
4. Click en **Import**

### 2. Configurar Ambiente

1. En Postman, ir a la sección **Environments**
2. Seleccionar **"SEMS API Environment Variables"**
3. Modificar las variables según tu ambiente:

#### **Desarrollo Local**
```json
{
  "base_url": "http://localhost:3000",
  "admin_email": "admin@sems.local",
  "admin_password": "admin123"
}
```

#### **Staging**
```json
{
  "base_url": "https://staging-sems-api.herokuapp.com",
  "admin_email": "admin@staging.com",
  "admin_password": "tu_password_staging"
}
```

#### **Producción**
```json
{
  "base_url": "https://api.sems.com",
  "admin_email": "admin@sems.com",
  "admin_password": "tu_password_produccion"
}
```

### 3. Probar el API

1. **Login primero**:
   - Ejecutar la request **Login**
   - El token se guardará automáticamente en las variables `auth_token` y `bearer_token`

2. **Probar otros endpoints**:
   - Las requests incluirán automáticamente el token de autenticación
   - Las variables de entorno se usarán en las URLs y cuerpos de las requests

## 🔧 **Características Especiales**

### 🔄 **Scripts Automáticos**
- **Login**: Guarda automáticamente el token en las variables de entorno
- **Status Updates**: Muestra logs en consola de Postman
- **File Uploads**: Verifica la respuesta y muestra logs

### 📝 **Variables Secretas**
Las variables marcadas como `type: "secret"` no se exportarán al compartir la colección.

### 🎯 **Scripts de Prueba**
Algunas requests incluyen scripts de prueba que se ejecutan automáticamente:
```javascript
// Ejemplo - Login
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.collectionVariables.set('auth_token', response.access_token);
    pm.globals.set('bearer_token', 'Bearer ' + response.access_token);
    console.log('Login exitoso');
}
```

## 📋 **Flujo de Trabajo Típico**

1. **Login** → Obtener token
2. **Get Current Event** → Obtener evento activo y sus datos
3. **Get Thematic Axes** → Listar ejes temáticos del evento
4. **Create Submission** → Crear postulación con archivo adjunto
5. **Update Submission Status** → Cambiar estado a "UNDER_REVIEW"
6. **Send Custom Email** → Enviar notificación al autor

## 🐛 **Troubleshooting**

### Problemas Comunes

**❌ "401 Unauthorized"**
- Verifica que hayas ejecutado el login primero
- Revisa que la variable `bearer_token` esté llena

**❌ "404 Not Found"**
- Verifica la URL base en `base_url`
- Confirma que el endpoint exista

**❌ "413 Payload Too Large"**
- El archivo excede el tamaño máximo (usualmente 15MB)
- Comprime el archivo o reduce su tamaño

**❌ "422 Unprocessable Entity"**
- Revisa el formato del JSON
- Verifica que todos los campos requeridos estén presentes

### 📞 **Soporte**

Si tienes problemas con la colección:

1. **Verifica la versión del API**: Asegúrate que coincide con la colección
2. **Revisa las variables**: Confirma que las variables de entorno estén configuradas
3. **Consulta la documentación**: Revisa los endpoints en la documentación del API
4. **Contacta al equipo**: Si el problema persiste, contacta al equipo de desarrollo

## 🔄 **Actualizaciones**

Para mantener la colección actualizada:

1. **Exporta cambios**: Si modificas alguna request, exporta la colección
2. **Comparte mejoras**: Envía las mejoras al equipo para incluirlas en la versión oficial
3. **Versiona los cambios**: Mantén un registro de los cambios realizados

---

**Nota**: Esta colección está diseñada para trabajar con la versión actual del API SEMS. Algunos endpoints pueden cambiar en futuras versiones.
