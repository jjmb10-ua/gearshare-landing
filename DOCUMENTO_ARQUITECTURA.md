# Arquitectura y Plan de Implementación: Formulario Serverless

## 1. Resumen Ejecutivo
Implementación de un prototipo funcional para un formulario de creación de ofertas de alquiler. La solución utiliza **JavaScript Vanilla** en el frontend, alojado en **GitHub Pages**, comunicándose con un backend serverless en **Cloudflare Workers** que gestiona la lógica de negocio, almacenamiento de imágenes en **Cloudflare R2** y persistencia de datos en **Turso (libSQL)**.

### Objetivos Clave
- **Cero Coste Inicial:** Uso exclusivo de planes gratuitos (GitHub, Cloudflare, Turso).
- **Tecnología Ligera:** JavaScript Vanilla sin frameworks pesados.
- **Funcionalidad Móvil:** Acceso nativo a cámara y galería de imágenes.
- **Arquitectura Desacoplada:** Frontend estático independiente del backend serverless.

---

## 2. Diagrama de Arquitectura

```mermaid
graph TD
    User[Usuario Móvil/Desktop] -->|HTTPS | GP[GitHub Pages (Frontend Estático)]
    
    subgraph "Frontend (GitHub Pages)"
        GP -->|HTML/CSS/JS Vanilla| Form[Formulario Interactivo]
        Form -->|Captura/Subida| ImgProc[Procesamiento Imagen JS]
    end

    subgraph "Backend Serverless (Cloudflare)"
        ImgProc -->|API POST (JSON + Blob)| CW[Cloudflare Worker]
        CW -->|Validación & CORS| Logic[Lógica de Negocio]
        Logic -->|Write/Read| Turso[(Base de Datos Turso)]
        Logic -->|Upload/Get| R2[(Cloudflare R2 Storage)]
    end

    style GP fill:#f9f,stroke:#333,stroke-width:2px
    style CW fill:#ff9,stroke:#333,stroke-width:2px
    style Turso fill:#9cf,stroke:#333,stroke-width:2px
    style R2 fill:#9cf,stroke:#333,stroke-width:2px
```

### Flujo de Datos
1.  **Interacción:** El usuario rellena el formulario y selecciona una foto (cámara o archivo).
2.  **Procesamiento Cliente:** JS comprime/redimensiona la imagen (opcional) y prepara el payload.
3.  **Envío:** `fetch()` envía los datos al endpoint del Cloudflare Worker.
4.  **Procesamiento Servidor:**
    -   El Worker valida los datos.
    -   Sube la imagen a un Bucket R2 y obtiene la URL pública.
    -   Guarda los metadatos (texto + URL imagen) en Turso.
5.  **Respuesta:** El Worker confirma el éxito y el frontend muestra el mensaje al usuario.

---

## 3. Stack Tecnológico y Costes Estimados

| Componente | Tecnología | Función | Coste Mensual (Estimado Prototipo) | Límites Gratis |
| :--- | :--- | :--- | :--- | :--- |
| **Hosting Frontend** | GitHub Pages | Servir HTML/JS/CSS | **€0** | Ilimitado (páginas públicas) |
| **Backend API** | Cloudflare Workers | Lógica serverless, CORS, Auth | **€0** | 100,000 requests/día |
| **Base de Datos** | Turso (libSQL) | Persistencia de ofertas | **€0** | 9 GB storage, 500 MB escritura/mes |
| **Imágenes** | Cloudflare R2 | Almacenamiento objetos (fotos) | **€0** | 10 GB storage, 10M operaciones/mes |
| **Dominio** | github.io / workers.dev | URLs por defecto | **€0** | Incluido |
| **Desarrollo** | Wrangler CLI, Git | Deploy y gestión local | **€0** | Open Source |

**Total Estimado:** **€0 / mes** (mientras se mantenga dentro de los límites de uso gratuito).

---

## 4. Funciones del Cloudflare Worker (Backend API)

El Worker actuará como una API RESTful segura. Se implementarán las siguientes rutas y funciones:

### 4.1. Estructura de Rutas

