import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { initDb } from './db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretMarteHotel2026';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3010;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Database connection
let db;
try {
  db = await initDb();
  console.log('SQLite database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
}

// Helper: Get current time as HH:MM in Venezuela Timezone (America/Caracas UTC-4)
function getHoraActual() {
  const options = { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(new Date());
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.hour}:${map.minute}`;
}

// Helper: Get current date & time as DD/MM/YYYY, HH:MM in Venezuela Timezone (America/Caracas UTC-4)
function getFechaHoraActual() {
  const options = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(new Date());
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.day}/${map.month}/${map.year}, ${map.hour}:${map.minute}`;
}

// Helper: Calculate age from birthdate YYYY-MM-DD
function calcularEdadBackend(fechaNacStr) {
  if (!fechaNacStr) return 18;
  const birth = new Date(fechaNacStr);
  if (isNaN(birth.getTime())) return 18;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Helper: Format full name to reception shorthand (e.g., "Laura Medina" -> "L. Medina")
function formatGuestName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/).map(word => {
    if (!word) return '';
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Helper: Registrar evento en la bitácora de auditoría (v3 - Fase 3)
async function registrarAuditoria(usuarioId, usuarioNombre, rol, accion, detalle = '', ip = '') {
  try {
    const id = 'aud_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const fecha_hora = new Date().toISOString();
    await db.run(
      `INSERT INTO audit_logs (id, usuario_id, usuario_nombre, rol, accion, detalle, fecha_hora, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, usuarioId || 'sistema', usuarioNombre || 'Sistema', rol || 'Sistema', accion, detalle, fecha_hora, ip]
    );
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

// ====================================================
// SEGURIDAD Y AUTH MIDDLEWARE (v2 - Fase 1 & v3 - Fase 3)
// ====================================================
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Falta token.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }

  try {
    // Validate if user exists and is active (Immediate session revocation)
    const user = await db.get('SELECT id, username, nombre, rol, permisos, activo, hora_inicio, hora_fin FROM usuarios WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o sesión revocada.' });
    }

    if (user.activo === 0) {
      return res.status(401).json({ error: 'Cuenta de usuario desactivada. Contacte al Administrador.' });
    }
    
    req.user = user;
    req.user.permisos = JSON.parse(user.permisos || '[]');
    next();
  } catch (error) {
    console.error('Database error in requireAuth:', error);
    return res.status(500).json({ error: 'Error interno de servidor al validar sesión.' });
  }
};

// POST /api/auth/login - Autenticar usuario, validar horario/activo y firmar token (v3 - Fase 3)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Debe ingresar usuario y contraseña.' });
  }

  try {
    const user = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    if (user.activo === 0) {
      await registrarAuditoria(user.id, user.nombre, user.rol, 'Acceso Denegado', 'Intento de ingreso con cuenta desactivada', clientIp);
      return res.status(403).json({ error: 'Cuenta de usuario desactivada. Contacte al Administrador.' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      await registrarAuditoria(user.id, user.nombre, user.rol, 'Acceso Denegado', 'Contraseña incorrecta', clientIp);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Work schedule restriction for non-Admin users
    if (user.rol !== 'Administrador' && user.hora_inicio && user.hora_fin) {
      const now = new Date();
      const currentStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const isOvernight = user.hora_inicio > user.hora_fin;
      let isAllowed = false;
      if (!isOvernight) {
        isAllowed = currentStr >= user.hora_inicio && currentStr <= user.hora_fin;
      } else {
        isAllowed = currentStr >= user.hora_inicio || currentStr <= user.hora_fin;
      }
      if (!isAllowed) {
        await registrarAuditoria(user.id, user.nombre, user.rol, 'Acceso Denegado', `Fuera de horario laboral asignado (${user.hora_inicio} - ${user.hora_fin})`, clientIp);
        return res.status(403).json({ 
          error: `Acceso denegado: Fuera de su horario laboral asignado (${user.hora_inicio} - ${user.hora_fin}).` 
        });
      }
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    await registrarAuditoria(user.id, user.nombre, user.rol, 'Inicio de Sesión', 'Autenticación exitosa', clientIp);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        permisos: JSON.parse(user.permisos || '[]'),
        activo: user.activo !== undefined ? user.activo : 1,
        hora_inicio: user.hora_inicio || '',
        hora_fin: user.hora_fin || ''
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/usuarios - Listar usuarios (Admin, Super Admin o permiso de usuarios)
app.get('/api/usuarios', requireAuth, async (req, res) => {
  const isAuthorized = req.user.rol === 'Administrador' || req.user.rol === 'Super Admin' || req.user.rol === 'Superadmin' || (req.user.permisos && req.user.permisos.includes('usuarios'));
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere permiso del módulo Personal y Usuarios.' });
  }
  try {
    const users = await db.all('SELECT id, username, nombre, rol, permisos, activo, hora_inicio, hora_fin FROM usuarios');
    const parsedUsers = users.map(u => ({
      ...u,
      activo: u.activo !== undefined ? u.activo : 1,
      hora_inicio: u.hora_inicio || '',
      hora_fin: u.hora_fin || '',
      permisos: JSON.parse(u.permisos || '[]')
    }));
    res.json(parsedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// POST /api/usuarios - Crear usuario (Solo Admin)
app.post('/api/usuarios', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { username, password, nombre, rol, permisos, activo, hora_inicio, hora_fin } = req.body;
  if (!username || !password || !nombre || !rol || !permisos) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const existing = await db.get('SELECT id FROM usuarios WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    const id = 'u_' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    const permsStr = JSON.stringify(permisos);
    const userActivo = activo !== undefined ? (activo ? 1 : 0) : 1;

    await db.run(
      'INSERT INTO usuarios (id, username, password_hash, nombre, rol, permisos, activo, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username.trim(), hash, nombre.trim(), rol, permsStr, userActivo, hora_inicio || '', hora_fin || '']
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Crear Usuario', `Usuario ${username} (${rol}) creado`, req.ip);

    res.json({ success: true, message: 'Usuario creado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id - Editar permisos y datos de usuario (Solo Admin)
app.put('/api/usuarios/:id', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { id } = req.params;
  let { nombre, rol, permisos, password, activo, hora_inicio, hora_fin } = req.body;

  try {
    const user = await db.get('SELECT id, username FROM usuarios WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    let userActivo = activo !== undefined ? (activo ? 1 : 0) : 1;

    // Protecciones inmutables para el administrador root
    if (id === 'u_admin') {
      rol = 'Administrador';
      userActivo = 1; // Nunca puede ser desactivado
      permisos = [
        'dashboard', 'habitaciones', 'reservas', 'tickets',
        'entregaTurnos', 'inventarioLenceria', 'caja', 'tienda',
        'clientes', 'reportes', 'configuracion', 'audit_logs'
      ];
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await db.run(
        'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ?, password_hash = ?, activo = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?',
        [nombre.trim(), rol, JSON.stringify(permisos), hash, userActivo, hora_inicio || '', hora_fin || '', id]
      );
    } else {
      await db.run(
        'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ?, activo = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?',
        [nombre.trim(), rol, JSON.stringify(permisos), userActivo, hora_inicio || '', hora_fin || '', id]
      );
    }

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Editar Usuario', `Usuario ${user.username} actualizado`, req.ip);

    res.json({ success: true, message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PUT /api/usuarios/:id/toggle-activo - Cambiar estado activo/inactivo (Solo Admin)
app.put('/api/usuarios/:id/toggle-activo', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { id } = req.params;

  if (id === 'u_admin') {
    return res.status(400).json({ error: 'El administrador por defecto no puede desactivarse.' });
  }

  try {
    const user = await db.get('SELECT id, username, activo FROM usuarios WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const newStatus = user.activo === 1 ? 0 : 1;
    await db.run('UPDATE usuarios SET activo = ? WHERE id = ?', [newStatus, id]);

    await registrarAuditoria(
      req.user.id, 
      req.user.nombre, 
      req.user.rol, 
      'Cambiar Estado Usuario', 
      `Usuario ${user.username} ${newStatus === 1 ? 'activado' : 'desactivado'}`, 
      req.ip
    );

    res.json({ success: true, message: `Usuario ${newStatus === 1 ? 'activado' : 'desactivado'} correctamente.`, activo: newStatus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar estado de usuario' });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (Solo Admin)
app.delete('/api/usuarios/:id', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { id } = req.params;

  if (id === 'u_admin') {
    return res.status(400).json({ error: 'El administrador por defecto es inmutable y no puede eliminarse.' });
  }

  try {
    const user = await db.get('SELECT id, username FROM usuarios WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await db.run('DELETE FROM usuarios WHERE id = ?', [id]);

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Eliminar Usuario', `Usuario ${user.username} eliminado`, req.ip);

    res.json({ success: true, message: 'Usuario eliminado correctamente. Todas sus sesiones han sido revocadas.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// GET /api/audit-logs - Listar bitácora de auditoría (v3 - Fase 3)
app.get('/api/audit-logs', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Supervisor' && !req.user.permisos.includes('audit_logs')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de auditoría.' });
  }
  try {
    const logs = await db.all('SELECT * FROM audit_logs ORDER BY fecha_hora DESC LIMIT 150');
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Error al obtener bitácora de auditoría.' });
  }
});

// 1. GET /api/state - Fetch the entire application state
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const habitaciones = await db.all('SELECT * FROM habitaciones');
    
    // Joint query to fetch reservation details along with the client's information
    const reservasRaw = await db.all(`
      SELECT r.*, c.nombre as clienteNombre, c.dni as clienteDni, c.ci as clienteCi, c.tel as clienteTel, c.visitas as clienteVisitas
      FROM reservas r
      JOIN clientes c ON r.clienteId = c.id
    `);
    
    const reservas = reservasRaw.map(r => ({
      id: r.id,
      res: r.res,
      clienteId: r.clienteId,
      nombreAcomp: r.nombreAcomp,
      numHabitacion: r.numHabitacion,
      hora: r.hora,
      cliente: {
        id: r.clienteId,
        nombre: r.clienteNombre,
        dni: r.clienteDni,
        ci: r.clienteCi || r.clienteDni,
        tel: r.clienteTel,
        visitas: r.clienteVisitas
      }
    }));

    const clientes = await db.all('SELECT * FROM clientes');
    const caja = await db.all('SELECT * FROM caja');
    const consumos = await db.all('SELECT * FROM consumos');
    const productos = await db.all('SELECT * FROM productos');
    // Compute dynamic stock for combos
    for (const p of productos) {
      if (p.es_combo === 1 && p.producto_padre_id) {
        const parent = productos.find(x => x.id === p.producto_padre_id);
        p.stock = parent ? Math.floor(parent.stock / (p.unidades_por_combo || 1)) : 0;
      }
    }
    const tarifas = await db.all('SELECT * FROM tarifas');
    const tickets = await db.all('SELECT * FROM tickets ORDER BY fechaCreacion DESC');
    const entregaTurnos = await db.all('SELECT * FROM entrega_turnos ORDER BY fechaHoraEntrega DESC');
    const inventarioLenceria = await db.all('SELECT * FROM inventario_lenceria');
    const inventarioHabitaciones = await db.all('SELECT * FROM inventario_habitaciones');
    const tablaDanos = await db.all('SELECT * FROM tabla_danos');
    const historialEstadias = await db.all('SELECT * FROM historial_estadias ORDER BY ingreso DESC');

    const configuracionList = await db.all('SELECT * FROM configuracion');
    const configuracion = {};
    configuracionList.forEach(c => { configuracion[c.clave] = c.valor; });

    res.json({ 
      habitaciones, 
      reservas, 
      clientes, 
      caja, 
      consumos, 
      productos, 
      tarifas, 
      configuracion, 
      tickets, 
      entregaTurnos,
      inventarioLenceria,
      inventarioHabitaciones,
      tablaDanos,
      historialEstadias
    });
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tickets - Obtener tickets de limpieza/mantenimiento (v3 - Fase 6)
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM tickets ORDER BY fechaCreacion DESC');
    res.json(list);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets.' });
  }
});

// POST /api/tickets - Crear nuevo ticket de incidencia/requerimiento (v3 - Fase 6)
app.post('/api/tickets', requireAuth, async (req, res) => {
  const { numHabitacion, titulo, descripcion, categoria, prioridad, usuarioAsignadoId, usuarioAsignadoNombre } = req.body;

  if (!numHabitacion || !titulo || !categoria) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (Habitación, Título, Categoría).' });
  }

  try {
    const id = 'tkt_' + Date.now();
    const estado = 'Pendiente';
    const fechaCreacion = getHoraActual() + ' (' + new Date().toLocaleDateString('es-VE') + ')';

    await db.run(
      `INSERT INTO tickets (id, numHabitacion, titulo, descripcion, categoria, prioridad, estado, usuarioCreadorId, usuarioCreadorNombre, usuarioAsignadoId, usuarioAsignadoNombre, fechaCreacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        numHabitacion,
        titulo.trim(),
        descripcion ? descripcion.trim() : '',
        categoria || 'Limpieza',
        prioridad || 'Media',
        estado,
        req.user.id,
        req.user.nombre,
        usuarioAsignadoId || '',
        usuarioAsignadoNombre || '',
        fechaCreacion
      ]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Ticket Creado',
      `Ticket "${titulo.trim()}" en Hab. ${numHabitacion} (${categoria} - Prioridad: ${prioridad || 'Media'})`,
      req.ip
    );

    res.json({ success: true, message: 'Ticket registrado exitosamente.' });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Error al crear el ticket.' });
  }
});

// PUT /api/tickets/:id - Actualizar estado o datos de ticket (v3 - Fase 6)
app.put('/api/tickets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { estado, prioridad, usuarioAsignadoId, usuarioAsignadoNombre, descripcion } = req.body;

  try {
    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const nextEstado = estado || ticket.estado;
    const nextPrioridad = prioridad || ticket.prioridad;
    const nextDesc = descripcion !== undefined ? descripcion : ticket.descripcion;
    const nextAsigId = usuarioAsignadoId !== undefined ? usuarioAsignadoId : ticket.usuarioAsignadoId;
    const nextAsigNombre = usuarioAsignadoNombre !== undefined ? usuarioAsignadoNombre : ticket.usuarioAsignadoNombre;
    
    let fechaRes = ticket.fechaResolucion;
    if (nextEstado === 'Resuelto' && ticket.estado !== 'Resuelto') {
      fechaRes = getHoraActual() + ' (' + new Date().toLocaleDateString('es-VE') + ')';
    }

    await db.run(
      `UPDATE tickets 
       SET estado = ?, prioridad = ?, descripcion = ?, usuarioAsignadoId = ?, usuarioAsignadoNombre = ?, fechaResolucion = ? 
       WHERE id = ?`,
      [nextEstado, nextPrioridad, nextDesc, nextAsigId, nextAsigNombre, fechaRes, id]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Ticket Actualizado',
      `Ticket #${id} (Hab. ${ticket.numHabitacion}) actualizado a estado "${nextEstado}"`,
      req.ip
    );

    res.json({ success: true, message: `Ticket ${nextEstado.toLowerCase()} correctamente.` });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Error al actualizar ticket.' });
  }
});

// DELETE /api/tickets/:id - Eliminar ticket (v3 - Fase 6)
app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    await db.run('DELETE FROM tickets WHERE id = ?', [id]);

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Ticket Eliminar',
      `Ticket #${id} de Hab. ${ticket.numHabitacion} eliminado`,
      req.ip
    );

    res.json({ success: true, message: 'Ticket eliminado correctamente.' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Error al eliminar ticket.' });
  }
});

// GET /api/configuracion - Obtener la configuración del sistema (Tasa del Día, etc.)
app.get('/api/configuracion', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM configuracion');
    const config = {};
    list.forEach(item => { config[item.clave] = item.valor; });
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Error al obtener la configuración.' });
  }
});

// PUT /api/configuracion - Actualizar Tasa del Día o parámetros (v3 - Fase 1)
app.put('/api/configuracion', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere permiso de configuración.' });
  }
  const { tasa_usd } = req.body;
  try {
    if (tasa_usd !== undefined) {
      const val = parseFloat(tasa_usd);
      if (isNaN(val) || val <= 0) {
        return res.status(400).json({ error: 'La Tasa del Día debe ser un número mayor a cero.' });
      }
      await db.run(
        "INSERT INTO configuracion (clave, valor) VALUES ('tasa_usd', ?) ON CONFLICT(clave) DO UPDATE SET valor = ?",
        [val.toFixed(2), val.toFixed(2)]
      );
      await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Tasa del Día', `Actualizada Tasa del Día a 1 USD = Bs. ${val.toFixed(2)}`, req.ip);
    }
    res.json({ success: true, message: 'Configuración actualizada de forma exitosa.' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  }
});

