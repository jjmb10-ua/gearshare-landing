import { createClient } from '@libsql/client';

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://jjmb10-ua.github.io',
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

// Endpoint: Obtener todas las solicitudes
async function handleGetSolicitudes(request) {
  try {
    const client = getTursoClient();
    const result = await client.execute('SELECT * FROM solicitudes ORDER BY created_at DESC');
    
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

// Endpoint: Obtener solicitudes filtradas por tipo y deporte
async function handleGetSolicitudesFiltradas(request) {
  try {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');
    const deporte = url.searchParams.get('deporte');
    const estado = url.searchParams.get('estado') || 'activo';
    
    let sql = 'SELECT * FROM solicitudes WHERE estado = ?';
    const args = [estado];
    
    if (tipo) {
      sql += ' AND tipo = ?';
      args.push(tipo);
    }
    
    if (deporte) {
      sql += ' AND deporte = ?';
      args.push(deporte);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const client = getTursoClient();
    const result = await client.execute({ sql, args });
    
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

// Endpoint: Obtener una solicitud por ID
async function handleGetSolicitud(request, id) {
  try {
    const client = getTursoClient();
    const result = await client.execute({
      sql: 'SELECT * FROM solicitudes WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Solicitud no encontrada'
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

// Endpoint: Crear una nueva solicitud
async function handleCreateSolicitud(request) {
  try {
    const body = await request.json();
    const { tipo, deporte, material, descripcion, precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto } = body;
    
    // Validaciones básicas
    if (!tipo || !deporte || !material || !precio || !ubicacion || !fecha_inicio || !fecha_fin || !nombre_contacto || !email_contacto) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos requeridos: tipo, deporte, material, precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Validar que fecha_fin sea mayor o igual a fecha_inicio
    if (new Date(fecha_fin) < new Date(fecha_inicio)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La fecha de fin debe ser posterior o igual a la fecha de inicio'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const client = getTursoClient();
    const result = await client.execute({
      sql: `INSERT INTO solicitudes (tipo, deporte, material, descripcion, precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [tipo, deporte, material, descripcion || '', precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto]
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

// Endpoint: Actualizar una solicitud
async function handleUpdateSolicitud(request, id) {
  try {
    const body = await request.json();
    const { tipo, deporte, material, descripcion, precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto, estado } = body;
    
    const client = getTursoClient();
    const result = await client.execute({
      sql: `UPDATE solicitudes 
            SET tipo = ?, deporte = ?, material = ?, descripcion = ?, precio = ?, ubicacion = ?, 
                fecha_inicio = ?, fecha_fin = ?, nombre_contacto = ?, email_contacto = ?, estado = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [tipo, deporte, material, descripcion, precio, ubicacion, fecha_inicio, fecha_fin, nombre_contacto, email_contacto, estado, id]
    });
    
    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Solicitud no encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Solicitud actualizada correctamente'
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

// Endpoint: Eliminar una solicitud
async function handleDeleteSolicitud(id) {
  try {
    const client = getTursoClient();
    const result = await client.execute({
      sql: 'DELETE FROM solicitudes WHERE id = ?',
      args: [id]
    });
    
    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Solicitud no encontrada'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Solicitud eliminada correctamente'
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
      // GET /api/solicitudes - Listar todas las solicitudes
      if (path === '/api/solicitudes' && request.method === 'GET') {
        return handleGetSolicitudes(request);
      }
      
      // GET /api/solicitudes/filter - Filtrar solicitudes por tipo, deporte, estado
      if (path === '/api/solicitudes/filter' && request.method === 'GET') {
        return handleGetSolicitudesFiltradas(request);
      }
      
      // POST /api/solicitudes - Crear solicitud
      if (path === '/api/solicitudes' && request.method === 'POST') {
        return handleCreateSolicitud(request);
      }
      
      // GET /api/solicitudes/:id - Obtener solicitud por ID
      const getMatch = path.match(/^\/api\/solicitudes\/(\d+)$/);
      if (getMatch && request.method === 'GET') {
        return handleGetSolicitud(request, getMatch[1]);
      }
      
      // PUT /api/solicitudes/:id - Actualizar solicitud
      const putMatch = path.match(/^\/api\/solicitudes\/(\d+)$/);
      if (putMatch && request.method === 'PUT') {
        return handleUpdateSolicitud(request, putMatch[1]);
      }
      
      // DELETE /api/solicitudes/:id - Eliminar solicitud
      const deleteMatch = path.match(/^\/api\/solicitudes\/(\d+)$/);
      if (deleteMatch && request.method === 'DELETE') {
        return handleDeleteSolicitud(deleteMatch[1]);
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
