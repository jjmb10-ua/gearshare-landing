import { createClient } from '@libsql/client';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

let dbClient = null;
function getDbClient(env) {
  if (!dbClient) {
    dbClient = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return dbClient;
}

function validateOfferFields(data) {
  const required = ['sport_type', 'material_name', 'location', 'price_per_alquiler', 'available_from', 'available_to', 'contact_name', 'contact_email'];
  const missing = required.filter(f => !data[f]?.trim());
  if (missing.length > 0) return `Faltan campos obligatorios: ${missing.join(', ')}`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) return 'Formato de email inválido';

  const price = parseFloat(data.price_per_alquiler);
  if (isNaN(price) || price <= 0) return 'El precio debe ser mayor a 0';

  const start = new Date(data.available_from);
  const end = new Date(data.available_to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Formato de fecha inválido';
  if (start < today) return 'La fecha de inicio no puede ser en el pasado';
  if (end < start) return 'La fecha de fin debe ser posterior o igual a la de inicio';

  return null;
}

async function uploadImageToR2(bucket, file, baseUrl) {
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error('La imagen excede el límite de 5MB');
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen válida');

  const buffer = await file.arrayBuffer();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${crypto.randomUUID()}-${safeName}`;

  await bucket.put(filename, buffer, {
    httpMetadata: { contentType: file.type },
  });

  return `${baseUrl}/api/images/${filename}`;
}

async function handleGetImage(env, filename) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return jsonResponse({ success: false, error: 'Nombre de archivo inválido' }, 400);
  }

  const object = await env.IMAGES_BUCKET.get(filename);
  if (!object) return jsonResponse({ success: false, error: 'Imagen no encontrada' }, 404);

  const headers = new Headers();
  headers.set('content-type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');

  return new Response(object.body, { headers });
}

async function handleCreateOffer(request, env) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ success: false, error: 'Content-Type debe ser multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const fields = {
    sport_type: formData.get('sport_type')?.toString().trim(),
    material_name: formData.get('material_name')?.toString().trim(),
    description: formData.get('description')?.toString().trim() || '',
    location: formData.get('location')?.toString().trim(),
    price_per_alquiler: formData.get('price_per_alquiler')?.toString(),
    available_from: formData.get('available_from')?.toString(),
    available_to: formData.get('available_to')?.toString(),
    contact_name: formData.get('contact_name')?.toString().trim(),
    contact_email: formData.get('contact_email')?.toString().trim(),
    image: formData.get('image'),
  };

  const validationError = validateOfferFields(fields);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);

  if (!fields.image || !(fields.image instanceof File)) {
    return jsonResponse({ success: false, error: 'La imagen es obligatoria' }, 400);
  }

  let imageUrl;
  try {
    const baseUrl = new URL(request.url).origin;
    imageUrl = await uploadImageToR2(env.IMAGES_BUCKET, fields.image, baseUrl);
  } catch (e) {
    return jsonResponse({ success: false, error: `Error al subir imagen: ${e.message}` }, 400);
  }

  const client = getDbClient(env);
  const offerId = crypto.randomUUID();
  const price = parseFloat(fields.price_per_alquiler);

  await client.execute({
    sql: `INSERT INTO offers (id, sport_type, material_name, description, location, price_per_alquiler, available_from, available_to, contact_name, contact_email, image_url) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      offerId, fields.sport_type, fields.material_name, fields.description, fields.location,
      price, fields.available_from, fields.available_to, fields.contact_name, fields.contact_email, imageUrl
    ]
  });

  return jsonResponse({ success: true, data: { id: offerId, image_url: imageUrl } }, 201);
}

// 🔄 FUNCIÓN MODIFICADA CON LA NUEVA REGLA DE NEGOCIO
async function handleSearchOffers(request, env) {
  const url = new URL(request.url);
  const sport = url.searchParams.get('sport');
  const material = url.searchParams.get('material');
  const dateStart = url.searchParams.get('date_start');
  const dateEnd = url.searchParams.get('date_end');
  const maxBudget = parseFloat(url.searchParams.get('max_budget') || '999999');
  const location = url.searchParams.get('location');

  // 📌 REGLA: total_price = (precio_ofertante * 1.1) + seguro
  let sql = `
    SELECT o.*, 
           c.insurance_fee,
           ROUND((o.price_per_alquiler * 1.1) + COALESCE(c.insurance_fee, 0), 2) as total_price
    FROM offers o
    LEFT JOIN categories_insurance c ON o.sport_type = c.category_id
    WHERE 1=1
  `;
  const args = [];

  if (sport) { sql += ' AND o.sport_type = ?'; args.push(sport); }
  if (material) { sql += ' AND o.material_name LIKE ?'; args.push(`%${material}%`); }
  if (location) { sql += ' AND o.location LIKE ?'; args.push(`%${location}%`); }

  if (dateStart && dateEnd) {
    sql += ' AND o.available_from <= ? AND o.available_to >= ?';
    args.push(dateEnd, dateStart);
  } else if (dateStart) {
    sql += ' AND o.available_to >= ?';
    args.push(dateStart);
  }

  // 📌 El filtro de presupuesto también usa el precio final calculado
  if (!isNaN(maxBudget)) {
    sql += ' AND ((o.price_per_alquiler * 1.1) + COALESCE(c.insurance_fee, 0)) <= ?';
    args.push(maxBudget);
  }

  sql += ' ORDER BY total_price ASC LIMIT 50';

  const client = getDbClient(env);
  const result = await client.execute({ sql, args });
  return jsonResponse({ success: true, data: result.rows });
}

async function handleGetCategories(env) {
  const client = getDbClient(env);
  const result = await client.execute('SELECT * FROM categories_insurance');
  return jsonResponse({ success: true, data: result.rows });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/offers' && request.method === 'POST') return await handleCreateOffer(request, env);
      if (path === '/api/search' && request.method === 'GET') return await handleSearchOffers(request, env);
      if (path === '/api/categories' && request.method === 'GET') return await handleGetCategories(env);
      
      const imageMatch = path.match(/^\/api\/images\/(.+)$/);
      if (imageMatch && request.method === 'GET') {
        return await handleGetImage(env, imageMatch[1]);
      }

      return jsonResponse({ success: false, error: 'Endpoint no encontrado' }, 404);
    } catch (error) {
      console.error('Worker Error:', error);
      return jsonResponse({ success: false, error: 'Error interno del servidor' }, 500);
    }
  }
};