// POST /api/habitaciones - Crear/Agregar nueva habitación al hotel
app.post('/api/habitaciones', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere permiso de configuración o Administrador.' });
  }

  const { num, tipo } = req.body;
  if (!num || !tipo) {
    return res.status(400).json({ error: 'Debe ingresar el número y tipo de habitación.' });
  }

  const numTrim = String(num).trim();
  try {
    const existing = await db.get('SELECT num FROM habitaciones WHERE num = ?', [numTrim]);
    if (existing) {
      return res.status(400).json({ error: `La habitación número ${numTrim} ya existe en el sistema.` });
    }

    await db.run(
      'INSERT INTO habitaciones (num, tipo, estado, huesped, acomp, ingreso, salida) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [numTrim, tipo, 'Libre', '', '', '', '']
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Agregar Habitación',
      `Habitación #${numTrim} (${tipo}) creada en estado Libre`,
      req.ip
    );

    res.json({ success: true, message: `Habitación #${numTrim} agregada exitosamente.` });
  } catch (error) {
    console.error('Error adding room:', error);
    res.status(500).json({ error: 'Error al agregar habitación.' });
  }
});

// DELETE /api/habitaciones/:num - Eliminar habitación si está en estado Libre
app.delete('/api/habitaciones/:num', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere permiso de configuración o Administrador.' });
  }

  const { num } = req.params;
  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [num]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada.' });
    }

    if (room.estado !== 'Libre') {
      return res.status(400).json({ 
        error: `No se puede eliminar la Habitación #${num} porque está en estado "${room.estado}". Debe estar en estado Libre.` 
      });
    }

    await db.run('DELETE FROM habitaciones WHERE num = ?', [num]);

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Eliminar Habitación',
      `Habitación #${num} eliminada del sistema`,
      req.ip
    );

    res.json({ success: true, message: `Habitación #${num} eliminada exitosamente.` });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Error al eliminar habitación.' });
  }
});

// PUT /api/habitaciones/:num - Modificar número o tipo de habitación (v5 - Fase 1)
app.put('/api/habitaciones/:num', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { num } = req.params;
  const { nuevoNum, tipo } = req.body;

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [num]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada.' });
    }

    const targetNum = nuevoNum ? String(nuevoNum).trim() : num;
    if (targetNum !== num) {
      const existing = await db.get('SELECT num FROM habitaciones WHERE num = ?', [targetNum]);
      if (existing) {
        return res.status(400).json({ error: `La habitación número ${targetNum} ya existe.` });
      }
    }

    await db.run('UPDATE habitaciones SET num = ?, tipo = ? WHERE num = ?', [targetNum, tipo || room.tipo, num]);
    
    // Auto sync inventario_habitaciones if number changed
    if (targetNum !== num) {
      await db.run('UPDATE inventario_habitaciones SET numHabitacion = ? WHERE numHabitacion = ?', [targetNum, num]);
    }

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Editar Habitación', `Habitación #${num} modificada a #${targetNum} (${tipo || room.tipo})`, req.ip);

    res.json({ success: true, message: `Habitación #${targetNum} actualizada correctamente.` });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Error al modificar la habitación.' });
  }
});

app.post('/api/habitaciones/:num/cambiar-modalidad', requireAuth, async (req, res) => {
  const { num } = req.params;
  const { montoDiferencia, metodo, codigoVerificacion, comprobante } = req.body;

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [num]);
    if (!room) {
      return res.status(404).json({ error: `La habitación ${num} no existe.` });
    }
    if (room.estado !== 'Ocupada') {
      return res.status(400).json({ error: `La habitación ${num} no está ocupada (Estado actual: ${room.estado}).` });
    }
    if (room.modalidad === 'pernocta') {
      return res.status(400).json({ error: `La habitación ${num} ya se encuentra en modalidad Pernocta.` });
    }

    // 1. Calculate check-out time for Pernocta (11:00 AM next day)
    const salidaCalculada = calcularHoraSalida('pernocta');

    // 2. Update room modality and checkout time
    await db.run(
      `UPDATE habitaciones 
       SET modalidad = 'pernocta', salida = ? 
       WHERE num = ?`,
      [salidaCalculada, num]
    );

    // 3. Register transaction in Cash register if amount > 0
    const finalMonto = parseFloat(montoDiferencia) || 0;
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      const metodoTexto = codigoVerificacion ? `${metodo} - Ref: ${codigoVerificacion}` : metodo;
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId, 
          'Ingreso', 
          `Hospedaje Cambio de Modalidad a Pernocta Hab ${num} (${room.huesped || 'Huésped'}) - ${comprobante || 'Sin Comprobante'}`, 
          finalMonto, 
          metodoTexto || 'Efectivo Bolívares', 
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    // 4. Log audit trail
    await registrarAuditoria(
      req.user.id, 
      req.user.nombre, 
      req.user.rol, 
      'Cambio Modalidad', 
      `Cambio de modalidad a Pernocta en Hab #${num} (${room.huesped || 'Huésped'}). Salida: ${salidaCalculada}. Diferencia pagada: $${finalMonto.toFixed(2)} USD`, 
      req.ip
    );

    res.json({ success: true, message: `Modalidad de habitación #${num} cambiada a Pernocta correctamente.` });
  } catch (error) {
    console.error('Error changing modality:', error);
    res.status(500).json({ error: 'Error al cambiar la modalidad de estadía.' });
  }
});

// Helper: Calcular hora de salida según modalidad (4 Horas + Horas Extra iniciales o Pernocta 11:00 AM)
function calcularHoraSalida(modalidad, horasExtraUpfront = 0) {
  const now = new Date();
  let future;
  if (modalidad === 'pernocta') {
    future = new Date(now);
    future.setDate(future.getDate() + 1);
    future.setHours(11, 0, 0, 0);
  } else {
    const extraHrs = parseInt(horasExtraUpfront) || 0;
    future = new Date(now.getTime() + (4 + extraHrs) * 60 * 60 * 1000);
  }
  
  const options = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(future);
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.day}/${map.month}/${map.year}, ${map.hour}:${map.minute}`;
}

function getDigitsOnly(str) {
  return (str || '').replace(/[^0-9]/g, '');
}

// 2. POST /api/checkin-directo - Process immediate walk-in check-in (v3 - Fase 1)
app.post('/api/checkin-directo', requireAuth, async (req, res) => {
  const { ci, dni, nombre, tel, numHabitacion, nomAcomp, ciAcomp, dniAcomp, monto, metodo, codigoVerificacion, comprobante, modalidad, esMenor, fechaNacimientoTitular, horasExtraIniciales } = req.body;
  const numDoc = (ci || dni || '').trim();

  if (!numDoc || !nombre || !tel || !numHabitacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (CI/Documento, Nombre, Teléfono, Habitación).' });
  }

  try {
    // 0. Verify room exists and is available
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [numHabitacion]);
    if (!room) {
      return res.status(404).json({ error: `La habitación ${numHabitacion} no existe.` });
    }
    if (room.estado !== 'Libre' && room.estado !== 'Reservada') {
      return res.status(400).json({ error: `La habitación ${numHabitacion} ya no está disponible (Estado actual: ${room.estado}).` });
    }

    // 1. Check if client exists (robust digit-based CI matching)
    const digitsDoc = getDigitsOnly(numDoc);
    const allClients = await db.all('SELECT * FROM clientes');
    let cliente = allClients.find(c => {
      if (c.ci === numDoc || c.dni === numDoc) return true;
      if (digitsDoc.length >= 4) {
        const cCiDigits = getDigitsOnly(c.ci);
        const cDniDigits = getDigitsOnly(c.dni);
        return cCiDigits === digitsDoc || cDniDigits === digitsDoc;
      }
      return false;
    });
    
    if (cliente && cliente.vetado === 1) {
      const debtMsg = (cliente.monto_deuda_usd && cliente.monto_deuda_usd > 0) 
        ? ` por una deuda pendiente de $${cliente.monto_deuda_usd.toFixed(2)} USD.` 
        : '.';
      return res.status(400).json({ 
        error: `El cliente ${cliente.nombre} (CI: ${cliente.ci || cliente.dni}) se encuentra VETADO${debtMsg} Motivo: ${cliente.motivo_veto || 'Incidencia o conducta en estadía anterior'}`,
        vetado: true,
        clienteVetado: cliente
      });
    }

    const birthdateToCheck = fechaNacimientoTitular || (cliente ? cliente.fechaNacimiento : null);
    if (birthdateToCheck && calcularEdadBackend(birthdateToCheck) < 18) {
      return res.status(400).json({ error: 'El titular de la reserva/hospedaje debe ser mayor de edad (+18 años).' });
    }

    const clientId = cliente ? cliente.id : 'c_' + Date.now();
    
    if (!cliente) {
      await db.run(
        'INSERT INTO clientes (id, nombre, dni, ci, tel, visitas, fechaNacimiento) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [clientId, nombre.trim(), numDoc, numDoc, tel.trim(), 1, fechaNacimientoTitular || '']
      );
    } else {
      await db.run(
        'UPDATE clientes SET visitas = visitas + 1, nombre = ?, tel = ?, ci = ?, fechaNacimiento = COALESCE(NULLIF(?, ""), fechaNacimiento) WHERE id = ?',
        [nombre.trim(), tel.trim(), numDoc, fechaNacimientoTitular || '', clientId]
      );
    }

    // 2. Calculate Checkout Time (4 Hours + extra hours vs Pernocta 11:00 AM)
    const salidaCalculada = calcularHoraSalida(modalidad, horasExtraIniciales);
    const formattedName = formatGuestName(nombre);
    let acompText = nomAcomp ? nomAcomp.trim() : '';
    const docAcomp = (ciAcomp || dniAcomp || '').trim();
    if (acompText && docAcomp) {
      const names = acompText.split(',').map(x => x.trim());
      const docs = docAcomp.split(',').map(x => x.trim());
      const formattedAcomps = [];
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const doc = docs[i] || '';
        if (name) {
          formattedAcomps.push(doc ? `${name} (CI: ${doc})` : name);
        }
      }
      acompText = formattedAcomps.join(', ');
    }
    if (esMenor) {
      acompText += ' (Menor de edad - Sin recargo)';
    }

    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', huesped = ?, acomp = ?, ingreso = ?, salida = ?, clienteId = ?, clienteCi = ?, modalidad = ? 
       WHERE num = ?`,
      [formattedName, acompText, getFechaHoraActual(), salidaCalculada, clientId, numDoc, modalidad || '4h', numHabitacion]
    );

    // Save check-in record to historial_estadias
    const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
    const tasaUsd = config ? parseFloat(config.valor) : 50.00;
    const estadiaId = 'est_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const finalMonto = parseFloat(monto) || 0;
    
    let usdAmount = 0;
    let vesAmount = 0;
    const cleanMetodo = (metodo || '').toLowerCase();
    if (cleanMetodo.includes('pago mixto')) {
      const usdMatch = cleanMetodo.match(/efectivo \(\$\):\s*\$(\d+(\.\d+)?)/);
      const zelleMatch = cleanMetodo.match(/zelle:\s*\$(\d+(\.\d+)?)/);
      const vesCashMatch = cleanMetodo.match(/efectivo \(bs\):\s*bs\.\s*(\d+(\.\d+)?)/);
      const pmMatch = cleanMetodo.match(/pago m[óo]vil:\s*bs\.\s*(\d+(\.\d+)?)/);
      const puntoMatch = cleanMetodo.match(/punto:\s*bs\.\s*(\d+(\.\d+)?)/);
      
      const valUsdCash = usdMatch ? parseFloat(usdMatch[1]) : 0;
      const valZelle = zelleMatch ? parseFloat(zelleMatch[1]) : 0;
      const valVesCash = vesCashMatch ? parseFloat(vesCashMatch[1]) : 0;
      const valPm = pmMatch ? parseFloat(pmMatch[1]) : 0;
      const valPunto = puntoMatch ? parseFloat(puntoMatch[1]) : 0;
      
      usdAmount = valUsdCash + valZelle;
      vesAmount = valVesCash + valPm + valPunto;
    } else {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => cleanMetodo.includes(m)) && !cleanMetodo.includes('($)');
      if (isVes) {
        vesAmount = finalMonto * tasaUsd;
      } else {
        usdAmount = finalMonto;
      }
    }

    const cantHuespedes = (nomAcomp ? nomAcomp.split(',').length : 0) + 1;

    await db.run(
      `INSERT INTO historial_estadias (
        id, numHabitacion, huesped, clienteCi, acomp, ingreso, 
        cantidad_huespedes, monto_usd, monto_ves, metodo_pago, referencia, 
        usuarioId, usuarioNombre, modalidad
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estadiaId,
        numHabitacion,
        formattedName,
        numDoc,
        acompText || '',
        getFechaHoraActual(),
        cantHuespedes,
        usdAmount,
        vesAmount,
        metodo || 'Efectivo',
        codigoVerificacion || '-',
        req.user.id,
        req.user.nombre,
        modalidad || '4h'
      ]
    );

    // 3. Register transaction in Cash register if amount > 0
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      const metodoTexto = codigoVerificacion ? `${metodo} - Ref: ${codigoVerificacion}` : metodo;
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId, 
          'Ingreso', 
          `Hospedaje Check-In Hab ${numHabitacion} (${nombre.trim()}) [${modalidad === 'pernocta' ? 'Pernocta' : '4 Horas'}] - ${comprobante || 'Sin Comprobante'}`, 
          finalMonto, 
          metodoTexto || 'Efectivo Bolívares', 
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    // 4. Handle Market items attached to Check-In (Venta Inmediata de Market en Check-In)
    const { marketItems } = req.body;
    if (marketItems && Array.isArray(marketItems) && marketItems.length > 0) {
      let totalMarketSale = 0;
      let conceptList = [];
      for (const mItem of marketItems) {
        const cant = parseInt(mItem.cantidad) || 1;
        const price = parseFloat(mItem.precio_venta) || 0;
        totalMarketSale += price * cant;
        conceptList.push(`${cant} Unid. - ${mItem.nombre}`);
        if (mItem.id) {
          await db.run('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', [cant, mItem.id]);
        }

        // Save items to consumos with state pagado_inmediato
        const cnsId = 'cns_chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        await db.run(
          'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha, cliente_ci, cliente_nombre, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            cnsId,
            numHabitacion,
            mItem.nombre,
            price,
            cant,
            getFechaHoraActual(),
            (ci || dni || '').trim(),
            (nombre || '').trim(),
            'pagado_inmediato'
          ]
        );
      }
      if (totalMarketSale > 0) {
        const mTransId = 't_mkt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        await db.run(
          'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            mTransId,
            'Ingreso',
            `Venta Market Check-In Hab ${numHabitacion} (${conceptList.join(', ')}) [Cliente: ${nombre.trim()}]`,
            totalMarketSale,
            metodo || 'Efectivo Bolívares',
            getFechaHoraActual(),
            req.user.id,
            req.user.nombre,
            'Market'
          ]
        );
      }
    }

    // Auto-link pre-consumos (Minimarket consumos en espera) para este cliente
    const targetCi = (dni || ci || '').trim();
    const targetNombre = (nombre || '').trim();
    if (targetCi || targetNombre) {
      await db.run(
        `UPDATE consumos 
         SET numHabitacion = ?, estado = 'cargado_habitacion' 
         WHERE (numHabitacion = 'EN_ESPERA' OR estado = 'pre_consumo') 
           AND (
             (cliente_ci != '' AND cliente_ci = ?) OR 
             (cliente_nombre != '' AND LOWER(cliente_nombre) = LOWER(?))
           )`,
        [numHabitacion, targetCi, targetNombre]
      );
    }

    res.json({ success: true, message: 'Check-in directo registrado correctamente.' });
  } catch (error) {
    console.error('Error processing walk-in check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habitaciones/:num/acompanante - Registrar acompañante posterior en habitación ocupada
app.post('/api/habitaciones/:num/acompanante', requireAuth, async (req, res) => {
  const { num } = req.params;
  const { nombre, ci, fechaNacimiento, foto_ci, monto, metodo, codigoVerificacion } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del acompañante es obligatorio.' });
  }

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [num]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada.' });
    }
    if (room.estado !== 'Ocupada') {
      return res.status(400).json({ error: 'Solo se pueden agregar acompañantes a habitaciones ocupadas.' });
    }

    const acompName = nombre.trim();
    const acompCi = ci ? ci.trim() : '';
    const newAcompString = acompCi ? `${acompName} (CI: ${acompCi})` : acompName;

    const updatedAcomp = room.acomp && room.acomp.trim() 
      ? `${room.acomp}, ${newAcompString}` 
      : newAcompString;

    await db.run('UPDATE habitaciones SET acomp = ? WHERE num = ?', [updatedAcomp, num]);

    const cantHuespedes = (updatedAcomp ? updatedAcomp.split(',').length : 0) + 1;
    await db.run(
      'UPDATE historial_estadias SET acomp = ?, cantidad_huespedes = ? WHERE numHabitacion = ? AND salida IS NULL',
      [updatedAcomp, cantHuespedes, num]
    );

    const finalMonto = parseFloat(monto) || 0;
    if (finalMonto > 0) {
      const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
      const tasaUsd = config ? parseFloat(config.valor) : 50.00;
      let usdAdd = 0;
      let vesAdd = 0;
      const cleanMetodo = (metodo || '').toLowerCase();
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => cleanMetodo.includes(m)) && !cleanMetodo.includes('($)');
      if (isVes) {
        vesAdd = finalMonto * tasaUsd;
      } else {
        usdAdd = finalMonto;
      }

      await db.run(
        `UPDATE historial_estadias 
         SET monto_usd = COALESCE(monto_usd, 0) + ?, 
             monto_ves = COALESCE(monto_ves, 0) + ?
         WHERE numHabitacion = ? AND salida IS NULL`,
        [usdAdd, vesAdd, num]
      );

      const transactionId = 't_' + Date.now();
      const metodoTexto = codigoVerificacion 
        ? `${metodo} (Ref: ${codigoVerificacion})` 
        : metodo;

      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Recargo 3er Huésped ($5 USD) Hab ${num} (${acompName})`,
          finalMonto,
          metodoTexto || 'Efectivo Bolívares',
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );

      await db.run(
        'INSERT INTO consumos (numHabitacion, concepto, monto, fecha) VALUES (?, ?, ?, ?)',
        [num, `Recargo Acompañante 3er Huésped (50%) - ${acompName}`, finalMonto, getFechaHoraActual()]
      );
    }

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Ingreso Acompañante',
      `Registrado acompañante posterior en Hab #${num}: ${newAcompString}${finalMonto > 0 ? ` con recargo del 50% ($${finalMonto.toFixed(2)} USD)` : ''}`,
      req.ip
    );

    res.json({ 
      success: true, 
      message: `Acompañante ${acompName} registrado con éxito en la Habitación #${num}.` 
    });
  } catch (error) {
    console.error('Error al agregar acompañante:', error);
    res.status(500).json({ error: 'Error al registrar acompañante.' });
  }
});