| Método | Ruta | Descripción | Acceso |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ofertas` | Listar ofertas (con paginación y filtros) | Público |
| `GET` | `/api/ofertas/:id` | Obtener detalle de una oferta | Público |
| `POST` | `/api/ofertas` | Crear nueva oferta (texto + imágenes) | Público (con validación) |
| `PUT` | `/api/ofertas/:id` | Actualizar oferta existente | Privado (Token) |
| `DELETE` | `/api/ofertas/:id` | Eliminar oferta | Privado (Token) |
| `POST` | `/api/upload` | Subida directa de imagen a R2 (URL firmada) | Privado (Token) |

### 4.2. Detalle de Implementación de Funciones

#### A. `handleGetOfertas(request)`
*   **Lógica:** Conecta a Turso, ejecuta `SELECT * FROM ofertas ORDER BY created_at DESC LIMIT ? OFFSET ?`.
*   **Respuesta:** JSON con array de ofertas y metadatos de paginación.
*   **Seguridad:** Sin restricciones, pero con rate limiting (ej. 100 req/min por IP).

#### B. `handleCreateOferta(request)`
*   **Lógica:**
    1.  Valida datos de entrada (título, descripción, precio, tipo, ubicación).
    2.  Procesa imágenes adjuntas (si vienen en base64 o multipart):
        *   Genera ID único para cada imagen.
        *   Sube la imagen a Bucket R2 (`ofertas/{id}/{imagen}`).
        *   Guarda URLs públicas en la DB.
    3.  Inserta registro en Turso.
*   **Seguridad:** Validación estricta de tipos de archivo (solo jpg, png, webp) y tamaño máximo (ej. 5MB).

#### C. `handleUploadUrl(request)` (Opcional - Para subidas grandes)
*   **Lógica:** Genera una URL firmada de R2 para que el frontend suba la imagen directamente (ahorra ancho de banda al Worker).
*   **Uso:** El frontend pide URL -> Worker devuelve URL firmada -> Frontend hace PUT a R2 directamente.

#### D. `handleAuth(request)` (Gestión de Admin)
*   **Lógica:** Verifica un token simple (Bearer Token) en las cabeceras para operaciones de escritura/edición.
*   **Implementación:** Middleware que chequea `Authorization: Bearer <TOKEN_SECRETO>` antes de ejecutar POST/PUT/DELETE.

### 4.3. Consideraciones Técnicas del Worker
*   **CORS:** Configurar cabeceras `Access-Control-Allow-Origin` para aceptar peticiones solo desde `https://tu-usuario.github.io`.
*   **Entorno:** Uso de `env.TURSO_DATABASE_URL`, `env.TURSO_AUTH_TOKEN`, `env.R2_BUCKET` inyectados vía `wrangler.toml`.
*   **Errores:** Bloque `try/catch` global para devolver errores estandarizados (400, 401, 500).

## 5. Fases de Implementación Detallada

### Fase 1: Configuración del Entorno (30 min)
**Objetivo:** Tener las cuentas creadas y el entorno local listo.

