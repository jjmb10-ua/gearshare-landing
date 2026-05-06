# README - Cloudflare Worker para Formulario de Alquiler

## Estructura del Proyecto

```
cloudflare-worker/
├── package.json          # Dependencias y scripts
├── wrangler.toml         # Configuración del Worker (¡RELLENAR CREDENCIALES!)
├── schema.sql            # Esquema de base de datos Turso
├── src/
│   └── index.js          # Código principal del Worker
└── README.md             # Este archivo
```

## Prerrequisitos

1. Cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Cuenta en [Turso](https://turso.tech/signup)
3. Node.js 18+ instalado
4. CLI de Wrangler: `npm install -g wrangler`

## Pasos de Configuración

### 1. Instalar dependencias

```bash
cd cloudflare-worker
npm install
```

### 2. Configurar wrangler.toml

Editar `wrangler.toml` y rellenar:

- `CORS_ORIGIN`: Tu URL de GitHub Pages (ej: `https://tu-usuario.github.io`)
- `TURSO_DATABASE_URL`: URL de tu base de datos Turso (ej: `libsql://tu-db.turso.io`)
- `TURSO_AUTH_TOKEN`: Token de autenticación de Turso
- `JWT_SECRET`: Un secreto seguro para autenticación (opcional)

**Importante:** Las credenciales de Turso deben añadirse como secrets:

```bash
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
```

### 3. Crear base de datos en Turso

1. Ir a [Turso Dashboard](https://dashboard.turso.tech/)
2. Crear nueva base de datos
3. Copiar la URL y el token
4. Ejecutar el esquema SQL:

```bash
# Conectar a la base de datos desde la CLI de Turso
turso db shell tu-base-de-datos < schema.sql
```

O ejecutar el SQL manualmente desde el dashboard de Turso.

### 4. Crear bucket R2 para imágenes

```bash
npx wrangler r2 bucket create alquiler-imagenes
```

### 5. Desarrollo local

```bash
npm run dev
```

El Worker estará disponible en `http://localhost:8787`

**Nota:** Para desarrollo local, necesitas configurar variables de entorno en un archivo `.dev.vars`:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
CORS_ORIGIN=http://localhost:5500
```

### 6. Desplegar a producción

```bash
npm run deploy
```

El Worker se desplegará en una URL tipo: `https://alquiler-worker.tu-usuario.workers.dev`

## API Endpoints

### Ofertas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/ofertas` | Listar todas las ofertas |
| GET | `/api/ofertas/:id` | Obtener oferta por ID |
| POST | `/api/ofertas` | Crear nueva oferta |
| PUT | `/api/ofertas/:id` | Actualizar oferta |
| DELETE | `/api/ofertas/:id` | Eliminar oferta |

### Imágenes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/upload-url` | Obtener URL para subir imagen |
| POST | `/api/upload-image` | Subir imagen directamente |

## Ejemplo de Uso desde Frontend

### Crear oferta con imágenes

```javascript
// 1. Subir imágenes
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const uploadResponse = await fetch('https://alquiler-worker.tu-usuario.workers.dev/api/upload-image', {
  method: 'POST',
  body: formData
});

const { imageUrl } = await uploadResponse.json();

// 2. Crear oferta
const ofertaData = {
  tipo: 'tengo',
  titulo: 'Alquilo habitación',
  descripcion: 'Habitación luminosa en centro',
  precio: 350,
  ubicacion: 'Madrid',
  imagenes: [imageUrl],
  contacto: { email: 'usuario@email.com', telefono: '600123456' }
};

const response = await fetch('https://alquiler-worker.tu-usuario.workers.dev/api/ofertas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ofertaData)
});

const result = await response.json();
console.log('Oferta creada con ID:', result.data.id);
```

## Solución de Problemas

### Error de CORS

Asegúrate de que `CORS_ORIGIN` en `wrangler.toml` coincide exactamente con el dominio desde el que se hace la petición (GitHub Pages).

### Error de conexión a Turso

Verificar que:
- La URL de la base de datos es correcta
- El token de autenticación es válido
- La base de datos existe y está accesible

### Error al subir imágenes

Verificar que el bucket R2 `alquiler-imagenes` está creado y vinculado correctamente en `wrangler.toml`.

## Recursos Adicionales

- [Documentación de Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- [Documentación de Turso](https://docs.turso.tech/)
- [Documentación de R2](https://developers.cloudflare.com/r2/)