// POST /api/habitaciones/:num/extender-horas - Extender servicio / Agregar horas extra a habitación ocupada (v7)
app.post('/api/habitaciones/:num/extender-horas', requireAuth, async (req, res) => {
  const { num } = req.params;
  const { horasAdicionales, monto, metodo, codigoRef } = req.body;

  const numHrs = parseInt(horasAdicionales) || 0;

  if (numHrs <= 0) {
    return res.status(400).json({ error: 'La cantidad de horas adicionales debe ser mayor a 0.' });
  }

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [num]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada.' });
    }
    if (room.estado !== 'Ocupada') {
      return res.status(400).json({ error: 'Solo se pueden extender horas a habitaciones con ocupación activa (Ocupadas).' });
    }

    // BUG 1 FIX: Hora extra = Precio base * 0.5 * Cantidad horas
    // Se valida/calcula el monto en backend para mantener registro único de la habitación
    const tarifaRoom = await db.get('SELECT * FROM tarifas WHERE tipo = ?', [room.tipo]);
    const basePrecio = tarifaRoom
      ? (parseFloat(tarifaRoom.precio_pernocta_usd || tarifaRoom.precio_diario) || 20)
      : (room.tipo === 'Mini Suite' ? 24 : 20);
    const montoEsperado = basePrecio * 0.5 * numHrs;
    const montoUSD = (parseFloat(monto) || 0) > 0 ? (parseFloat(monto) || 0) : montoEsperado;

    // Calculate new departure date/time
    let currentSalidaDate = room.salida ? new Date(room.salida) : new Date();
    if (isNaN(currentSalidaDate.getTime())) {
      currentSalidaDate = new Date();
    }
    // Add extra hours
    const newSalidaDate = new Date(currentSalidaDate.getTime() + numHrs * 60 * 60 * 1000);
    const newSalidaIso = newSalidaDate.toISOString();

    // Update room departure time
    await db.run('UPDATE habitaciones SET salida = ? WHERE num = ?', [newSalidaIso, num]);

    // Register income transaction in caja if amount > 0
    if (montoUSD > 0) {
      const transId = 't_ext_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
      const cleanMetodoStr = codigoRef ? `${metodo} (Ref: ${codigoRef})` : metodo;
      
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transId,
          'Ingreso',
          `Extensión Estadía Hab ${num} (+${numHrs} hr${numHrs > 1 ? 's' : ''}) [Huésped: ${room.huesped || 'General'}]`,
          montoUSD,
          cleanMetodoStr || 'Efectivo ($)',
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Habitaciones',
      `Extensión de servicio en Hab #${num}: +${numHrs} hora(s) (Monto: $${montoUSD} USD, Método: ${metodo})`,
      req.ip
    );

    res.json({ 
      success: true, 
      message: `Extensión de ${numHrs} hora(s) registrada con éxito para la Habitación ${num}.`,
      nuevaSalida: newSalidaIso 
    });
  } catch (error) {
    console.error('Error extending room hours:', error);
    res.status(500).json({ error: 'Error al procesar la extensión de horas.' });
  }
});

// GET /api/turnos/resumen-activo - Obtener fecha de apertura de turno activo y transacciones del turno
app.get('/api/turnos/resumen-activo', requireAuth, async (req, res) => {
  try {
    // Get last shift delivery timestamp for this user (or global last shift delivery)
    const lastEntregaUser = await db.get(
      'SELECT fechaHoraEntrega FROM entrega_turnos WHERE usuarioSalienteId = ? ORDER BY fechaHoraEntrega DESC LIMIT 1',
      [req.user.id]
    );

    const lastEntregaGlobal = await db.get(
      'SELECT fechaHoraEntrega FROM entrega_turnos ORDER BY fechaHoraEntrega DESC LIMIT 1'
    );

    const inicioTurno = lastEntregaUser ? lastEntregaUser.fechaHoraEntrega : (lastEntregaGlobal ? lastEntregaGlobal.fechaHoraEntrega : null);

    let query = 'SELECT * FROM caja';
    let params = [];

    if (inicioTurno) {
      query += ' WHERE hora >= ?';
      params.push(inicioTurno);
    }

    const movimientos = await db.all(query, params);

    res.json({
      inicioTurno,
      movimientos
    });
  } catch (error) {
    console.error('Error fetching active shift summary:', error);
    res.status(500).json({ error: 'Error al obtener resumen del turno activo.' });
  }
});

// 3. POST /api/reservar - Bloquea una habitación y guarda la reserva (Fase 3)
app.post('/api/reservar', requireAuth, async (req, res) => {
  const { numHabitacion, ci, dni, nombre, tel, nomAcomp, ciAcomp, dniAcomp, hora, monto, metodo, comprobante, fechaNacimientoTitular, fechaIngreso, fechaSalida } = req.body;
  const numDoc = (ci || dni || '').trim();

  if (!numHabitacion || !numDoc || !nombre || !tel || !hora) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (CI/DNI, Nombre, Teléfono, Hora, Habitación).' });
  }

  try {
    // 1. Check/Create guest using CI/DNI (robust digit-based matching)
    const digitsDoc = getDigitsOnly(numDoc);
    const allClients = await db.all('SELECT * FROM clientes');
    let cliente = allClients.find(c => {
      if (c.ci === numDoc || c.dni === numDoc) return true;
      if (digitsDoc.length >= 4) {
        const cCiDigits = getDigitsOnly(c.ci);
        const cDniDigits = getDigitsOnly(c.dni);
        return cCiDigits === digitsDoc || cDniDigits === digitsDoc;
      }
      return false;
    });

    if (cliente && cliente.vetado === 1) {
      const debtMsg = (cliente.monto_deuda_usd && cliente.monto_deuda_usd > 0) 
        ? ` por una deuda pendiente de $${cliente.monto_deuda_usd.toFixed(2)} USD.` 
        : '.';
      return res.status(400).json({ 
        error: `El cliente ${cliente.nombre} (CI: ${cliente.ci || cliente.dni}) se encuentra VETADO${debtMsg} Motivo: ${cliente.motivo_veto || 'Incidencia o conducta en estadía anterior'}`,
        vetado: true,
        clienteVetado: cliente
      });
    }

    const birthdateToCheck = fechaNacimientoTitular || (cliente ? cliente.fechaNacimiento : null);
    if (birthdateToCheck && calcularEdadBackend(birthdateToCheck) < 18) {
      return res.status(400).json({ error: 'El titular de la reserva/hospedaje debe ser mayor de edad (+18 años).' });
    }

    const clientId = cliente ? cliente.id : 'c_' + Date.now();

    if (!cliente) {
      await db.run(
        'INSERT INTO clientes (id, nombre, dni, ci, tel, visitas) VALUES (?, ?, ?, ?, ?, ?)',
        [clientId, nombre.trim(), numDoc, numDoc, tel.trim(), 0]
      );
    } else {
      await db.run(
        'UPDATE clientes SET nombre = ?, tel = ?, ci = ? WHERE id = ?',
        [nombre.trim(), tel.trim(), numDoc, clientId]
      );
    }

    // 2. Set Room status to Reservada
    const formattedName = formatGuestName(nombre);
    await db.run(
      `UPDATE habitaciones SET estado = 'Reservada', huesped = ? WHERE num = ?`,
      [formattedName, numHabitacion]
    );

    // 3. Create reservation record
    const resId = 'r_' + Date.now();
    const resCode = 'RES-' + Math.floor(Math.random() * 9000 + 1000);

    let acompText = nomAcomp ? nomAcomp.trim() : '';
    const docAcomp = (ciAcomp || dniAcomp || '').trim();
    if (acompText && docAcomp) {
      const names = acompText.split(',').map(x => x.trim());
      const docs = docAcomp.split(',').map(x => x.trim());
      const formattedAcomps = [];
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const doc = docs[i] || '';
        if (name) {
          formattedAcomps.push(doc ? `${name} (CI: ${doc})` : name);
        }
      }
      acompText = formattedAcomps.join(', ');
    }

    await db.run(
      'INSERT INTO reservas (id, res, clienteId, nombreAcomp, numHabitacion, hora) VALUES (?, ?, ?, ?, ?, ?)',
      [resId, resCode, clientId, acompText, numHabitacion, hora]
    );

    // 4. Register deposit payment in Caja if amount > 0
    const finalMonto = parseFloat(monto) || 0;
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Adelanto Reserva Hab ${numHabitacion} (${nombre.trim()}) - ${comprobante || 'Sin Comprobante'}`,
          finalMonto,
          metodo || 'Efectivo Bolívares',
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    res.json({ success: true, message: `Habitación ${numHabitacion} reservada para ${nombre}` });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/checkin-reserva - Confirma el Check-In para una reserva activa (Fase 3)
app.post('/api/checkin-reserva', requireAuth, async (req, res) => {
  const { numHabitacion } = req.body;

  if (!numHabitacion) {
    return res.status(400).json({ error: 'Falta número de habitación' });
  }

  try {
    // Find active reservation
    const reserva = await db.get('SELECT * FROM reservas WHERE numHabitacion = ?', [numHabitacion]);
    if (!reserva) {
      return res.status(404).json({ error: 'No se encontró reserva para esta habitación' });
    }

    // Fetch guest details
    const cliente = await db.get('SELECT nombre, ci, dni FROM clientes WHERE id = ?', [reserva.clienteId]);
    const clientCi = cliente ? (cliente.ci || cliente.dni) : '';
    const clientNombre = cliente ? cliente.nombre : 'Huésped';

    // Increment guest visits
    await db.run('UPDATE clientes SET visitas = visitas + 1 WHERE id = ?', [reserva.clienteId]);

    const formattedName = formatGuestName(clientNombre);
    const acompText = reserva.nombreAcomp || '';

    // Update room status to Ocupada and set huesped
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', huesped = ?, acomp = ?, ingreso = ?, salida = ?, clienteId = ?, clienteCi = ?, modalidad = 'pernocta' 
       WHERE num = ?`,
      [formattedName, acompText, getFechaHoraActual(), calcularHoraSalida('pernocta'), reserva.clienteId, clientCi, numHabitacion]
    );

    // Save stay record to historial_estadias
    const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
    const tasaUsd = config ? parseFloat(config.valor) : 50.00;
    const estadiaId = 'est_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const resTx = await db.get(
      "SELECT * FROM caja WHERE (concepto LIKE ? OR concepto LIKE ?) ORDER BY hora DESC LIMIT 1",
      [`%Reserva%Hab ${numHabitacion}%`, `%Reserva%Hab.${numHabitacion}%`]
    );

    let usdAmount = 0;
    let vesAmount = 0;
    let metodoPago = 'Reserva';
    let referencia = '-';

    if (resTx) {
      metodoPago = resTx.metodo || 'Reserva';
      const cleanMetodo = metodoPago.toLowerCase();
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => cleanMetodo.includes(m)) && !cleanMetodo.includes('($)');
      if (isVes) {
        vesAmount = resTx.monto_ves || (resTx.monto * tasaUsd);
      } else {
        usdAmount = resTx.monto;
      }
      
      const refMatch = metodoPago.match(/Ref:\s*(\S+)/i);
      if (refMatch) {
        referencia = refMatch[1];
      }
    }

    const cantHuespedes = (acompText ? acompText.split(',').length : 0) + 1;

    await db.run(
      `INSERT INTO historial_estadias (
        id, numHabitacion, huesped, clienteCi, acomp, ingreso, 
        cantidad_huespedes, monto_usd, monto_ves, metodo_pago, referencia, 
        usuarioId, usuarioNombre, modalidad
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estadiaId,
        numHabitacion,
        formattedName,
        clientCi,
        acompText,
        getFechaHoraActual(),
        cantHuespedes,
        usdAmount,
        vesAmount,
        metodoPago,
        referencia,
        req.user.id,
        req.user.nombre,
        'pernocta'
      ]
    );

    // Delete reservation
    await db.run('DELETE FROM reservas WHERE id = ?', [reserva.id]);

    res.json({ success: true, message: 'Check-In de reserva procesado correctamente.' });
  } catch (error) {
    console.error('Error confirming reservation check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/checkout - Process guest check-out and send room to cleaning (v3 - Fase 4)
app.post('/api/checkout', requireAuth, async (req, res) => {
  const { 
    numHabitacion, 
    penalidad, 
    metodoPago, 
    montoHabitacion, 
    montoConsumos, 
    montoHorasExtras,
    detallePenalidad,
    vetarCliente,
    clienteId,
    clienteCi,
    montoDeuda,
    motivoVeto,
    noPertenece
  } = req.body;

  if (!numHabitacion) {
    return res.status(400).json({ error: 'Falta número de habitación' });
  }

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [numHabitacion]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    const huespedNombre = room.huesped || 'Huésped';
    const metodo = metodoPago || 'Efectivo Bolívares';

    // Update stay history record for checkout
    const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
    const tasaUsd = config ? parseFloat(config.valor) : 50.00;

    const checkoutStayTotal = (parseFloat(montoHabitacion) || 0) + (parseFloat(montoHorasExtras) || 0) + (parseFloat(penalidad) || 0);

    let usdCheckout = 0;
    let vesCheckout = 0;

    const cleanMetodo = metodo.toLowerCase();
    if (cleanMetodo.includes('pago mixto')) {
      const usdMatch = cleanMetodo.match(/efectivo \(\$\):\s*\$(\d+(\.\d+)?)/);
      const zelleMatch = cleanMetodo.match(/zelle:\s*\$(\d+(\.\d+)?)/);
      const vesCashMatch = cleanMetodo.match(/efectivo \(bs\):\s*bs\.\s*(\d+(\.\d+)?)/);
      const pmMatch = cleanMetodo.match(/pago m[óo]vil:\s*bs\.\s*(\d+(\.\d+)?)/);
      const puntoMatch = cleanMetodo.match(/punto:\s*bs\.\s*(\d+(\.\d+)?)/);
      
      const valUsdCash = usdMatch ? parseFloat(usdMatch[1]) : 0;
      const valZelle = zelleMatch ? parseFloat(zelleMatch[1]) : 0;
      const valVesCash = vesCashMatch ? parseFloat(vesCashMatch[1]) : 0;
      const valPm = pmMatch ? parseFloat(pmMatch[1]) : 0;
      const valPunto = puntoMatch ? parseFloat(puntoMatch[1]) : 0;

      usdCheckout = valUsdCash + valZelle;
      vesCheckout = valVesCash + valPm + valPunto;
    } else {
      const isVes = ['efectivo (bs)', 'pago móvil', 'pago movil', 'punto de venta'].some(m => cleanMetodo.includes(m)) && !cleanMetodo.includes('($)');
      if (isVes) {
        vesCheckout = checkoutStayTotal * tasaUsd;
      } else {
        usdCheckout = checkoutStayTotal;
      }
    }

    // Calculate extra hours count
    const roomTarifa = await db.get('SELECT precio_hora_extra_usd FROM tarifas WHERE tipo = ?', [room.tipo]);
    const hourlyRate = roomTarifa && roomTarifa.precio_hora_extra_usd ? parseFloat(roomTarifa.precio_hora_extra_usd) : 5.00;
    const hoursExtraCount = hourlyRate > 0 ? Math.round(parseFloat(montoHorasExtras || 0) / hourlyRate) : 0;

    // Find if the room has an active stay in history
    const activeStay = await db.get('SELECT * FROM historial_estadias WHERE numHabitacion = ? AND salida IS NULL', [numHabitacion]);
    if (activeStay) {
      await db.run(
        `UPDATE historial_estadias 
         SET salida = ?, 
             monto_usd = COALESCE(monto_usd, 0) + ?, 
             monto_ves = COALESCE(monto_ves, 0) + ?, 
             horas_extra = COALESCE(horas_extra, 0) + ?
         WHERE id = ?`,
        [
          getFechaHoraActual(),
          usdCheckout,
          vesCheckout,
          hoursExtraCount,
          activeStay.id
        ]
      );
    } else {
      const estadiaId = 'est_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const cantHuespedes = (room.acomp ? room.acomp.split(',').length : 0) + 1;
      await db.run(
        `INSERT INTO historial_estadias (
          id, numHabitacion, huesped, clienteCi, acomp, ingreso, salida,
          cantidad_huespedes, monto_usd, monto_ves, metodo_pago, referencia, 
          usuarioId, usuarioNombre, modalidad, horas_extra
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          estadiaId,
          numHabitacion,
          huespedNombre,
          room.clienteCi || '-',
          room.acomp || '',
          room.ingreso || getFechaHoraActual(),
          getFechaHoraActual(),
          cantHuespedes,
          usdCheckout,
          vesCheckout,
          metodo,
          '-',
          req.user.id,
          req.user.nombre,
          room.modalidad || '4h',
          hoursExtraCount
        ]
      );
    }

    // 1. Update room status to Limpieza and clear active guest details
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Limpieza', huesped = '', acomp = '', ingreso = '', salida = '', clienteId = '', clienteCi = '' 
       WHERE num = ?`,
      [numHabitacion]
    );

    // 1b. Guardar artículos que NO pertenecen a la habitación en el inventario (Requerimiento 3)
    if (noPertenece && Array.isArray(noPertenece) && noPertenece.length > 0) {
      const eq = await db.get('SELECT * FROM inventario_habitaciones WHERE numHabitacion = ?', [numHabitacion]);
      const prevNoPertenece = eq?.no_pertenece || '';
      const nuevosItems = noPertenece.map(k => {
        const labels = {
          tv: 'TV', nevera: 'Nevera', frigobar: 'Frigobar',
          microondas: 'Microondas', caja_fuerte: 'Caja Fuerte', control_tv: 'Control TV',
          control_aire: 'Control Aire', control_musica: 'Control Música',
          aire_acondicionado: 'Aire Acondicionado', espejo: 'Espejo', llave: 'Llave',
          poceta: 'Poceta', lavamanos: 'Lavamanos', ducha: 'Ducha'
        };
        return labels[k] || k;
      }).join(', ');

      const updatedNoPertenece = prevNoPertenece
        ? `${prevNoPertenece}; ${nuevosItems}`
        : nuevosItems;

      await db.run(
        `INSERT INTO inventario_habitaciones (numHabitacion, no_pertenece)
         VALUES (?, ?)
         ON CONFLICT(numHabitacion) DO UPDATE SET no_pertenece = excluded.no_pertenece`,
        [numHabitacion, updatedNoPertenece]
      );

      // Registrar en historial de equipamiento
      const histId = 'eqh_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      await db.run(
        `INSERT INTO inventario_habitaciones_historial (id, numHabitacion, usuarioId, usuarioNombre, fecha, accion, detalle, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          histId,
          numHabitacion,
          req.user.id,
          req.user.nombre,
          getFechaHoraActual(),
          'Check-Out: Artículos No Pertenecientes',
          `Artículos marcados como no pertenecientes a la habitación: ${nuevosItems}`,
          (detallePenalidad || '').trim()
        ]
      );

      await registrarAuditoria(
        req.user.id,
        req.user.nombre,
        req.user.rol,
        'Check-Out Equipamiento',
        `Hab. ${numHabitacion}: Artículos NO pertenecientes marcados: ${nuevosItems}`,
        req.ip
      );
    }

    // 2. Process Veto if requested
    if (vetarCliente) {
      const debtAmount = parseFloat(montoDeuda) || parseFloat(penalidad) || 0;
      const vetoReason = motivoVeto || detallePenalidad || 'Incidencia no saldada en Check-Out';
      
      let targetClient = null;
      const searchId = clienteId || room.clienteId;
      const searchCi = (clienteCi || room.clienteCi || '').replace(/[^a-zA-Z0-9]/g, '');

      if (searchId) {
        targetClient = await db.get('SELECT * FROM clientes WHERE id = ?', [searchId]);
      }
      if (!targetClient && searchCi) {
        targetClient = await db.get('SELECT * FROM clientes WHERE REPLACE(REPLACE(ci, "V-", ""), "-", "") = ? OR REPLACE(REPLACE(dni, "V-", ""), "-", "") = ?', [searchCi, searchCi]);
      }
      if (!targetClient && huespedNombre) {
        const cleanName = huespedNombre.replace(/[^a-zA-Z ]/g, '').trim();
        targetClient = await db.get('SELECT * FROM clientes WHERE nombre LIKE ? OR nombre LIKE ?', [`%${cleanName}%`, `%${huespedNombre}%`]);
      }

      if (targetClient) {
        await db.run(
          'UPDATE clientes SET vetado = 1, monto_deuda_usd = ?, motivo_veto = ? WHERE id = ?',
          [debtAmount, vetoReason, targetClient.id]
        );
        await registrarAuditoria(
          req.user.id,
          req.user.nombre,
          req.user.rol,
          'Cliente Vetado',
          `Cliente ${targetClient.nombre} (CI: ${targetClient.ci || targetClient.dni}) fue VETADO por deuda de $${debtAmount} USD en Hab. ${numHabitacion}. Motivo: ${vetoReason}`,
          req.ip
        );
      }
    } else {
      // Register penalty in Caja if penalty paid > 0
      const finalPenalidad = parseFloat(penalidad) || 0;
      if (finalPenalidad > 0) {
        const transactionId = 't_pen_' + Date.now();
        await db.run(
          'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            transactionId,
            'Ingreso',
            `Penalidad Check-Out Hab ${numHabitacion} - ${detallePenalidad || 'Incumplimiento de checklist'}`,
            finalPenalidad,
            metodo,
            getFechaHoraActual(),
            req.user.id,
            req.user.nombre,
            'Hospedaje'
          ]
        );
      }
    }

    // 3. Register room balance payment in Caja if > 0
    const finalHab = parseFloat(montoHabitacion) || 0;
    if (finalHab > 0) {
      const transactionId = 't_hab_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Saldo Pendiente Hab ${numHabitacion} (${huespedNombre})`,
          finalHab,
          metodo,
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    // 3b. Register extra hours payment in Caja if > 0
    const finalHorasExtras = parseFloat(montoHorasExtras) || 0;
    if (finalHorasExtras > 0) {
      const transactionId = 't_hextra_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Horas Extras Hab ${numHabitacion} (${huespedNombre})`,
          finalHorasExtras,
          metodo,
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    // 4. Register consumption consolidated payment in Caja if > 0
    const finalConsumos = parseFloat(montoConsumos) || 0;
    if (finalConsumos > 0) {
      const roomConsumos = await db.all('SELECT concepto, cantidad FROM consumos WHERE numHabitacion = ?', [numHabitacion]);
      const consumosDetails = roomConsumos.length > 0
        ? roomConsumos.map(c => `${c.concepto} x${c.cantidad}`).join(', ')
        : 'Consumos Varios';
      const transactionId = 't_cns_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Consumos Extras Hab ${numHabitacion} (${consumosDetails}) [${huespedNombre}]`,
          finalConsumos,
          metodo,
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Market'
        ]
      );
    }

    // 5. Delete all consumptions of the room
    await db.run('DELETE FROM consumos WHERE numHabitacion = ?', [numHabitacion]);

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Check-Out Realizado', `Check-Out Hab. ${numHabitacion} (${huespedNombre})`, req.ip);

    res.json({ success: true, message: 'Check-Out finalizado correctamente. Habitación enviada a limpieza.' });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clientes/:id/pagar-deuda - Cobrar deuda pendiente y levantar veto (v3 - Fase 4)
