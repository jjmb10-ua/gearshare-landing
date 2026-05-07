# Arquitectura y Plan de Implementación: Formulario Serverless

## 1. Resumen Ejecutivo

Este documento detalla la arquitectura técnica y el plan de implementación para un formulario web estático que permite crear ofertas de alquiler con captura de imágenes desde dispositivos móviles. La solución utiliza tecnologías **serverless** para garantizar escalabilidad, bajo coste (€0 inicial) y mantenimiento mínimo.

---

## 2. Arquitectura Técnica

### Diagrama de Flujo de Datos
```
[Usuario/Móvil] 
      │
      ▼
[Cloudflare Pages] (Frontend Estático: HTML/CSS/JS Vanilla)
      │
      ├───(1) Solicitud API POST/GET───▶ [Cloudflare Worker] (Backend Lógica)
      │                                         │
      ├───(2) Subida Imagen ────────────────────┤
      │                                         ├───(3) Lectura/Escritura───▶ [Turso DB] (SQLite Edge)
      │                                         │
      │                                         └───(4) Almacenamiento──────▶ [Cloudflare R2] (Imágenes)
      │
      └───(5) Renderizado UI ◀──────────────────┘
```

### Componentes Principales

| Componente | Tecnología | Función | Coste Estimado (Inicio) |
| :--- | :--- | :--- | :--- |
| **Frontend** | Cloudflare Pages + JS Vanilla | Interfaz de usuario, lógica de cámara, validación local. | Gratis |
| **Backend** | Cloudflare Workers (Pages Functions) | API REST, autenticación, orquestación de datos. | Gratis (100k req/día) |
| **Base de Datos** | Turso (libSQL) | Almacenamiento estructurado de ofertas y usuarios. | Gratis (9GB, 500MB escritura/mes) |
| **Almacenamiento** | Cloudflare R2 | Guardado de fotos de las ofertas. | Gratis (10GB, 10M lecturas/mes) |
| **Red/Seguridad** | Cloudflare Global Network | SSL automático, protección DDoS, CDN. | Incluido |

### Justificación de Decisiones Técnicas
1.  **JavaScript Vanilla:** Elimina la necesidad de frameworks pesados (React/Vue), reduciendo el tamaño del bundle y mejorando la velocidad de carga en móviles.
2.  **Cloudflare Pages + Workers:** Permite alojar el sitio estático y la lógica de backend en la misma plataforma, reduciendo la latencia y simplificando el despliegue.
3.  **Turso (SQLite):** Base de datos ligera, compatible con SQL estándar, ubicada en el "edge" (cerca del usuario) para lecturas rápidas.
4.  **Captura de Cámara Nativa:** Uso de la API HTML5 `<input type="file" capture>` para evitar librerías complejas de acceso a hardware.

---

## 3. Fases de Implementación Detallada

