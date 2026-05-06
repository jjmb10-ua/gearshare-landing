import { createClient } from '@libsql/client';

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Inicializar cliente de Turso
function getTursoClient() {
  return createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });
}

// Manejar preflight requests (CORS)
function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(null, {
    headers: {
      'Allow': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}

// Endpoint: Obtener todas las ofertas
async function handleGetOfertas(request) {
  try {
    const client = getTursoClient();
    const result = await client.execute('SELECT * FROM ofertas ORDER BY created_at DESC');
    
    return new Response(JSON.stringify({
      success: true,
      data: result.rows
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Obtener una oferta por ID
async function handleGetOferta(request, id) {
  try {
    const client = getTursoClient();
    const result = await client.execute({
      sql: 'SELECT * FROM ofertas WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Oferta no encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: result.rows[0]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Crear una nueva oferta
async function handleCreateOferta(request) {
  try {
    const body = await request.json();
    const { tipo, titulo, descripcion, precio, ubicacion, imagenes, contacto } = body;
    
    // Validaciones básicas
    if (!tipo || !titulo || !precio) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos requeridos: tipo, titulo, precio'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const client = getTursoClient();
    const result = await client.execute({
      sql: `INSERT INTO ofertas (tipo, titulo, descripcion, precio, ubicacion, imagenes, contacto, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [tipo, titulo, descripcion || '', precio, ubicacion || '', JSON.stringify(imagenes || []), JSON.stringify(contacto || {})]
    });
    
    return new Response(JSON.stringify({
      success: true,
      data: { id: result.lastInsertRowid }
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Actualizar una oferta
async function handleUpdateOferta(request, id) {
  try {
    const body = await request.json();
    const { tipo, titulo, descripcion, precio, ubicacion, imagenes, contacto } = body;
    
    const client = getTursoClient();
    const result = await client.execute({
      sql: `UPDATE ofertas 
            SET tipo = ?, titulo = ?, descripcion = ?, precio = ?, ubicacion = ?, imagenes = ?, contacto = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [tipo, titulo, descripcion, precio, ubicacion, JSON.stringify(imagenes), JSON.stringify(contacto), id]
    });
    
    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Oferta no encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Oferta actualizada correctamente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Eliminar una oferta
async function handleDeleteOferta(id) {
  try {
    const client = getTursoClient();
    const result = await client.execute({
      sql: 'DELETE FROM ofertas WHERE id = ?',
      args: [id]
    });
    
    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Oferta no encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Oferta eliminada correctamente'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Obtener URL firmada para subir imagen a R2
async function handleGetUploadUrl(request) {
  try {
    const { filename, contentType } = await request.json();
    
    if (!filename) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nombre de archivo requerido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Generar nombre único para el archivo
    const uniqueFilename = `${Date.now()}-${filename}`;
    
    // En un entorno real, aquí generarías una URL firmada de R2
    // Por simplicidad, devolvemos el nombre del archivo
    return new Response(JSON.stringify({
      success: true,
      uploadUrl: `https://imágenes.tudominio.com/${uniqueFilename}`,
      filename: uniqueFilename
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Endpoint: Subir imagen directamente (alternativa a URL firmada)
async function handleUploadImage(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    
    if (!file) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se proporcionó ninguna imagen'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Generar nombre único
    const filename = `${Date.now()}-${file.name}`;
    
    // Subir a R2
    await IMAGES_BUCKET.put(filename, file);
    
    const imageUrl = `https://imágenes.tudominio.com/${filename}`;
    
    return new Response(JSON.stringify({
      success: true,
      imageUrl: imageUrl,
      filename: filename
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Exportar el handler principal
export default {
  async fetch(request, env, ctx) {
    // Asignar variables de entorno
    globalThis.CORS_ORIGIN = env.CORS_ORIGIN;
    globalThis.TURSO_DATABASE_URL = env.TURSO_DATABASE_URL;
    globalThis.TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN;
    globalThis.IMAGES_BUCKET = env.IMAGES_BUCKET;
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Manejar preflight CORS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }
    
    // Rutas API
    try {
      // GET /api/ofertas - Listar ofertas
      if (path === '/api/ofertas' && request.method === 'GET') {
        return handleGetOfertas(request);
      }
      
      // POST /api/ofertas - Crear oferta
      if (path === '/api/ofertas' && request.method === 'POST') {
        return handleCreateOferta(request);
      }
      
      // GET /api/ofertas/:id - Obtener oferta por ID
      const getMatch = path.match(/^\/api\/ofertas\/(\d+)$/);
      if (getMatch && request.method === 'GET') {
        return handleGetOferta(request, getMatch[1]);
      }
      
      // PUT /api/ofertas/:id - Actualizar oferta
      const putMatch = path.match(/^\/api\/ofertas\/(\d+)$/);
      if (putMatch && request.method === 'PUT') {
        return handleUpdateOferta(request, putMatch[1]);
      }
      
      // DELETE /api/ofertas/:id - Eliminar oferta
      const deleteMatch = path.match(/^\/api\/ofertas\/(\d+)$/);
      if (deleteMatch && request.method === 'DELETE') {
        return handleDeleteOferta(deleteMatch[1]);
      }
      
      // POST /api/upload-url - Obtener URL para subir imagen
      if (path === '/api/upload-url' && request.method === 'POST') {
        return handleGetUploadUrl(request);
      }
      
      // POST /api/upload-image - Subir imagen directamente
      if (path === '/api/upload-image' && request.method === 'POST') {
        return handleUploadImage(request);
      }
      
      // Ruta no encontrada
      return new Response(JSON.stringify({
        success: false,
        error: 'Endpoint no encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Error interno del servidor'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