app.post('/api/clientes/:id/pagar-deuda', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { monto, metodo } = req.body;
  try {
    const client = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    const montoCobrado = parseFloat(monto) || client.monto_deuda_usd || 0;
    
    if (montoCobrado > 0) {
      const transactionId = 't_deuda_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Deuda Pendiente Veto - Cliente: ${client.nombre} (CI: ${client.ci || client.dni})`,
          montoCobrado,
          metodo || 'Efectivo Bolívares',
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
      );
    }

    await db.run(
      'UPDATE clientes SET vetado = 0, monto_deuda_usd = 0, motivo_veto = "" WHERE id = ?',
      [id]
    );

    await registrarAuditoria(
      req.user.id, 
      req.user.nombre, 
      req.user.rol, 
      'Deuda Veto Liquidada', 
      `Deuda de $${montoCobrado} USD cobrada a ${client.nombre} (CI: ${client.ci || client.dni}). Veto levantado.`, 
      req.ip
    );

    res.json({ success: true, message: 'Deuda cobrada con éxito. Veto levantado.' });
  } catch (error) {
    console.error('Error pagando deuda:', error);
    res.status(500).json({ error: 'Error al procesar pago de deuda.' });
  }
});

// PUT /api/clientes/:id/foto-ci - Actualizar foto de Cédula de Identidad (v3 - Fase 4)
app.put('/api/clientes/:id/foto-ci', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { foto_ci } = req.body;
  try {
    const client = await db.get('SELECT id, nombre FROM clientes WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    await db.run('UPDATE clientes SET foto_ci = ? WHERE id = ?', [foto_ci || '', id]);
    
    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Foto CI Actualizada', `Foto de CI actualizada para cliente ${client.nombre}`, req.ip);

    res.json({ success: true, message: 'Foto de Cédula de Identidad actualizada correctamente.' });
  } catch (error) {
    console.error('Error updating foto_ci:', error);
    res.status(500).json({ error: 'Error al actualizar foto de Cédula.' });
  }
});

// PUT /api/clientes/:id/veto - Actualizar estado de veto manualmente (v3 - Fase 4)
app.put('/api/clientes/:id/veto', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { vetado, monto_deuda_usd, motivo_veto } = req.body;
  try {
    const client = await db.get('SELECT id, nombre, ci, dni FROM clientes WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    const isVetado = vetado ? 1 : 0;
    const debt = parseFloat(monto_deuda_usd) || 0;
    await db.run(
      'UPDATE clientes SET vetado = ?, monto_deuda_usd = ?, motivo_veto = ? WHERE id = ?',
      [isVetado, debt, motivo_veto || '', id]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      isVetado ? 'Cliente Vetado Manualmente' : 'Veto de Cliente Cancelado',
      `Cliente ${client.nombre} (CI: ${client.ci || client.dni}) ${isVetado ? `vetado por $${debt} USD` : 'veto retirado'}`,
      req.ip
    );

    res.json({ success: true, message: `Estado de veto actualizado para ${client.nombre}.` });
  } catch (error) {
    console.error('Error updating veto:', error);
    res.status(500).json({ error: 'Error al actualizar estado de veto.' });
  }
});

// 6. POST /api/caja - Registro manual de movimientos de caja (Fase 4)
app.post('/api/caja', requireAuth, async (req, res) => {
  const { tipo, concepto, monto, metodo, origen } = req.body;

  if (!tipo || !concepto || !monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos de la transacción' });
  }

  try {
    const transactionId = 't_' + Date.now();
    await db.run(
      'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [transactionId, tipo, concepto.trim(), parseFloat(monto), metodo, getFechaHoraActual(), req.user.id, req.user.nombre, origen || (tipo === 'Egreso' ? 'Egresos' : 'Hospedaje')]
    );

    res.json({ success: true, message: 'Movimiento de caja registrado' });
  } catch (error) {
    console.error('Error logging manual transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/caja/:id/validar - Toggle/Validar pago digital por Administrador/Supervisor (v4 - Fase 1)
app.put('/api/caja/:id/validar', requireAuth, async (req, res) => {
  const { id } = req.params;
  const clientIp = req.ip || req.socket.remoteAddress || '';

  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Supervisor') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador o Supervisor para validar pagos.' });
  }

  try {
    const txn = await db.get('SELECT * FROM caja WHERE id = ?', [id]);
    if (!txn) {
      return res.status(404).json({ error: 'Transacción de caja no encontrada.' });
    }

    const nuevoEstado = txn.validado === 1 ? 0 : 1;
    const fechaValidacion = nuevoEstado === 1 ? new Date().toISOString() : '';
    const validadorNombre = nuevoEstado === 1 ? req.user.nombre : '';

    await db.run(
      'UPDATE caja SET validado = ?, fecha_validacion = ?, usuario_validador_nombre = ? WHERE id = ?',
      [nuevoEstado, fechaValidacion, validadorNombre, id]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      nuevoEstado === 1 ? 'Validar Pago Digital' : 'Desmarcar Validación Pago',
      `Transacción #${id} (${txn.metodo} - $${txn.monto}) ${nuevoEstado === 1 ? 'validada tras revisión bancaria' : 'marcada como pendiente'}`,
      clientIp
    );

    res.json({ 
      success: true, 
      validado: nuevoEstado, 
      message: nuevoEstado === 1 ? 'Pago digital validado exitosamente.' : 'Validación del pago removida.' 
    });
  } catch (error) {
    console.error('Error al validar pago:', error);
    res.status(500).json({ error: 'Error al procesar la validación del pago.' });
  }
});

// PUT /api/caja/:id/metodo - Editar método de pago de una transacción en Caja (Exclusivo Super Admin / Admin)
app.put('/api/caja/:id/metodo', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nuevoMetodo } = req.body;

  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Super Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Super Admin o Administrador para editar el método de pago.' });
  }

  if (!nuevoMetodo || !nuevoMetodo.trim()) {
    return res.status(400).json({ error: 'Debe especificar el nuevo método de pago.' });
  }

  try {
    const txn = await db.get('SELECT * FROM caja WHERE id = ?', [id]);
    if (!txn) {
      return res.status(404).json({ error: 'Movimiento de caja no encontrado.' });
    }

    const metodoAnterior = txn.metodo;
    const metodoActualizado = nuevoMetodo.trim();

    await db.run('UPDATE caja SET metodo = ? WHERE id = ?', [metodoActualizado, id]);

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Edición Método de Pago (Caja)',
      `Transacción #${id} (${txn.concepto}): Método cambiado de "${metodoAnterior}" a "${metodoActualizado}"`,
      req.ip
    );

    res.json({
      success: true,
      message: `Método de pago actualizado correctamente a "${metodoActualizado}".`
    });
  } catch (error) {
    console.error('Error al editar método de pago en caja:', error);
    res.status(500).json({ error: 'Error al actualizar el método de pago.' });
  }
});

