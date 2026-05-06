-- Esquema de base de datos para Turso (SQLite)
-- Ejecutar este script al crear la base de datos

CREATE TABLE IF NOT EXISTS ofertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK(tipo IN ('tengo', 'busco')),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    precio REAL NOT NULL,
    ubicacion TEXT,
    imagenes TEXT DEFAULT '[]',  -- JSON array de URLs de imágenes
    contacto TEXT DEFAULT '{}',  -- JSON object con datos de contacto
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_ofertas_tipo ON ofertas(tipo);
CREATE INDEX IF NOT EXISTS idx_ofertas_created_at ON ofertas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ofertas_precio ON ofertas(precio);

-- Tabla opcional para tracking de subidas de imágenes (si se necesita)
CREATE TABLE IF NOT EXISTS image_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    oferta_id INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (oferta_id) REFERENCES ofertas(id) ON DELETE SET NULL
);