### Fase 1: Configuración del Entorno y Cuentas
**Objetivo:** Tener las herramientas listas para desarrollar.
*   **Acciones:**
    1.  Crear cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up) y [Turso](https://turso.tech/).
    2.  Instalar Node.js (v18+) y Wrangler CLI (`npm install -g wrangler`).
    3.  Autenticar Wrangler: `wrangler login`.
    4.  Inicializar proyecto local:
        ```bash
        mkdir proyecto-alquiler
        cd proyecto-alquiler
        npm init -y
        npm install @libsql/client
        ```
    5.  Crear estructura de carpetas:
        ```text
        /public (frontend estático)
        /functions (backend serverless)
        /scripts (migraciones DB)
        wrangler.toml
        ```

### Fase 2: Configuración de Base de Datos (Turso)
**Objetivo:** Preparar el almacenamiento de datos.
*   **Acciones:**
    1.  Crear base de datos en el dashboard de Turso o vía CLI:
        ```bash
        turso db create alquiler-db
        turso db shell alquiler-db
        ```
    2.  Ejecutar script de creación de tablas (`schema.sql`):
        ```sql
        CREATE TABLE IF NOT EXISTS ofertas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          titulo TEXT NOT NULL,
          descripcion TEXT,
          precio REAL NOT NULL,
          ubicacion TEXT,
          imagen_url TEXT,
          contacto_email TEXT,
          creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        ```
    3.  Obtener credenciales:
        *   `TURSO_DATABASE_URL`
        *   `TURSO_AUTH_TOKEN` (crear token de lectura/escritura).
    4.  Añadir credenciales a `wrangler.toml` como variables de entorno seguras.

### Fase 3: Desarrollo del Backend (Cloudflare Workers)
**Objetivo:** Crear la API que conecta el frontend con la DB y R2.
*   **Estructura de Endpoints (`/functions/api/`):**
    *   `POST /api/ofertas`: Recibe datos JSON y archivo de imagen.
        *   Valida datos.
        *   Sube imagen a R2 (Bucket: `imagenes-ofertas`).
        *   Guarda metadatos + URL de imagen en Turso.
    *   `GET /api/ofertas`: Lista ofertas (con paginación).
    *   `GET /api/ofertas/:id`: Detalle de una oferta.
*   **Implementación Clave:**
    *   Configurar `wrangler.toml` para vincular R2 y Variables de Entorno.
    *   Usar `@libsql/client` para conectar a Turso desde el Worker.
    *   Manejar CORS para permitir peticiones desde el dominio de Pages.

### Fase 4: Desarrollo del Frontend (JavaScript Vanilla)
**Objetivo:** Adaptar el formulario existente para interactuar con la nueva arquitectura.
*   **Modificaciones HTML:**
    *   Asegurar `<form id="formulario-oferta">`.
    *   Añadir input de archivo optimizado para móvil:
        ```html
        <input type="file" id="foto" name="foto" accept="image/*" capture="environment">
        <!-- 'capture="environment"' prioriza la cámara trasera en móviles -->
        ```
*   **Lógica JavaScript (`/public/app.js`):**
    1.  **Manejo del Formulario:** Interceptar `submit`, prevenir recarga por defecto.
    2.  **Previsualización:** Leer archivo con `FileReader` para mostrar miniatura antes de subir.
    3.  **Compresión (Opcional pero recomendada):** Usar Canvas API para reducir resolución de la foto si supera 2MB antes de enviarla (ahorro de ancho de banda).
    4.  **Envío asíncrono:** Usar `fetch()` para enviar `FormData` al endpoint `/api/ofertas`.
    5.  **Gestión de Estados:** Mostrar spinners de carga, mensajes de éxito/error claros.

### Fase 5: Despliegue y Pruebas
**Objetivo:** Poner la aplicación en producción y validar.
*   **Acciones:**
    1.  Crear proyecto en Cloudflare Pages: `wrangler pages project create`.
    2.  Configurar variables de entorno en el dashboard de Pages (copiar las de Turso y R2).
    3.  Desplegar: `wrangler pages deploy ./public --project-name=mi-proyecto`.
    4.  **Pruebas Críticas:**
        *   Probar en dispositivo móvil real (iOS y Android) para verificar apertura de cámara vs galería.
        *   Verificar tiempo de subida de imágenes.
        *   Comprobar persistencia de datos en Turso.
        *   Validar seguridad (intentos de inyección SQL o subida de archivos no imágenes).

---

## 4. Consideraciones de Seguridad y Rendimiento

1.  **Validación de Archivos:** El backend debe verificar estrictamente que los archivos subidos sean imágenes (MIME type `image/jpeg`, `image/png`, etc.) para evitar ejecuciones maliciosas.
2.  **Rate Limiting:** Configurar reglas en Cloudflare para limitar peticiones por IP y evitar abusos en la API.
3.  **Optimización Móvil:**
    *   Uso de `loading="lazy"` en listas de imágenes.
    *   Compresión de imágenes en el cliente antes de la subida para ahorrar datos al usuario móvil.
4.  **Privacidad:** No almacenar datos sensibles innecesarios. Si se requiere login, considerar integración con proveedores de identidad (ej. Auth0 o Cloudflare Access) en una fase posterior.

## 5. Próximos Pasos Inmediatos

1.  Confirmar inicio del proyecto.
2.  Ejecutar comandos de la **Fase 1**.
3.  Generar el código base inicial (esqueleto del proyecto).

---
*Documento generado para evaluación de viabilidad técnica.*