// DELETE /api/caja/transaccion/:id - Eliminar transacción de caja y revertir inventario/consumos (v6 - Fase 3)
app.delete('/api/caja/transaccion/:id', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Super Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador.' });
  }

  const { id } = req.params;

  try {
    const t = await db.get('SELECT * FROM caja WHERE id = ?', [id]);
    if (!t) {
      return res.status(404).json({ error: 'Transacción no encontrada en caja.' });
    }

    // 1. Revert inventory if it's a shop/minimarket sale
    const isMarket = t.origen === 'Market' || t.concepto.toLowerCase().includes('venta tienda') || t.concepto.toLowerCase().includes('venta market');
    
    if (isMarket) {
      const match = t.concepto.match(/(?:Venta Tienda #VTA-\d+|Venta Market Check-In Hab \d+|Venta Tienda Hab \d+ #VTA-\d+)\s*\(([^)]+)\)/i);
      if (match && match[1]) {
        const itemsStr = match[1];
        const parts = itemsStr.split(',');
        for (const part of parts) {
          const itemMatch = part.trim().match(/^(\d+)x\s+(.+)$/);
          if (itemMatch) {
            const qty = parseInt(itemMatch[1], 10);
            const prodName = itemMatch[2].trim();
            // Restore inventory stock
            await db.run('UPDATE productos SET stock = stock + ? WHERE LOWER(nombre) = LOWER(?)', [qty, prodName]);
            
            // Delete associated room consumptions
            const roomMatch = t.concepto.match(/Hab\s+(\d+)/i);
            if (roomMatch) {
              const roomNum = roomMatch[1];
              await db.run(
                'DELETE FROM consumos WHERE numHabitacion = ? AND fecha = ? AND LOWER(concepto) = LOWER(?)',
                [roomNum, t.hora, prodName]
              );
            }
          }
        }
      }
    }

    // 2. Delete transaction from caja
    await db.run('DELETE FROM caja WHERE id = ?', [id]);

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Eliminación Transacción',
      `Transacción #${id} eliminada de caja. Concepto: ${t.concepto}. Monto: $${t.monto} USD.`,
      req.ip
    );

    res.json({ success: true, message: 'Transacción eliminada y stock revertido correctamente.' });
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    res.status(500).json({ error: 'Error al eliminar la transacción.' });
  }
});

// POST /api/caja/cierre-turno - Registrar el resumen del Cierre de Turno por Usuario (v2 - Fase 5)
app.post('/api/caja/cierre-turno', requireAuth, async (req, res) => {
  const { totalEfectivo, totalTarjeta, totalOtros, totalEgresos, saldoNeto } = req.body;
  try {
    const transactionId = 't_cierre_' + Date.now();
    const concepto = `CIERRE DE TURNO (${req.user.nombre}) - Efectivo: S/${parseFloat(totalEfectivo || 0).toFixed(2)}, Tarjeta: S/${parseFloat(totalTarjeta || 0).toFixed(2)}, Egresos: S/${parseFloat(totalEgresos || 0).toFixed(2)}`;
    
    await db.run(
      'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        transactionId,
        'Cierre',
        concepto,
        parseFloat(saldoNeto || 0),
        'Cierre Turno',
        getFechaHoraActual(),
        req.user.id,
        req.user.nombre,
        'Cierre'
      ]
    );

    res.json({ success: true, message: 'Cierre de turno registrado en la caja correctamente.' });
  } catch (error) {
    console.error('Error registrando cierre de turno:', error);
    res.status(500).json({ error: 'Error al registrar el cierre de turno.' });
  }
});

// GET /api/entrega-turnos - Historial de entrega de turnos (v4 - Fase 2)
app.get('/api/entrega-turnos', requireAuth, async (req, res) => {
  try {
    let list = await db.all('SELECT * FROM entrega_turnos ORDER BY fechaHoraEntrega DESC');
    
    // Filter history for non-admin users
    const isAdmin = req.user.rol === 'Administrador' || req.user.rol === 'Super Admin' || req.user.rol === 'Superadmin';
    if (!isAdmin) {
      list = list.filter((t, idx) => {
        // Always allow the most recent shift (first in list) so they can confirm it
        if (idx === 0) return true;
        // Allow shifts where they are the outgoing or incoming receptionist
        return t.usuarioSalienteId === req.user.id || t.usuarioEntranteId === req.user.id;
      });
    }

    res.json(list);
  } catch (error) {
    console.error('Error fetching entrega_turnos:', error);
    res.status(500).json({ error: 'Error al consultar entregas de turno.' });
  }
});

// GET /api/historial-estadias - Historial completo de estadias (walk-ins y check-ins)
app.get('/api/historial-estadias', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM historial_estadias ORDER BY ingreso DESC');
    res.json(list);
  } catch (error) {
    console.error('Error fetching historial_estadias:', error);
    res.status(500).json({ error: 'Error al consultar historial de estadías.' });
  }
});

// Helper: Parse SQLite date DD/MM/YYYY, HH:MM or ISO string to JS Date
function parseDBDate(horaStr) {
  if (!horaStr) return new Date(0);
  try {
    if (!horaStr.includes('/')) {
      return new Date(horaStr);
    }
    const parts = horaStr.split(',');
    const dateParts = parts[0].trim().split('/').map(Number);
    const timeParts = (parts[1] || '00:00').trim().split(':').map(Number);
    const d = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0] || 0, timeParts[1] || 0);
    return isNaN(d.getTime()) ? new Date(horaStr) : d;
  } catch (e) {
    return new Date(horaStr);
  }
}

// Helper: Parse normal and mixed payments in a caja transaction to get USD and VES breakdown
function getPaymentBreakdown(t, tasaUsd) {
  const montoUsd = parseFloat(t.monto) || 0;
  const breakdown = {
    usdCash: 0,
    zelle: 0,
    vesCash: 0,
    pagoMovil: 0,
    punto: 0
  };

  if (!t.metodo) return breakdown;

  const cleanMetodo = t.metodo.toLowerCase();
  
  if (!cleanMetodo.includes('pago mixto')) {
    // Single payment method
    if (cleanMetodo.includes('efectivo ($)') || cleanMetodo === 'efectivo' || cleanMetodo === 'dólares' || cleanMetodo === 'dolares') {
      breakdown.usdCash = montoUsd;
    } else if (cleanMetodo.includes('zelle')) {
      breakdown.zelle = montoUsd;
    } else if (cleanMetodo.includes('efectivo (bs)') || cleanMetodo === 'efectivo bolívares' || cleanMetodo === 'efectivo bolivares') {
      breakdown.vesCash = montoUsd * tasaUsd;
    } else if (cleanMetodo.includes('pago móvil') || cleanMetodo.includes('pago movil') || cleanMetodo.includes('móvil') || cleanMetodo.includes('movil')) {
      breakdown.pagoMovil = montoUsd * tasaUsd;
    } else if (cleanMetodo.includes('punto')) {
      breakdown.punto = montoUsd * tasaUsd;
    } else {
      breakdown.usdCash = montoUsd;
    }
    return breakdown;
  }

  // Mixed payment parsing
  const usdCashMatch = t.metodo.match(/Efectivo\s*\(\$\):\s*\$?([\d.]+)/i);
  if (usdCashMatch) breakdown.usdCash = parseFloat(usdCashMatch[1]) || 0;

  const zelleMatch = t.metodo.match(/Zelle:\s*\$?([\d.]+)/i);
  if (zelleMatch) breakdown.zelle = parseFloat(zelleMatch[1]) || 0;

  const vesCashMatch = t.metodo.match(/Efectivo\s*\(Bs\):\s*Bs\.\s*([\d.]+)/i);
  if (vesCashMatch) {
    breakdown.vesCash = parseFloat(vesCashMatch[1]) || 0;
  } else {
    const fb = t.metodo.match(/Efectivo\s*\(Bs\):\s*([\d.]+)/i);
    if (fb) breakdown.vesCash = parseFloat(fb[1]) || 0;
  }

  const pagoMovilMatch = t.metodo.match(/Pago\s*Móvil:\s*Bs\.\s*([\d.]+)/i);
  if (pagoMovilMatch) {
    breakdown.pagoMovil = parseFloat(pagoMovilMatch[1]) || 0;
  } else {
    const fb = t.metodo.match(/Pago\s*Móvil:\s*([\d.]+)/i);
    if (fb) breakdown.pagoMovil = parseFloat(fb[1]) || 0;
  }

  const puntoMatch = t.metodo.match(/Punto:\s*Bs\.\s*([\d.]+)/i);
  if (puntoMatch) {
    breakdown.punto = parseFloat(puntoMatch[1]) || 0;
  } else {
    const fb = t.metodo.match(/Punto:\s*([\d.]+)/i);
    if (fb) breakdown.punto = parseFloat(fb[1]) || 0;
  }

  return breakdown;
}

// GET /api/reportes/cierre-diario - Generar reporte consolidado de un día
app.get('/api/reportes/cierre-diario', requireAuth, async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ error: 'Debe especificar una fecha (YYYY-MM-DD)' });
  }

  try {
    const [y, m, d] = fecha.split('-').map(Number);
    const startRange = new Date(y, m - 1, d, 8, 0, 0);
    const endRange = new Date(y, m - 1, d + 1, 7, 59, 59);

    const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
    const tasaUsd = config ? parseFloat(config.valor) : 50.00;

    // Fetch all caja transactions
    const caja = await db.all("SELECT * FROM caja");
    const dailyTx = caja.filter(t => {
      const tDate = parseDBDate(t.hora);
      return tDate >= startRange && tDate <= endRange;
    });

    // Calculate theoretical revenues split by USD and VES
    let ventasHabitacionesUsd = 0;
    let ventasHabitacionesVes = 0;
    let ingresoAcompananteUsd = 0;
    let ingresoAcompananteVes = 0;
    let ventasMinibarUsd = 0;
    let ventasMinibarVes = 0;
    let danosOtrosUsd = 0;
    let danosOtrosVes = 0;

    dailyTx.forEach(t => {
      if (t.tipo === 'Ingreso') {
        const bd = getPaymentBreakdown(t, tasaUsd);
        const u = bd.usdCash + bd.zelle;
        const v = bd.vesCash + bd.pagoMovil + bd.punto;

        const conceptLower = (t.concepto || '').toLowerCase();
        const isMarket = t.origen === 'Market' || conceptLower.includes('market') || conceptLower.includes('tienda');
        const isAcomp = conceptLower.includes('3er huésped') || conceptLower.includes('acompañante');
        const isDanos = conceptLower.includes('penalidad check-out') || conceptLower.includes('incumplimiento de checklist') || conceptLower.includes('reposición de') || conceptLower.includes('daño');

        if (isMarket) {
          ventasMinibarUsd += u;
          ventasMinibarVes += v;
        } else if (isAcomp) {
          ingresoAcompananteUsd += u;
          ingresoAcompananteVes += v;
        } else if (isDanos) {
          danosOtrosUsd += u;
          danosOtrosVes += v;
        } else {
          ventasHabitacionesUsd += u;
          ventasHabitacionesVes += v;
        }
      }
    });

    // Fetch declared shifts balances
    const turnos = await db.all("SELECT * FROM entrega_turnos");
    const dailyTurnos = turnos.filter(t => {
      const tDate = parseDBDate(t.fechaHoraEntrega);
      return tDate >= startRange && tDate <= endRange;
    });

    // Physical cash is non-cumulative (from the last shift of the day)
    dailyTurnos.sort((a, b) => parseDBDate(a.fechaHoraEntrega) - parseDBDate(b.fechaHoraEntrega));
    const lastShift = dailyTurnos[dailyTurnos.length - 1];

    const declaredUsdCash = lastShift ? (parseFloat(lastShift.saldoEfectivoUsd) || 0) : 0;
    const declaredVesCash = lastShift ? (parseFloat(lastShift.saldoEfectivoVes) || 0) : 0;

    // Digital payments are cumulative across all shifts of the day
    const declaredPagoMovil = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoPagoMovil) || 0), 0);
    const declaredPunto = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoPunto) || 0), 0);
    const declaredZelle = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoZelle) || 0), 0);

    // Sum egresos
    let egresosBs = 0;
    let egresosUsd = 0;
    dailyTx.forEach(t => {
      if (t.tipo === 'Egreso') {
        const bd = getPaymentBreakdown(t, tasaUsd);
        egresosBs += bd.vesCash;
        egresosUsd += bd.usdCash;
      }
    });

    res.json({
      fecha,
      tasaUsd,
      ventas: {
        habitaciones: { usd: ventasHabitacionesUsd, ves: ventasHabitacionesVes },
        acompanante: { usd: ingresoAcompananteUsd, ves: ingresoAcompananteVes },
        minibar: { usd: ventasMinibarUsd, ves: ventasMinibarVes },
        danos: { usd: danosOtrosUsd, ves: danosOtrosVes },
        total: {
          usd: ventasHabitacionesUsd + ingresoAcompananteUsd + ventasMinibarUsd + danosOtrosUsd,
          ves: ventasHabitacionesVes + ingresoAcompananteVes + ventasMinibarVes + danosOtrosVes
        }
      },
      declarado: {
        divisas: declaredUsdCash,
        efectivoBs: declaredVesCash,
        pagoMovil: declaredPagoMovil,
        punto: declaredPunto,
        zelle: declaredZelle
      },
      egresos: {
        bs: egresosBs,
        usd: egresosUsd
      }
    });
  } catch (error) {
    console.error('Error generating daily closure:', error);
    res.status(500).json({ error: 'Error interno del servidor al calcular el cierre diario.' });
  }
});

// GET /api/reportes/cierre-consolidado - Generar reporte consolidado por rango de fechas
app.get('/api/reportes/cierre-consolidado', requireAuth, async (req, res) => {
  const { fechaInicio, fechaFin } = req.query;
  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ error: 'Debe especificar fechaInicio y fechaFin (YYYY-MM-DD)' });
  }

  try {
    const config = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
    const tasaUsd = config ? parseFloat(config.valor) : 50.00;

    const caja = await db.all("SELECT * FROM caja");
    const turnos = await db.all("SELECT * FROM entrega_turnos");

    const startDay = new Date(fechaInicio);
    const endDay = new Date(fechaFin);

    const diffTime = Math.abs(endDay - startDay);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const dias = [];
    const totals = {
      ventas: {
        habitaciones: { usd: 0, ves: 0 },
        acompanante: { usd: 0, ves: 0 },
        minibar: { usd: 0, ves: 0 },
        danos: { usd: 0, ves: 0 },
        total: { usd: 0, ves: 0 }
      },
      declarado: { divisas: 0, efectivoBs: 0, pagoMovil: 0, punto: 0, zelle: 0 },
      egresos: { bs: 0, usd: 0 }
    };

    const dateParts = fechaInicio.split('-').map(Number);

    for (let i = 0; i < diffDays; i++) {
      const current = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] + i);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const curFechaStr = `${year}-${month}-${day}`;

      const startRange = new Date(year, current.getMonth(), current.getDate(), 8, 0, 0);
      const endRange = new Date(year, current.getMonth(), current.getDate() + 1, 7, 59, 59);

      const dailyTx = caja.filter(t => {
        const tDate = parseDBDate(t.hora);
        return tDate >= startRange && tDate <= endRange;
      });

      let ventasHabitacionesUsd = 0;
      let ventasHabitacionesVes = 0;
      let ingresoAcompananteUsd = 0;
      let ingresoAcompananteVes = 0;
      let ventasMinibarUsd = 0;
      let ventasMinibarVes = 0;
      let danosOtrosUsd = 0;
      let danosOtrosVes = 0;

      dailyTx.forEach(t => {
        if (t.tipo === 'Ingreso') {
          const bd = getPaymentBreakdown(t, tasaUsd);
          const u = bd.usdCash + bd.zelle;
          const v = bd.vesCash + bd.pagoMovil + bd.punto;

          const conceptLower = (t.concepto || '').toLowerCase();
          const isMarket = t.origen === 'Market' || conceptLower.includes('market') || conceptLower.includes('tienda');
          const isAcomp = conceptLower.includes('3er huésped') || conceptLower.includes('acompañante');
          const isDanos = conceptLower.includes('penalidad check-out') || conceptLower.includes('incumplimiento de checklist') || conceptLower.includes('reposición de') || conceptLower.includes('daño');

          if (isMarket) {
            ventasMinibarUsd += u;
            ventasMinibarVes += v;
          } else if (isAcomp) {
            ingresoAcompananteUsd += u;
            ingresoAcompananteVes += v;
          } else if (isDanos) {
            danosOtrosUsd += u;
            danosOtrosVes += v;
          } else {
            ventasHabitacionesUsd += u;
            ventasHabitacionesVes += v;
          }
        }
      });

      const dailyTurnos = turnos.filter(t => {
        const tDate = parseDBDate(t.fechaHoraEntrega);
        return tDate >= startRange && tDate <= endRange;
      });

      // Physical cash is non-cumulative (from the last shift of the day)
      dailyTurnos.sort((a, b) => parseDBDate(a.fechaHoraEntrega) - parseDBDate(b.fechaHoraEntrega));
      const lastShift = dailyTurnos[dailyTurnos.length - 1];

      const declaredUsdCash = lastShift ? (parseFloat(lastShift.saldoEfectivoUsd) || 0) : 0;
      const declaredVesCash = lastShift ? (parseFloat(lastShift.saldoEfectivoVes) || 0) : 0;

      // Digital payments are cumulative across all shifts of the day
      const declaredPagoMovil = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoPagoMovil) || 0), 0);
      const declaredPunto = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoPunto) || 0), 0);
      const declaredZelle = dailyTurnos.reduce((s, t) => s + (parseFloat(t.saldoZelle) || 0), 0);

      let egresosBs = 0;
      let egresosUsd = 0;
      dailyTx.forEach(t => {
        if (t.tipo === 'Egreso') {
          const bd = getPaymentBreakdown(t, tasaUsd);
          egresosBs += bd.vesCash;
          egresosUsd += bd.usdCash;
        }
      });

      const totalVentasUsd = ventasHabitacionesUsd + ingresoAcompananteUsd + ventasMinibarUsd + danosOtrosUsd;
      const totalVentasVes = ventasHabitacionesVes + ingresoAcompananteVes + ventasMinibarVes + danosOtrosVes;

      dias.push({
        fecha: curFechaStr,
        ventas: {
          habitaciones: { usd: ventasHabitacionesUsd, ves: ventasHabitacionesVes },
          acompanante: { usd: ingresoAcompananteUsd, ves: ingresoAcompananteVes },
          minibar: { usd: ventasMinibarUsd, ves: ventasMinibarVes },
          danos: { usd: danosOtrosUsd, ves: danosOtrosVes },
          total: { usd: totalVentasUsd, ves: totalVentasVes }
        },
        declarado: {
          divisas: declaredUsdCash,
          efectivoBs: declaredVesCash,
          pagoMovil: declaredPagoMovil,
          punto: declaredPunto,
          zelle: declaredZelle
        },
        egresos: {
          bs: egresosBs,
          usd: egresosUsd
        }
      });

      totals.ventas.habitaciones.usd += ventasHabitacionesUsd;
      totals.ventas.habitaciones.ves += ventasHabitacionesVes;
      totals.ventas.acompanante.usd += ingresoAcompananteUsd;
      totals.ventas.acompanante.ves += ingresoAcompananteVes;
      totals.ventas.minibar.usd += ventasMinibarUsd;
      totals.ventas.minibar.ves += ventasMinibarVes;
      totals.ventas.danos.usd += danosOtrosUsd;
      totals.ventas.danos.ves += danosOtrosVes;
      totals.ventas.total.usd += totalVentasUsd;
      totals.ventas.total.ves += totalVentasVes;

      totals.declarado.divisas += declaredUsdCash;
      totals.declarado.efectivoBs += declaredVesCash;
      totals.declarado.pagoMovil += declaredPagoMovil;
      totals.declarado.punto += declaredPunto;
      totals.declarado.zelle += declaredZelle;

      totals.egresos.bs += egresosBs;
      totals.egresos.usd += egresosUsd;
    }

    res.json({
      tasaUsd,
      dias,
      totales: totals
    });
  } catch (error) {
    console.error('Error generating consolidated report:', error);
    res.status(500).json({ error: 'Error interno del servidor al calcular el reporte consolidado.' });
  }
});

