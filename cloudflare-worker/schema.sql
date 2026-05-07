-- Esquema de base de datos para Turso (SQLite)
-- GearShare - Plataforma de alquiler de material deportivo

-- 1. Tabla de categorías con tarifas de seguro
CREATE TABLE IF NOT EXISTS categories_insurance (
    category_id TEXT PRIMARY KEY,
    insurance_fee REAL NOT NULL DEFAULT 4.50 -- 💰 Tarifa fija de seguro por categoría
);

-- Insertar datos iniciales (usamos INSERT OR IGNORE para no fallar si ya existen)
INSERT OR IGNORE INTO categories_insurance (category_id, insurance_fee) VALUES
    ('surf', 4.50),
    ('esquí', 3.00),
    ('snowboard', 3.00),
    ('ciclismo', 3.00),
    ('montañismo', 1.50),
    ('escalada', 1.50),
    ('kayak', 4.50);

-- 2. Tabla de ofertas de alquiler
CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    sport_type TEXT NOT NULL,
    material_name TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    price_per_alquiler REAL NOT NULL, -- ⚠️ PRECIO BASE DEL OFERENTE (sin comisiones ni seguros)
    available_from TEXT NOT NULL,
    available_to TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Índices para rendimiento
-- Índices simples para filtros directos
CREATE INDEX IF NOT EXISTS idx_offers_sport ON offers(sport_type);
CREATE INDEX IF NOT EXISTS idx_offers_location ON offers(location);
CREATE INDEX IF NOT EXISTS idx_offers_price ON offers(price_per_alquiler);

-- Índice compuesto para búsqueda de fechas (muy útil para la lógica de disponibilidad)
-- Ayuda a filtrar rápidamente rangos de fechas
CREATE INDEX IF NOT EXISTS idx_offers_dates ON offers(available_from, available_to);

-- Índice para búsqueda de texto en nombre de material (LIKE '%...%')
-- Nota: LIKE con comodín al inicio (%) no usa índices eficientemente en SQLite estándar,
-- pero este índice ayuda si buscas por prefijo o si el optimizador decide usarlo para ordenar.
CREATE INDEX IF NOT EXISTS idx_offers_material ON offers(material_name);