1.  **Cuentas:**
    -   Crear cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up).
    -   Crear cuenta en [Turso](https://turso.tech/).
    -   Asegurar cuenta de GitHub activa.
2.  **Instalación Local:**
    ```bash
    # Instalar Node.js (si no existe)
    # Instalar Wrangler CLI
    npm install -g wrangler
    
    # Autenticar en Cloudflare
    wrangler login
    
    # Autenticar en Turso (instalar CLI de Turso si es necesario)
    # O usar credenciales directamente desde el dashboard de Turso
    ```
3.  **Estructura del Proyecto:**
    ```text
    /proyecto-alquiler
    ├── /frontend (Repositorio GitHub)
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── /backend (Carpeta local para deploy)
        ├── wrangler.toml
        ├── src/index.js
        └── package.json
    ```

### Fase 2: Base de Datos y Almacenamiento (45 min)
**Objetivo:** Preparar Turso y R2 para recibir datos.

1.  **Crear Base de Datos en Turso:**
    -   Ir al Dashboard de Turso -> "Create Database".
    -   Nombre: `ofertas-alquiler`.
    -   Ubicación: Elegir la más cercana (ej. `eu-west`).
    -   Copiar las credenciales: `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
2.  **Definir Esquema SQL:**
    Ejecutar en la consola de Turso o vía CLI:
    ```sql
    CREATE TABLE IF NOT EXISTS ofertas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL,
        ubicacion TEXT,
        imagen_url TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ```
3.  **Configurar Cloudflare R2:**
    -   Dashboard Cloudflare -> R2 -> "Create Bucket".
    -   Nombre: `fotos-alquiler`.
    -   Configurar permisos públicos o generar tokens para acceso seguro (recomendado: acceso público solo lectura, escritura desde el Worker).

### Fase 3: Desarrollo del Backend (Cloudflare Worker) (2-3 horas)
**Objetivo:** Crear la API que conecta todo.

1.  **Inicializar Proyecto Worker:**
    ```bash
    mkdir backend-cf
    cd backend-cf
    npm init -y
    npm install @libsql/client
    npx wrangler init
    ```
2.  **Configurar `wrangler.toml`:**
    ```toml
    name = "api-alquiler"
    main = "src/index.js"
    compatibility_date = "2024-01-01"

    # Variables de entorno (Secrets)
    # Se configuran con: npx wrangler secret put TURSO_AUTH_TOKEN
    
    [[r2_buckets]]
    binding = "MI_BUCKET"
    bucket_name = "fotos-alquiler"
    ```
3.  **Implementar Lógica (`src/index.js`):**
    -   Configurar cliente de Turso.
    -   Manejar método `POST`:
        -   Parsear `multipart/form-data` (usando librerías ligeras o nativo de CF si disponible).
        -   Subir imagen a `MI_BUCKET.put()`.
        -   Insertar registro en Turso con la URL de la imagen.
    -   Manejar método `GET` (opcional, para listar ofertas).
    -   **Importante:** Configurar cabeceras CORS para permitir peticiones desde `*.github.io`.

    *Snippet conceptual:*
    ```javascript
    export default {
      async fetch(request, env) {
        const corsHeaders = {
          "Access-Control-Allow-Origin": "https://tu-usuario.github.io", 
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

        if (request.method === "POST") {
          // 1. Procesar FormData
          const formData = await request.formData();
          const imagen = formData.get('foto');
          const titulo = formData.get('titulo');
          
          // 2. Subir a R2
          const key = `${Date.now()}-${imagen.name}`;
          await env.MI_BUCKET.put(key, imagen);
          const imageUrl = `https://pub-r2.tudominio.com/${key}`; // URL pública

          // 3. Guardar en Turso
          const stmt = env.TURSO.prepare("INSERT INTO ofertas (titulo, imagen_url) VALUES (?, ?)");
          await stmt.run(titulo, imageUrl);

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
        
        return new Response("Not Found", { status: 404 });
      }
    };
    ```
4.  **Desplegar Worker:**
    ```bash
    npx wrangler secret put TURSO_DATABASE_URL
    npx wrangler secret put TURSO_AUTH_TOKEN
    npx wrangler deploy
    # Anotar la URL resultante: https://api-alquiler.tu-subdominio.workers.dev
    ```

### Fase 4: Desarrollo del Frontend (GitHub Pages) (3-4 horas)
**Objetivo:** Adaptar el formulario existente para conectar con la API.

1.  **Preparar Repositorio GitHub:**
    -   Crear repo `ofertas-alquiler`.
    -   Subir `index.html`, `style.css`, `app.js`.
    -   Activar GitHub Pages en Settings -> Pages (Source: `main` branch).
2.  **Mejorar HTML (`index.html`):**
    -   Añadir input específico para imágenes con atributos móviles.
    ```html
    <input type="file" id="fotoInput" accept="image/*" capture="environment">
    <!-- 'capture="environment"' prioriza la cámara trasera en móviles -->
    <div id="previewContainer"></div>
    ```
3.  **Lógica JavaScript (`app.js`):**
    -   **Preview de Imagen:** Leer el archivo seleccionado con `FileReader` y mostrarlo antes de enviar.
    -   **Compresión (Opcional pero recomendada):** Usar Canvas API para redimensionar fotos grandes antes de enviar (ahorra ancho de banda y tiempo de subida).
    -   **Envío al Worker:**
    ```javascript
    const API_URL = "https://api-alquiler.tu-subdominio.workers.dev";

    async function handleSubmit(event) {
      event.preventDefault();
      const formData = new FormData(document.getElementById('miFormulario'));
      
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          body: formData,
          // No setting Content-Type header manually allows browser to set boundary for multipart
        });
        
        if (response.ok) {
          alert("¡Oferta creada con éxito!");
        } else {
          alert("Error al crear la oferta");
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
    ```
4.  **Pruebas Locales y Remotas:**
    -   Probar en escritorio (subida de archivo).
    -   Probar en móvil (abrir cámara vs galería).

### Fase 5: Despliegue Final y Validación (1 hora)
1.  **Push a GitHub:** `git push origin main`. Verificar que GitHub Pages actualiza la web.
2.  **Verificación de CORS:** Asegurar que el Worker acepta el dominio de GitHub Pages.
3.  **Prueba End-to-End:**
    -   Abrir la web en móvil.
    -   Rellenar datos.
    -   Tomar foto.
    -   Enviar.
    -   Verificar en DB Turso y Bucket R2 que los datos existen.

---

## 5. Consideraciones de Seguridad

1.  **CORS Estricto:** El Worker debe tener una lista blanca (`Allow-Origin`) que incluya únicamente tu dominio de GitHub Pages (`https://usuario.github.io`).
2.  **Validación de Entrada:** Validar tipo de archivo (solo imágenes), tamaño máximo (ej. 5MB) y sanitizar textos en el Worker antes de guardar en DB.
3.  **Secretos:** Nunca hardcodear tokens de Turso o claves de R2 en el código del frontend. Todo secreto va en `wrangler.toml` o variables de entorno del Worker.
4.  **Rate Limiting:** Configurar reglas básicas en Cloudflare para evitar abusos (ej. máx 10 requests/minuto por IP).

---

## 6. Siguientes Pasos Inmediatos

1.  Confirmar si se desea proceder con la generación del código base inicial (`wrangler.toml`, `index.js`, `index.html` mejorado).
2.  Definir nombre del proyecto para los recursos en la nube.
3.  Decidir si se requiere compresión de imágenes en cliente (recomendado para móviles con cámaras de alta resolución).