// GET /api/reportes/minibar-semanal - Obtener ventas semanales de minibar (Snacks vs Cervezas)
app.get('/api/reportes/minibar-semanal', requireAuth, async (req, res) => {
  const { fechaInicio } = req.query;
  if (!fechaInicio) {
    return res.status(400).json({ error: 'Debe especificar la fecha de inicio (YYYY-MM-DD)' });
  }

  try {
    const configRow = await db.get("SELECT tasa_usd FROM configuracion LIMIT 1");
    const tasaUsd = configRow ? parseFloat(configRow.tasa_usd) : 50.0;

    const products = await db.all("SELECT * FROM productos");
    const productMap = {};
    products.forEach(p => {
      productMap[p.nombre.toLowerCase().trim()] = parseFloat(p.precio_venta) || 0;
    });

    const caja = await db.all("SELECT * FROM caja WHERE origen = 'Market' OR concepto LIKE '%venta tienda%' OR concepto LIKE '%venta market%'");

    const [y, m, d] = fechaInicio.split('-').map(Number);
    const result = [];
    const dayNames = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    const weeklyDetails = {}; // { productDisplayName: { producto: String, precio: Number, cantidad: Number, totalUsd: Number, totalVes: Number } }

    for (let i = 0; i < 7; i++) {
      const current = new Date(y, m - 1, d + i);
      const year = current.getFullYear();
      const month = current.getMonth();
      const dayNum = current.getDate();

      const dayStart = new Date(year, month, dayNum, 8, 0, 0);
      const dayEnd = new Date(year, month, dayNum + 1, 7, 59, 59);

      const dayTx = caja.filter(t => {
        const tDate = parseDBDate(t.hora);
        return tDate >= dayStart && tDate <= dayEnd;
      });

      let snacks = { usd: 0, ves: 0 };
      let cervezas = { usd: 0, ves: 0 };

      // Group dayTx by saleCode to avoid double counting items in split/mixed payments
      const salesGroup = {};
      dayTx.forEach(t => {
        const conceptLower = (t.concepto || '').toLowerCase();
        const matchVta = conceptLower.match(/#vta-(\d+)/);
        const saleCode = matchVta ? `VTA-${matchVta[1]}` : `TX-${t.id}`;

        if (!salesGroup[saleCode]) {
          salesGroup[saleCode] = {
            txs: [],
            totalUsdPay: 0,
            totalVesPay: 0,
            totalPay: 0,
            concepto: t.concepto
          };
        }

        salesGroup[saleCode].txs.push(t);
        
        const cleanM = (t.metodo || '').split(' - ')[0].trim();
        if (cleanM === 'Efectivo ($)' || cleanM === 'Zelle') {
          salesGroup[saleCode].totalUsdPay += parseFloat(t.monto) || 0;
        } else {
          salesGroup[saleCode].totalVesPay += parseFloat(t.monto) || 0;
        }
      });

      Object.keys(salesGroup).forEach(code => {
        const s = salesGroup[code];
        s.totalPay = s.totalUsdPay + (s.totalVesPay / tasaUsd);
      });

      Object.keys(salesGroup).forEach(code => {
        const s = salesGroup[code];
        const match = (s.concepto || '').match(/\(([^)]+)\)/);
        if (match) {
          const itemsStr = match[1];
          const parts = itemsStr.split(',');
          parts.forEach(part => {
            let qty = 1;
            let name = part.trim();

            const matchNew = part.trim().match(/^(\d+)\s*(?:Unid\.\s*-\s*|x\s*)(.*?)$/i);
            const matchOld = part.trim().match(/^(.*?)\s+x\s*(\d+)$/i);

            let matched = false;
            if (matchNew) {
              qty = parseInt(matchNew[1]) || 1;
              name = matchNew[2].trim();
              matched = true;
            } else if (matchOld) {
              qty = parseInt(matchOld[2]) || 1;
              name = matchOld[1].trim();
              matched = true;
            }

            if (matched || part.trim().length > 0) {
              const nameLower = name.toLowerCase();

              let price = productMap[nameLower] || 0;
              if (price === 0) {
                const found = Object.keys(productMap).find(k => k.includes(nameLower) || nameLower.includes(k));
                if (found) price = productMap[found];
              }
              if (price === 0) price = 1.50; // fallback

              const totalItemUsd = qty * price;
              
              // Calculate proportion paid in USD vs VES
              const totalPay = s.totalPay || 1;
              const usdRatio = s.totalUsdPay / totalPay;
              const vesRatio = (s.totalVesPay / tasaUsd) / totalPay;

              const usdPaid = totalItemUsd * usdRatio;
              const vesPaid = totalItemUsd * vesRatio * tasaUsd; // in Bs

              const isBeer = nameLower.includes('cerveza') || nameLower.includes('polar') || nameLower.includes('solera') || nameLower.includes('pack') || nameLower.includes('caroreña');

              if (isBeer) {
                cervezas.usd += usdPaid;
                cervezas.ves += vesPaid;
              } else {
                snacks.usd += usdPaid;
                snacks.ves += vesPaid;
              }

              // Accumulate details for the week
              const displayName = name;
              if (!weeklyDetails[displayName]) {
                weeklyDetails[displayName] = {
                  producto: displayName,
                  precio: price,
                  cantidad: 0,
                  totalUsd: 0,
                  totalVes: 0
                };
              }
              weeklyDetails[displayName].cantidad += qty;
              weeklyDetails[displayName].totalUsd += usdPaid;
              weeklyDetails[displayName].totalVes += vesPaid;
            }
          });
        } else {
          // Fallback if no concept parentheses: distribute directly by transaction payment types
          s.txs.forEach(t => {
            const cleanM = (t.metodo || '').split(' - ')[0].trim();
            const isUsd = cleanM === 'Efectivo ($)' || cleanM === 'Zelle';
            const m = parseFloat(t.monto) || 0;
            if (isUsd) {
              snacks.usd += m;
            } else {
              snacks.ves += m;
            }
          });
        }
      });

      result.push({
        dia: dayNames[i],
        fecha: `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
        snacks,
        cervezas,
        total: {
          usd: snacks.usd + cervezas.usd,
          ves: snacks.ves + cervezas.ves
        }
      });
    }

    const detallesArray = Object.values(weeklyDetails).sort((a, b) => b.cantidad - a.cantidad);

    res.json({
      dias: result,
      detalles: detallesArray
    });
  } catch (error) {
    console.error('Error calculating minibar weekly report:', error);
    res.status(500).json({ error: 'Error interno del servidor al calcular el reporte de minibar.' });
  }
});

// GET /api/inventario-lenceria - Obtener insumos de textil/lavandería (v4 - Fase 3)
app.get('/api/inventario-lenceria', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM inventario_lenceria');
    res.json(list);
  } catch (error) {
    console.error('Error fetching lenceria:', error);
    res.status(500).json({ error: 'Error al obtener inventario de lencería.' });
  }
});

// POST /api/inventario-lenceria - Registrar nuevo tipo de textil/lencería (v4 - Fase 3)
app.post('/api/inventario-lenceria', requireAuth, async (req, res) => {
  const { nombre, cantidad_total, en_almacen, en_lavanderia, en_habitaciones, de_baja } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'Debe ingresar el nombre del ítem textil.' });
  }
  try {
    const id = 'len_' + Date.now();
    await db.run(
      `INSERT INTO inventario_lenceria (id, nombre, cantidad_total, en_almacen, en_lavanderia, en_habitaciones, de_baja)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nombre.trim(),
        parseInt(cantidad_total || 0),
        parseInt(en_almacen || 0),
        parseInt(en_lavanderia || 0),
        parseInt(en_habitaciones || 0),
        parseInt(de_baja || 0)
      ]
    );
    res.json({ success: true, message: 'Ítem de lencería registrado exitosamente.' });
  } catch (error) {
    console.error('Error creating lenceria:', error);
    res.status(500).json({ error: 'Error al registrar ítem de lencería.' });
  }
});

// PUT /api/inventario-lenceria/:id - Actualizar distribución o cantidades de lencería (v4 - Fase 3)
app.put('/api/inventario-lenceria/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { en_almacen, en_lavanderia, en_habitaciones, de_baja } = req.body;

  try {
    const item = await db.get('SELECT * FROM inventario_lenceria WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Ítem de lencería no encontrado.' });
    }

    const alm = en_almacen !== undefined ? parseInt(en_almacen) : item.en_almacen;
    const lav = en_lavanderia !== undefined ? parseInt(en_lavanderia) : item.en_lavanderia;
    const hab = en_habitaciones !== undefined ? parseInt(en_habitaciones) : item.en_habitaciones;
    const baj = de_baja !== undefined ? parseInt(de_baja) : item.de_baja;

    // Validación de no-negativos (Requerimiento 2)
    if (alm < 0 || lav < 0 || hab < 0 || baj < 0) {
      return res.status(400).json({ error: 'Las cantidades de inventario no pueden ser negativas.' });
    }

    const total = alm + lav + hab + baj;

    await db.run(
      `UPDATE inventario_lenceria 
       SET en_almacen = ?, en_lavanderia = ?, en_habitaciones = ?, de_baja = ?, cantidad_total = ? 
       WHERE id = ?`,
      [alm, lav, hab, baj, total, id]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Inventario Lencería',
      `Actualizada distribución de ${item.nombre}: Almacén ${alm}, Lavandería ${lav}, Habitaciones ${hab}, Baja ${baj}`,
      req.ip
    );

    res.json({ success: true, message: 'Distribución de lencería actualizada.' });
  } catch (error) {
    console.error('Error updating lenceria:', error);
    res.status(500).json({ error: 'Error al actualizar inventario de lencería.' });
  }
});

// GET /api/inventario-habitaciones - Obtener equipamiento fijo por habitación (v4 - Fase 3)
app.get('/api/inventario-habitaciones', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM inventario_habitaciones');
    res.json(list);
  } catch (error) {
    console.error('Error fetching room equipment:', error);
    res.status(500).json({ error: 'Error al obtener inventario de equipamiento.' });
  }
});

// PUT /api/inventario-habitaciones/:numHabitacion - Actualizar estado de equipamiento fijo por habitación (v4 - Fase 3)
app.put('/api/inventario-habitaciones/:numHabitacion', requireAuth, async (req, res) => {
  const { numHabitacion } = req.params;
  const { tv, control_tv, control_aire, control_musica, aire_acondicionado, nevera, espejo, llave, poceta, lavamanos, ducha, microondas, caja_fuerte, no_pertenece, observaciones } = req.body;

  try {
    const existing = await db.get('SELECT * FROM inventario_habitaciones WHERE numHabitacion = ?', [numHabitacion]);

    await db.run(
      `INSERT INTO inventario_habitaciones (
        numHabitacion, tv, control_tv, control_aire, control_musica, aire_acondicionado, nevera, espejo, llave, poceta, lavamanos, ducha, microondas, caja_fuerte, no_pertenece, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(numHabitacion) DO UPDATE SET
        tv = excluded.tv,
        control_tv = excluded.control_tv,
        control_aire = excluded.control_aire,
        control_musica = excluded.control_musica,
        aire_acondicionado = excluded.aire_acondicionado,
        nevera = excluded.nevera,
        espejo = excluded.espejo,
        llave = excluded.llave,
        poceta = excluded.poceta,
        lavamanos = excluded.lavamanos,
        ducha = excluded.ducha,
        microondas = excluded.microondas,
        caja_fuerte = excluded.caja_fuerte,
        no_pertenece = excluded.no_pertenece,
        observaciones = excluded.observaciones`,
      [
        numHabitacion,
        tv || 'Operativo',
        control_tv || 'Operativo',
        control_aire || 'Operativo',
        control_musica || 'Operativo',
        aire_acondicionado || 'Operativo',
        nevera || 'Operativo',
        espejo || 'Operativo',
        llave || 'Operativo',
        poceta || 'Operativo',
        lavamanos || 'Operativo',
        ducha || 'Operativo',
        microondas !== undefined ? microondas : (existing?.microondas || 'Operativo'),
        caja_fuerte !== undefined ? caja_fuerte : (existing?.caja_fuerte || 'Operativo'),
        no_pertenece !== undefined ? no_pertenece : (existing?.no_pertenece || ''),
        (observaciones !== undefined ? observaciones : (existing?.observaciones || '')).trim()
      ]
    );

    // Registrar en historial de modificaciones de equipamiento (Requerimiento 3)
    const histId = 'eqh_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const detalleEq = `TV: ${tv || existing?.tv || 'Operativo'}, CntrlTV: ${control_tv || existing?.control_tv || 'Operativo'}, AC: ${aire_acondicionado || existing?.aire_acondicionado || 'Operativo'}, Nevera: ${nevera || existing?.nevera || 'Operativo'}, Microondas: ${microondas !== undefined ? microondas : (existing?.microondas || 'Operativo')}, CajaFuerte: ${caja_fuerte !== undefined ? caja_fuerte : (existing?.caja_fuerte || 'Operativo')}${no_pertenece ? ` | No pertenece: ${no_pertenece}` : ''}`;
    await db.run(
      `INSERT INTO inventario_habitaciones_historial (id, numHabitacion, usuarioId, usuarioNombre, fecha, accion, detalle, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        histId,
        numHabitacion,
        req.user.id,
        req.user.nombre,
        getFechaHoraActual(),
        'Actualización de Equipamiento',
        detalleEq,
        (observaciones || '').trim()
      ]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Inventario Equipamiento Habitación',
      `Actualizado equipamiento de Habitación #${numHabitacion}`,
      req.ip
    );

    res.json({ success: true, message: `Equipamiento de Hab. #${numHabitacion} actualizado.` });
  } catch (error) {
    console.error('Error updating room equipment:', error);
    res.status(500).json({ error: 'Error al actualizar equipamiento de la habitación.' });
  }
});

