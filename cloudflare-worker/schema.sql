-- Esquema de base de datos para Turso (SQLite)
-- GearShare - Plataforma de préstamo de material deportivo
-- Ejecutar este script al crear la base de datos

CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK(tipo IN ('tengo', 'busco')),
    deporte TEXT NOT NULL,
    material TEXT NOT NULL,
    descripcion TEXT,
    precio REAL NOT NULL,
    ubicacion TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    nombre_contacto TEXT NOT NULL,
    email_contacto TEXT NOT NULL,
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'completado', 'cancelado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo ON solicitudes(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_deporte ON solicitudes(deporte);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_created_at ON solicitudes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha_inicio ON solicitudes(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_solicitudes_ubicacion ON solicitudes(ubicacion);

-- Tabla opcional para tracking de imágenes (si se añade en el futuro)
CREATE TABLE IF NOT EXISTS image_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    solicitud_id INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL
);