// GET /api/tabla-danos - Obtener catálogo de daños y penalizaciones (v4 - Fase 4)
app.get('/api/tabla-danos', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM tabla_danos');
    res.json(list);
  } catch (error) {
    console.error('Error fetching tabla_danos:', error);
    res.status(500).json({ error: 'Error al obtener la tabla de daños.' });
  }
});

// POST /api/tabla-danos - Registrar nuevo ítem o penalización por daño (v4 - Fase 4)
app.post('/api/tabla-danos', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { concepto, precio_usd, tipo_tarifa } = req.body;
  if (!concepto || precio_usd === undefined) {
    return res.status(400).json({ error: 'Debe ingresar el concepto y precio base del daño.' });
  }

  try {
    const id = 'd_' + Date.now();
    await db.run(
      'INSERT INTO tabla_danos (id, concepto, precio_usd, tipo_tarifa) VALUES (?, ?, ?, ?)',
      [id, concepto.trim(), parseFloat(precio_usd), tipo_tarifa || 'fija']
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Tabla de Daños', `Registrado ítem de daño: ${concepto} ($${precio_usd} USD)`, req.ip);

    res.json({ success: true, message: 'Ítem registrado en la Tabla de Daños.' });
  } catch (error) {
    console.error('Error adding tabla_danos item:', error);
    res.status(500).json({ error: 'Error al agregar ítem a la Tabla de Daños.' });
  }
});

// PUT /api/tabla-danos/:id - Editar tarifa o concepto de la Tabla de Daños (v4 - Fase 4)
app.put('/api/tabla-danos/:id', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { id } = req.params;
  const { concepto, precio_usd, tipo_tarifa } = req.body;

  try {
    await db.run(
      'UPDATE tabla_danos SET concepto = ?, precio_usd = ?, tipo_tarifa = ? WHERE id = ?',
      [concepto.trim(), parseFloat(precio_usd), tipo_tarifa || 'fija', id]
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Tabla de Daños', `Actualizado ítem de daño #${id}: ${concepto} ($${precio_usd} USD)`, req.ip);

    res.json({ success: true, message: 'Ítem de la Tabla de Daños actualizado.' });
  } catch (error) {
    console.error('Error updating tabla_danos item:', error);
    res.status(500).json({ error: 'Error al actualizar ítem de la Tabla de Daños.' });
  }
});

// DELETE /api/tabla-danos/:id - Eliminar ítem de la Tabla de Daños (v4 - Fase 4)
app.delete('/api/tabla-danos/:id', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { id } = req.params;
  try {
    await db.run('DELETE FROM tabla_danos WHERE id = ?', [id]);
    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Tabla de Daños', `Eliminado ítem de daño #${id}`, req.ip);
    res.json({ success: true, message: 'Ítem eliminado de la Tabla de Daños.' });
  } catch (error) {
    console.error('Error deleting tabla_danos item:', error);
    res.status(500).json({ error: 'Error al eliminar ítem de la Tabla de Daños.' });
  }
});

// POST /api/entrega-turnos - Registrar nueva entrega de turno por recepcionista saliente (v4 - Fase 2)
app.post('/api/entrega-turnos', requireAuth, async (req, res) => {
  const { 
    saldoEfectivoUsd, 
    saldoEfectivoVes, 
    saldoPagoMovil,
    saldoPunto,
    saldoZelle,
    ventasMarket,
    stockSnackbarConteo, 
    lenceriaRecepcionConteo, 
    llavesHerramientasConteo, 
    novedades 
  } = req.body;

  try {
    const id = 'ent_' + Date.now();
    const fechaHora = new Date().toISOString();

    await db.run(
      `INSERT INTO entrega_turnos (
        id, usuarioSalienteId, usuarioSalienteNombre, fechaHoraEntrega, 
        saldoEfectivoUsd, saldoEfectivoVes, saldoPagoMovil, saldoPunto, saldoZelle, ventasMarket,
        stockSnackbarConteo, lenceriaRecepcionConteo, llavesHerramientasConteo, novedades, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        req.user.nombre,
        fechaHora,
        parseFloat(saldoEfectivoUsd || 0),
        parseFloat(saldoEfectivoVes || 0),
        parseFloat(saldoPagoMovil || 0),
        parseFloat(saldoPunto || 0),
        parseFloat(saldoZelle || 0),
        parseFloat(ventasMarket || 0),
        typeof stockSnackbarConteo === 'string' ? stockSnackbarConteo : JSON.stringify(stockSnackbarConteo || {}),
        typeof lenceriaRecepcionConteo === 'string' ? lenceriaRecepcionConteo : JSON.stringify(lenceriaRecepcionConteo || {}),
        typeof llavesHerramientasConteo === 'string' ? llavesHerramientasConteo : JSON.stringify(llavesHerramientasConteo || {}),
        (novedades || '').trim(),
        'Pendiente Confirmación'
      ]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Entrega de Turno',
      `Entrega de turno registrada. Efectivo: $${saldoEfectivoUsd} USD / Bs. ${saldoEfectivoVes}. Novedades: ${novedades || 'Ninguna'}`,
      req.ip
    );

    res.json({ success: true, id, message: 'Planilla de entrega de turno registrada con éxito.' });
  } catch (error) {
    console.error('Error al registrar entrega de turno:', error);
    res.status(500).json({ error: 'Error al registrar la entrega de turno.' });
  }
});

// PUT /api/entrega-turnos/:id/confirmar - Recepcionista entrante confirma recepción de turno (v4 - Fase 2)
app.put('/api/entrega-turnos/:id/confirmar', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { observacionesConfirmacion, conDiscrepancia } = req.body;

  try {
    const entrega = await db.get('SELECT * FROM entrega_turnos WHERE id = ?', [id]);
    if (!entrega) {
      return res.status(404).json({ error: 'Registro de entrega de turno no encontrado.' });
    }

    if (entrega.usuarioSalienteId === req.user.id && req.user.rol !== 'Administrador' && req.user.rol !== 'Supervisor' && req.user.rol !== 'Super Admin') {
      return res.status(403).json({ error: 'No puedes confirmar tu propia entrega de turno. Debe ser confirmada por la recepcionista entrante o la gerencia.' });
    }

    const nuevoEstado = conDiscrepancia ? 'Con Discrepancia' : 'Recibido Conforme';

    await db.run(
      `UPDATE entrega_turnos 
       SET usuarioEntranteId = ?, usuarioEntranteNombre = ?, observacionesConfirmacion = ?, estado = ? 
       WHERE id = ?`,
      [req.user.id, req.user.nombre, (observacionesConfirmacion || '').trim(), nuevoEstado, id]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Recepción de Turno',
      `Turno #${id} de ${entrega.usuarioSalienteNombre} ${nuevoEstado}. Obs: ${observacionesConfirmacion || 'Sin observaciones'}`,
      req.ip
    );

    res.json({ success: true, estado: nuevoEstado, message: `Recepción de turno guardada como ${nuevoEstado}.` });
  } catch (error) {
    console.error('Error al confirmar recepción de turno:', error);
    res.status(500).json({ error: 'Error al confirmar la recepción del turno.' });
  }
});

// POST /api/entrega-turnos/:id/solicitar-correccion - Recepcionista solicita corregir entrega de turno (v6 - Fase 4)
app.post('/api/entrega-turnos/:id/solicitar-correccion', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { motivo, solicitudSaldoUsd, solicitudSaldoVes } = req.body;

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'Debe ingresar el motivo de la corrección.' });
  }

  try {
    const entrega = await db.get('SELECT * FROM entrega_turnos WHERE id = ?', [id]);
    if (!entrega) {
      return res.status(404).json({ error: 'Entrega de turno no encontrada.' });
    }

    // Enforce permission: only saliente user or Admin/Super Admin can request corrections
    if (entrega.usuarioSalienteId !== req.user.id && req.user.rol !== 'Administrador' && req.user.rol !== 'Super Admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo puede solicitar correcciones de sus propias planillas de turno.' });
    }

    await db.run(
      `UPDATE entrega_turnos 
       SET solicitudCorreccion = 1, motivoCorreccion = ?, 
           solicitudSaldoUsd = ?, solicitudSaldoVes = ?, 
           estadoCorreccion = 'Pendiente'
       WHERE id = ?`,
      [
        motivo.trim(),
        parseFloat(solicitudSaldoUsd || 0),
        parseFloat(solicitudSaldoVes || 0),
        id
      ]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Solicitud Corrección Turno',
      `Solicitud para entrega #${id}: USD solicitado $${solicitudSaldoUsd}, VES solicitado Bs. ${solicitudSaldoVes}. Motivo: ${motivo}`,
      req.ip
    );

    res.json({ success: true, message: 'Solicitud de corrección enviada al Super Administrador.' });
  } catch (error) {
    console.error('Error al solicitar corrección de turno:', error);
    res.status(500).json({ error: 'Error al enviar la solicitud de corrección.' });
  }
});

// PUT /api/entrega-turnos/:id/resolver-correccion - Super Admin aprueba/rechaza corrección (v6 - Fase 4)
app.put('/api/entrega-turnos/:id/resolver-correccion', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Super Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Administrador.' });
  }

  const { id } = req.params;
  const { decision } = req.body; // 'Aprobado' | 'Rechazado'

  if (decision !== 'Aprobado' && decision !== 'Rechazado') {
    return res.status(400).json({ error: 'Decisión inválida. Debe ser Aprobado o Rechazado.' });
  }

  try {
    const entrega = await db.get('SELECT * FROM entrega_turnos WHERE id = ?', [id]);
    if (!entrega) {
      return res.status(404).json({ error: 'Entrega de turno no encontrada.' });
    }

    if (decision === 'Aprobado') {
      await db.run(
        `UPDATE entrega_turnos 
         SET saldoEfectivoUsd = solicitudSaldoUsd, 
             saldoEfectivoVes = solicitudSaldoVes, 
             estadoCorreccion = 'Aprobado'
         WHERE id = ?`,
        [id]
      );
    } else {
      await db.run(
        `UPDATE entrega_turnos 
         SET estadoCorreccion = 'Rechazado'
         WHERE id = ?`,
        [id]
      );
    }

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      `Resolución Corrección Turno (${decision})`,
      `Corrección para entrega #${id} fue ${decision} por ${req.user.nombre}.`,
      req.ip
    );

    res.json({ success: true, message: `Solicitud de corrección resuelta como: ${decision}.` });
  } catch (error) {
    console.error('Error al resolver corrección de turno:', error);
    res.status(500).json({ error: 'Error al resolver la solicitud de corrección.' });
  }
});

// 7. POST /api/limpieza-terminada - Change room status from Limpieza to Libre (or Reservada if there is a pending reservation)
app.post('/api/limpieza-terminada', requireAuth, async (req, res) => {
  const { numHabitacion } = req.body;

  if (!numHabitacion) {
    return res.status(400).json({ error: 'Falta número de habitación' });
  }

  try {
    const reservation = await db.get('SELECT * FROM reservas WHERE numHabitacion = ?', [numHabitacion]);
    let nextStatus = 'Libre';
    let huespedName = '';

    if (reservation) {
      nextStatus = 'Reservada';
      const cliente = await db.get('SELECT nombre FROM clientes WHERE id = ?', [reservation.clienteId]);
      if (cliente) {
        huespedName = formatGuestName(cliente.nombre);
      }
    }

    await db.run(
      `UPDATE habitaciones 
       SET estado = ?, huesped = ? 
       WHERE num = ? AND estado = 'Limpieza'`, 
      [nextStatus, huespedName, numHabitacion]
    );

    res.json({ success: true, message: `Habitación ${numHabitacion} ahora está ${nextStatus.toLowerCase()}` });
  } catch (error) {
    console.error('Error completing room cleaning:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tienda/venta-directa - Procesar venta directa de la tienda / market con pagos mixtos (v3 - Fase 5)
app.post('/api/tienda/venta-directa', requireAuth, async (req, res) => {
  const { items, pagos, clienteNombre, clienteCi, comprobante, numHabitacion, cargarHabitacion } = req.body;
 
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito de compras está vacío.' });
  }
 
  if (!cargarHabitacion && (!pagos || (Array.isArray(pagos) && pagos.length === 0))) {
    return res.status(400).json({ error: 'Se debe especificar al menos un método de pago.' });
  }
 
  try {
    const totalUsd = items.reduce((sum, item) => sum + (parseFloat(item.precio_venta) * parseInt(item.cantidad)), 0);
    const saleCode = 'VTA-' + Math.floor(Math.random() * 90000 + 10000);
 
    // 1. Verify stock for all items (incluyendo promociones/combos)
    for (const item of items) {
      const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
      if (!prod) {
        return res.status(404).json({ error: `El producto "${item.nombre}" ya no existe en el catálogo.` });
      }

      if (prod.es_combo === 1 && prod.producto_padre_id) {
        const parentProd = await db.get('SELECT * FROM productos WHERE id = ?', [prod.producto_padre_id]);
        if (!parentProd) {
          return res.status(404).json({ error: `El producto base vinculado al combo "${item.nombre}" ya no existe.` });
        }
        const requiredParentStock = item.cantidad * (prod.unidades_por_combo || 1);
        if (parentProd.stock < requiredParentStock) {
          return res.status(400).json({ 
            error: `Stock insuficiente de "${parentProd.nombre}" para vender la promoción "${item.nombre}". Stock disponible: ${parentProd.stock} unidades (se requieren ${requiredParentStock}).` 
          });
        }
      } else {
        if (prod.stock < item.cantidad) {
          return res.status(400).json({ error: `Stock insuficiente para "${item.nombre}". Stock disponible: ${prod.stock}` });
        }
      }
    }

    // Deduct stock (si es combo, se descuenta del producto padre)
    for (const item of items) {
      const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
      if (prod.es_combo === 1 && prod.producto_padre_id) {
        const totalUnitsToDeduct = item.cantidad * (prod.unidades_por_combo || 1);
        await db.run('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', [totalUnitsToDeduct, prod.producto_padre_id]);
      } else {
        await db.run('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', [item.cantidad, item.id]);
      }
    }
 
    // 2. Prepare payment breakdown & metadata
    const pagosList = Array.isArray(pagos) ? pagos : (pagos ? [pagos] : []);
    const isPagoMixto = pagosList.length > 1;
    
    // Build item concepts list using actual quantities/combos
    let conceptoItemsList = [];
    for (const item of items) {
      const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
      const qtyToDisplay = prod && prod.es_combo === 1 ? (parseInt(item.cantidad) * (prod.unidades_por_combo || 1)) : parseInt(item.cantidad);
      conceptoItemsList.push(`${qtyToDisplay} Unid. - ${item.nombre}`);
    }
    let conceptoItems = conceptoItemsList.join(', ');

    let clienteInfo = clienteNombre ? ` - Cliente: ${clienteNombre.trim()}` : '';
    if (clienteCi) clienteInfo += ` (CI: ${clienteCi.trim()})`;
 
    // If pre-consumo (Minimarket order before assigning room), save items into `consumos` table under 'EN_ESPERA'
    const isPreConsumo = req.body.isPreConsumo || false;
 
    if (isPreConsumo) {
      for (const item of items) {
        const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
        const cnsId = 'cns_pre_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const isCombo = prod && prod.es_combo === 1 && prod.producto_padre_id;
        const finalCant = isCombo ? (parseInt(item.cantidad) * (prod.unidades_por_combo || 1)) : parseInt(item.cantidad);
        const finalPrecio = isCombo ? (parseFloat(item.precio_venta) / (prod.unidades_por_combo || 1)) : parseFloat(item.precio_venta);

        await db.run(
          'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha, cliente_ci, cliente_nombre, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            cnsId,
            'EN_ESPERA',
            prod ? prod.nombre : item.nombre,
            finalPrecio,
            finalCant,
            getFechaHoraActual(),
            (clienteCi || '').trim(),
            (clienteNombre || '').trim(),
            'pre_consumo'
          ]
        );
      }
    } else {
      // If linked to a room, always record in the stay's consumption history
      if (numHabitacion) {
        const cState = cargarHabitacion ? 'cargado_habitacion' : 'pagado_inmediato';
        for (const item of items) {
          const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
          const cnsId = 'cns_pos_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
          const isCombo = prod && prod.es_combo === 1 && prod.producto_padre_id;
          const finalCant = isCombo ? (parseInt(item.cantidad) * (prod.unidades_por_combo || 1)) : parseInt(item.cantidad);
          const finalPrecio = isCombo ? (parseFloat(item.precio_venta) / (prod.unidades_por_combo || 1)) : parseFloat(item.precio_venta);

          await db.run(
            'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha, cliente_ci, cliente_nombre, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              cnsId,
              numHabitacion,
              prod ? prod.nombre : item.nombre,
              finalPrecio,
              finalCant,
              getFechaHoraActual(),
              (clienteCi || '').trim(),
              (clienteNombre || '').trim(),
              cState
            ]
          );
        }
      }

      // If not deferred to checkout, record payment in cash register (caja)
      if (!cargarHabitacion) {
        for (const pago of pagosList) {
          const montoPago = parseFloat(pago.monto_usd) || 0;
          if (montoPago > 0) {
            const transId = 't_pos_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
            let conceptoCaja = `Venta Tienda #${saleCode} (${conceptoItems})${clienteInfo} [${comprobante || 'Ticket Interno'}]`;
            if (numHabitacion) {
              conceptoCaja = `Venta Tienda Hab ${numHabitacion} #${saleCode} (${conceptoItems})${clienteInfo} [${comprobante || 'Ticket Interno'}]`;
            }
            if (isPagoMixto) {
              conceptoCaja += ` (PAGO MIXTO: $${montoPago.toFixed(2)} USD vía ${pago.metodo})`;
            }

            let finalMetodo = pago.metodo || 'Efectivo (Bs)';
            const isDigital = ['Pago Móvil', 'Punto de Venta', 'Zelle'].includes(finalMetodo);
            if (isDigital && pago.codigoRef && pago.codigoRef.trim()) {
              finalMetodo = `${finalMetodo} - Ref: ${pago.codigoRef.trim()}`;
            }

            await db.run(
              'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                transId,
                'Ingreso',
                conceptoCaja,
                montoPago,
                finalMetodo,
                getFechaHoraActual(),
                req.user.id,
                req.user.nombre,
                'Market'
              ]
            );
          }
        }
      }
    }

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Venta Tienda POS',
      `Venta #${saleCode} realizada por $${totalUsd.toFixed(2)} USD (${conceptoItems}). ${isPagoMixto ? 'Pago Mixto' : 'Pago Único'}`,
      req.ip
    );

    res.json({
      success: true,
      message: `Venta #${saleCode} procesada exitosamente.`,
      ticket: {
        code: saleCode,
        fecha: getHoraActual(),
        items,
        totalUsd,
        pagos: pagosList,
        clienteNombre,
        clienteCi,
        vendedor: req.user.nombre
      }
    });
  } catch (error) {
    console.error('Error procesando venta directa:', error);
    res.status(500).json({ error: 'Error al procesar la venta en tienda.' });
  }
});

// GET /api/consumos/pre-consumos - Listar consumos previos en espera de habitación
app.get('/api/consumos/pre-consumos', requireAuth, async (req, res) => {
  try {
    const list = await db.all("SELECT * FROM consumos WHERE estado = 'pre_consumo' OR numHabitacion = 'EN_ESPERA'");
    res.json({ success: true, preConsumos: list });
  } catch (error) {
    console.error('Error fetching pre-consumos:', error);
    res.status(500).json({ error: 'Error al obtener consumos previos' });
  }
});

// POST /api/consumos/vincular - Vincular consumos en espera a una habitación asignada
app.post('/api/consumos/vincular', requireAuth, async (req, res) => {
  const { consumoId, numHabitacion } = req.body;
  if (!consumoId || !numHabitacion) {
    return res.status(400).json({ error: 'Faltan parámetros de vinculación' });
  }
  try {
    await db.run(
      "UPDATE consumos SET numHabitacion = ?, estado = 'cargado_habitacion' WHERE id = ?",
      [numHabitacion, consumoId]
    );
    res.json({ success: true, message: `Consumo vinculado exitosamente a la habitación ${numHabitacion}` });
  } catch (error) {
    console.error('Error vincular consumo:', error);
    res.status(500).json({ error: 'Error al vincular consumo' });
  }
});

// GET /api/consumos/:numHabitacion - Listar consumos de una habitación
app.get('/api/consumos/:numHabitacion', requireAuth, async (req, res) => {
  const { numHabitacion } = req.params;
  try {
    const list = await db.all('SELECT * FROM consumos WHERE numHabitacion = ?', [numHabitacion]);
    res.json(list);
  } catch (error) {
    console.error('Error fetching consumos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. POST /api/consumos - Agregar un consumo a una habitación (v2 - Fase 4: Bloqueado por catálogo y descuento de stock)
app.post('/api/consumos', requireAuth, async (req, res) => {
  const { numHabitacion, concepto, monto, cantidad, productoId } = req.body;
  if (!numHabitacion || !concepto || monto === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const cant = parseInt(cantidad) || 1;
    let finalMonto = parseFloat(monto);
    let catalogProduct = null;

    // Buscar si el consumo pertenece al catálogo de productos
    if (productoId) {
      catalogProduct = await db.get('SELECT * FROM productos WHERE id = ?', [productoId]);
    } else {
      catalogProduct = await db.get('SELECT * FROM productos WHERE LOWER(nombre) = LOWER(?)', [concepto.trim()]);
    }

    let finalCantToLog = cant;
    let finalPriceToLog = finalMonto;

    if (catalogProduct) {
      finalMonto = catalogProduct.precio_venta;

      if (catalogProduct.es_combo === 1 && catalogProduct.producto_padre_id) {
        // Promoción / Combo
        const parentProd = await db.get('SELECT * FROM productos WHERE id = ?', [catalogProduct.producto_padre_id]);
        if (!parentProd) {
          return res.status(404).json({ error: `El producto base para la promoción "${catalogProduct.nombre}" no existe.` });
        }
        const requiredParentStock = cant * (catalogProduct.unidades_por_combo || 1);
        if (parentProd.stock < requiredParentStock) {
          const availableCombos = Math.floor(parentProd.stock / (catalogProduct.unidades_por_combo || 1));
          return res.status(400).json({ 
            error: `Stock insuficiente de "${parentProd.nombre}" para la promoción "${catalogProduct.nombre}". Solo quedan ${availableCombos} combos disponibles.` 
          });
        }
        // Descontar del producto padre
        await db.run('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', [requiredParentStock, catalogProduct.producto_padre_id]);
        
        finalCantToLog = requiredParentStock;
        finalPriceToLog = finalMonto / (catalogProduct.unidades_por_combo || 1);
      } else {
        // Producto normal
        if (catalogProduct.stock < cant) {
          return res.status(400).json({ 
            error: `Stock insuficiente para "${catalogProduct.nombre}". Quedan ${catalogProduct.stock} unidad(es) en inventario.` 
          });
        }
        // Descontar del catálogo
        await db.run('UPDATE productos SET stock = MAX(0, stock - ?) WHERE id = ?', [cant, catalogProduct.id]);
        
        finalCantToLog = cant;
        finalPriceToLog = finalMonto;
      }
    }

    const id = 'cns_' + Date.now();
    const now = new Date();
    const fecha = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await db.run(
      'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [id, numHabitacion, catalogProduct ? catalogProduct.nombre : concepto.trim(), finalPriceToLog, finalCantToLog, fecha]
    );
    res.json({ success: true, message: 'Consumo registrado correctamente' });
  } catch (error) {
    console.error('Error adding consumo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. DELETE /api/consumos/:id - Eliminar un consumo por ID y devolver stock al catálogo
app.delete('/api/consumos/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const consumo = await db.get('SELECT * FROM consumos WHERE id = ?', [id]);
    if (consumo) {
      // Verificar si el consumo pertenecía a un producto del catálogo para devolver el stock
      const catalogProduct = await db.get('SELECT * FROM productos WHERE LOWER(nombre) = LOWER(?)', [consumo.concepto.trim()]);
      if (catalogProduct) {
        if (catalogProduct.es_combo === 1 && catalogProduct.producto_padre_id) {
          await db.run('UPDATE productos SET stock = stock + ? WHERE id = ?', [consumo.cantidad, catalogProduct.producto_padre_id]);
        } else {
          await db.run('UPDATE productos SET stock = stock + ? WHERE id = ?', [consumo.cantidad, catalogProduct.id]);
        }
      }
      await db.run('DELETE FROM consumos WHERE id = ?', [id]);
    }
    res.json({ success: true, message: 'Consumo eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting consumo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ====================================================
// ENDPOINTS: INVENTARIO / CATÁLOGO Y TARIFAS (v2 - Fase 2)
// ====================================================

// GET /api/productos - Listar productos (con auth)
app.get('/api/productos', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM productos ORDER BY nombre ASC');
    // Compute dynamic stock for combos
    for (const p of list) {
      if (p.es_combo === 1 && p.producto_padre_id) {
        const parent = list.find(x => x.id === p.producto_padre_id);
        p.stock = parent ? Math.floor(parent.stock / (p.unidades_por_combo || 1)) : 0;
      }
    }
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar productos del catálogo.' });
  }
});

// POST /api/productos - Crear producto (Solo Admin o con permiso)
app.post('/api/productos', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Catálogo y Tarifas.' });
  }
  const { nombre, precio_venta, stock, es_combo, producto_padre_id, unidades_por_combo } = req.body;
  if (!nombre || precio_venta === undefined) {
    return res.status(400).json({ error: 'Nombre y precio de venta son obligatorios.' });
  }

  try {
    const existing = await db.get('SELECT id FROM productos WHERE nombre = ?', [nombre.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un producto con este nombre.' });
    }

    const id = 'p_' + Date.now();
    const precio = parseFloat(precio_venta) || 0;
    const isComboVal = es_combo ? 1 : 0;
    const stk = isComboVal === 1 ? 0 : (parseInt(stock) || 0);
    const parentIdVal = isComboVal ? (producto_padre_id || null) : null;
    const unitsPerComboVal = isComboVal ? (parseInt(unidades_por_combo) || 1) : 1;

    await db.run(
      'INSERT INTO productos (id, nombre, precio_venta, stock, es_combo, producto_padre_id, unidades_por_combo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nombre.trim(), precio, stk, isComboVal, parentIdVal, unitsPerComboVal]
    );

    res.json({ success: true, message: 'Producto agregado al catálogo.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar producto.' });
  }
});

// PUT /api/productos/:id - Editar stock o precio de producto (Solo Admin o con permiso)
app.put('/api/productos/:id', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Catálogo y Tarifas.' });
  }
  const { id } = req.params;
  const { nombre, precio_venta, stock, es_combo, producto_padre_id, unidades_por_combo } = req.body;

  try {
    const item = await db.get('SELECT id FROM productos WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const precio = parseFloat(precio_venta);
    const isComboVal = es_combo ? 1 : 0;
    const stk = isComboVal === 1 ? 0 : (parseInt(stock) || 0);
    const parentIdVal = isComboVal ? (producto_padre_id || null) : null;
    const unitsPerComboVal = isComboVal ? (parseInt(unidades_por_combo) || 1) : 1;

    await db.run(
      'UPDATE productos SET nombre = ?, precio_venta = ?, stock = ?, es_combo = ?, producto_padre_id = ?, unidades_por_combo = ? WHERE id = ?',
      [nombre.trim(), precio, stk, isComboVal, parentIdVal, unitsPerComboVal, id]
    );

    res.json({ success: true, message: 'Producto actualizado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto.' });
  }
});

// DELETE /api/productos/:id - Eliminar producto del catálogo (Solo Admin o con permiso)
app.delete('/api/productos/:id', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Catálogo y Tarifas.' });
  }
  const { id } = req.params;

  try {
    const item = await db.get('SELECT id FROM productos WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    await db.run('DELETE FROM productos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Producto eliminado del catálogo.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto.' });
  }
});

// GET /api/tarifas - Listar tarifas de habitación (con auth)
app.get('/api/tarifas', requireAuth, async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM tarifas');
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tarifas.' });
  }
});

// PUT /api/tarifas/:tipo - Editar tarifa de un tipo de habitación (Solo Admin o con permiso)
app.put('/api/tarifas/:tipo', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('configuracion') && req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Catálogo y Tarifas.' });
  }
  const { tipo } = req.params;
  const { precio_diario, precio_4h_usd, precio_pernocta_usd, precio_hora_extra_usd } = req.body;

  try {
    const rate = await db.get('SELECT tipo FROM tarifas WHERE tipo = ?', [tipo]);
    if (!rate) {
      return res.status(404).json({ error: 'Tipo de tarifa no encontrada.' });
    }

    const pPernocta = parseFloat(precio_pernocta_usd !== undefined ? precio_pernocta_usd : precio_diario);
    const p4h = parseFloat(precio_4h_usd !== undefined ? precio_4h_usd : 10);
    const pHoraExtra = parseFloat(precio_hora_extra_usd !== undefined ? precio_hora_extra_usd : 3);

    if (isNaN(pPernocta) || pPernocta <= 0) {
      return res.status(400).json({ error: 'Precio de pernocta inválido.' });
    }

    await db.run(
      'UPDATE tarifas SET precio_diario = ?, precio_pernocta_usd = ?, precio_4h_usd = ?, precio_hora_extra_usd = ? WHERE tipo = ?',
      [pPernocta, pPernocta, p4h, pHoraExtra, tipo]
    );

    await registrarAuditoria(
      req.user.id,
      req.user.nombre,
      req.user.rol,
      'Catálogo Tarifas',
      `Actualizada tarifa de ${tipo}: Pernocta $${pPernocta}, 4H $${p4h}, Hora Extra $${pHoraExtra}`,
      req.ip
    );

    res.json({ success: true, message: `Tarifa de habitación ${tipo} actualizada correctamente.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar tarifa.' });
  }
});

// POST /api/clientes - Registrar un nuevo cliente directamente (CRM) (v3 - Fase 4)
app.post('/api/clientes', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('clientes')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Clientes.' });
  }

  const { nombre, ci, dni, tel, foto_ci, fechaNacimiento } = req.body;
  const numDoc = (ci || dni || '').trim();

  if (!nombre || !numDoc) {
    return res.status(400).json({ error: 'El nombre y la Cédula (CI) son obligatorios.' });
  }

  try {
    const existing = await db.get('SELECT id FROM clientes WHERE ci = ? OR dni = ?', [numDoc, numDoc]);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un cliente registrado con esta Cédula (CI).' });
    }

    const id = 'c_' + Date.now();
    await db.run(
      'INSERT INTO clientes (id, nombre, dni, ci, tel, visitas, vetado, monto_deuda_usd, motivo_veto, foto_ci, fechaNacimiento) VALUES (?, ?, ?, ?, ?, 0, 0, 0, "", ?, ?)',
      [id, nombre.trim(), numDoc, numDoc, tel ? tel.trim() : '', foto_ci || '', fechaNacimiento || '']
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Cliente Creado CRM', `Cliente ${nombre.trim()} (CI: ${numDoc}) registrado`, req.ip);

    res.json({ 
      success: true, 
      message: 'Cliente registrado correctamente en el CRM.', 
      cliente: { id, nombre: nombre.trim(), dni: numDoc, ci: numDoc, tel: tel ? tel.trim() : '', visitas: 0, vetado: 0, monto_deuda_usd: 0, foto_ci: foto_ci || '', fechaNacimiento: fechaNacimiento || '' } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar cliente.' });
  }
});

// PUT /api/clientes/:id - Editar detalles del cliente (Nombre, CI, Tel, Fecha Nacimiento, Foto CI)
app.put('/api/clientes/:id', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('clientes')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Clientes.' });
  }

  const { id } = req.params;
  const { nombre, ci, dni, tel, foto_ci, fechaNacimiento } = req.body;
  const numDoc = (ci || dni || '').trim();

  if (!nombre || !numDoc) {
    return res.status(400).json({ error: 'El nombre y la Cédula (CI) son obligatorios.' });
  }

  try {
    const duplicate = await db.get('SELECT id FROM clientes WHERE (ci = ? OR dni = ?) AND id != ?', [numDoc, numDoc, id]);
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otro cliente registrado con esta Cédula (CI).' });
    }

    await db.run(
      'UPDATE clientes SET nombre = ?, dni = ?, ci = ?, tel = ?, foto_ci = ?, fechaNacimiento = ? WHERE id = ?',
      [nombre.trim(), numDoc, numDoc, tel ? tel.trim() : '', foto_ci || '', fechaNacimiento || '', id]
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Cliente Editado CRM', `Cliente ${nombre.trim()} (CI: ${numDoc}) editado`, req.ip);

    res.json({ success: true, message: 'Cliente actualizado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cliente.' });
  }
});

// Global Error Handler for Payload & Syntax errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'La foto de la cédula es demasiado grande. Seleccione una imagen más liviana.' });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Formato de datos no válido.' });
  }
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.' });
});

// Serve frontend build in production
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// For SPA routing in production
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
