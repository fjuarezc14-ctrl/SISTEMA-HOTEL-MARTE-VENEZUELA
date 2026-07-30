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

// Helper: Get current time as HH:MM
function getHoraActual() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper: Get current date & time as DD/MM/YYYY, HH:MM for precise filtering
function getFechaHoraActual() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

// Helper: Format full name to reception shorthand (e.g., "Laura Medina" -> "L. Medina")
function formatGuestName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const firstInitial = parts[0][0] ? parts[0][0].toUpperCase() + '.' : '';
  const rest = parts.slice(1).join(' ');
  return `${firstInitial} ${rest}`.trim();
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

// GET /api/usuarios - Listar usuarios (Solo Admin)
app.get('/api/usuarios', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
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
    const tarifas = await db.all('SELECT * FROM tarifas');
    const tickets = await db.all('SELECT * FROM tickets ORDER BY fechaCreacion DESC');
    const entregaTurnos = await db.all('SELECT * FROM entrega_turnos ORDER BY fechaHoraEntrega DESC');
    const inventarioLenceria = await db.all('SELECT * FROM inventario_lenceria');
    const inventarioHabitaciones = await db.all('SELECT * FROM inventario_habitaciones');
    const tablaDanos = await db.all('SELECT * FROM tabla_danos');

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
      tablaDanos
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

// Helper: Calcular hora de salida según modalidad (4 Horas o Pernocta 11:00 AM)
function calcularHoraSalida(modalidad) {
  if (modalidad === 'pernocta') {
    return '11:00 AM (Mañana)';
  }
  const now = new Date();
  const future = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const hh = String(future.getHours()).padStart(2, '0');
  const mm = String(future.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getDigitsOnly(str) {
  return (str || '').replace(/[^0-9]/g, '');
}

// 2. POST /api/checkin-directo - Process immediate walk-in check-in (v3 - Fase 1)
app.post('/api/checkin-directo', requireAuth, async (req, res) => {
  const { ci, dni, nombre, tel, numHabitacion, nomAcomp, ciAcomp, dniAcomp, monto, metodo, comprobante, modalidad, esMenor } = req.body;
  const numDoc = (ci || dni || '').trim();

  if (!numDoc || !nombre || !tel || !numHabitacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (CI/Documento, Nombre, Teléfono, Habitación).' });
  }

  try {
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
    
    if (cliente && cliente.vetado === 1 && cliente.monto_deuda_usd > 0) {
      return res.status(400).json({ 
        error: `El cliente ${cliente.nombre} (CI: ${cliente.ci || cliente.dni}) se encuentra VETADO por una deuda pendiente de $${cliente.monto_deuda_usd.toFixed(2)} USD. Motivo: ${cliente.motivo_veto || 'Daños en estadía anterior'}`,
        vetado: true,
        clienteVetado: cliente
      });
    }

    const clientId = cliente ? cliente.id : 'c_' + Date.now();
    
    if (!cliente) {
      await db.run(
        'INSERT INTO clientes (id, nombre, dni, ci, tel, visitas) VALUES (?, ?, ?, ?, ?, ?)',
        [clientId, nombre.trim(), numDoc, numDoc, tel.trim(), 1]
      );
    } else {
      await db.run(
        'UPDATE clientes SET visitas = visitas + 1, nombre = ?, tel = ?, ci = ? WHERE id = ?',
        [nombre.trim(), tel.trim(), numDoc, clientId]
      );
    }

    // 2. Calculate Checkout Time (4 Hours vs Pernocta 11:00 AM)
    const salidaCalculada = calcularHoraSalida(modalidad);
    const formattedName = formatGuestName(nombre);
    let acompText = nomAcomp ? nomAcomp.trim() : '';
    if (esMenor) {
      acompText += ' (Menor de edad - Sin recargo)';
    }

    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', huesped = ?, acomp = ?, ingreso = ?, salida = ?, clienteId = ?, clienteCi = ? 
       WHERE num = ?`,
      [formattedName, acompText, getHoraActual(), salidaCalculada, clientId, numDoc, numHabitacion]
    );

    // 3. Register transaction in Cash register if amount > 0
    const finalMonto = parseFloat(monto) || 0;
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId, 
          'Ingreso', 
          `Hospedaje Check-In Hab ${numHabitacion} (${nombre.trim()}) [${modalidad === 'pernocta' ? 'Pernocta' : '4 Horas'}] - ${comprobante || 'Sin Comprobante'}`, 
          finalMonto, 
          metodo || 'Efectivo Bolívares', 
          getFechaHoraActual(),
          req.user.id,
          req.user.nombre,
          'Hospedaje'
        ]
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

    const finalMonto = parseFloat(monto) || 0;
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      const metodoTexto = codigoVerificacion 
        ? `${metodo} (Ref: ${codigoVerificacion})` 
        : metodo;

      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Recargo 3er Huésped (50%) Hab ${num} (${acompName})`,
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

// 3. POST /api/reservar - Bloquea una habitación y guarda la reserva (Fase 3)
app.post('/api/reservar', requireAuth, async (req, res) => {
  const { numHabitacion, ci, dni, nombre, tel, nomAcomp, ciAcomp, dniAcomp, hora, monto, metodo, comprobante } = req.body;
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

    if (cliente && cliente.vetado === 1 && cliente.monto_deuda_usd > 0) {
      return res.status(400).json({ 
        error: `El cliente ${cliente.nombre} (CI: ${cliente.ci || cliente.dni}) se encuentra VETADO por una deuda pendiente de $${cliente.monto_deuda_usd.toFixed(2)} USD. Motivo: ${cliente.motivo_veto || 'Daños en estadía anterior'}`,
        vetado: true,
        clienteVetado: cliente
      });
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
    await db.run(
      'INSERT INTO reservas (id, res, clienteId, nombreAcomp, numHabitacion, hora) VALUES (?, ?, ?, ?, ?, ?)',
      [resId, resCode, clientId, nomAcomp ? nomAcomp.trim() : '', numHabitacion, hora]
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

    // Fetch guest CI
    const cliente = await db.get('SELECT ci, dni FROM clientes WHERE id = ?', [reserva.clienteId]);
    const clientCi = cliente ? (cliente.ci || cliente.dni) : '';

    // Increment guest visits
    await db.run('UPDATE clientes SET visitas = visitas + 1 WHERE id = ?', [reserva.clienteId]);

    // Update room status to Ocupada with Pernocta checkout time (11:00 AM)
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', acomp = ?, ingreso = ?, salida = '11:00 AM (Mañana)', clienteId = ?, clienteCi = ? 
       WHERE num = ?`,
      [reserva.nombreAcomp || '', getHoraActual(), reserva.clienteId, clientCi, numHabitacion]
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
    detallePenalidad,
    vetarCliente,
    clienteId,
    clienteCi,
    montoDeuda,
    motivoVeto
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

    // 1. Update room status to Limpieza and clear active guest details
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Limpieza', huesped = '', acomp = '', ingreso = '', salida = '', clienteId = '', clienteCi = '' 
       WHERE num = ?`,
      [numHabitacion]
    );

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

    // 4. Register consumption consolidated payment in Caja if > 0
    const finalConsumos = parseFloat(montoConsumos) || 0;
    if (finalConsumos > 0) {
      const transactionId = 't_cns_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Consumos Extras Hab ${numHabitacion} (${huespedNombre})`,
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
    const list = await db.all('SELECT * FROM entrega_turnos ORDER BY fechaHoraEntrega DESC');
    res.json(list);
  } catch (error) {
    console.error('Error fetching entrega_turnos:', error);
    res.status(500).json({ error: 'Error al consultar entregas de turno.' });
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
  const { tv, control_tv, control_aire, control_musica, aire_acondicionado, nevera, espejo, llave, poceta, lavamanos, ducha, observaciones } = req.body;

  try {
    await db.run(
      `INSERT INTO inventario_habitaciones (
        numHabitacion, tv, control_tv, control_aire, control_musica, aire_acondicionado, nevera, espejo, llave, poceta, lavamanos, ducha, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        saldoEfectivoUsd, saldoEfectivoVes, stockSnackbarConteo, 
        lenceriaRecepcionConteo, llavesHerramientasConteo, novedades, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        req.user.nombre,
        fechaHora,
        parseFloat(saldoEfectivoUsd || 0),
        parseFloat(saldoEfectivoVes || 0),
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
  const { items, pagos, clienteNombre, clienteCi, comprobante } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito de compras está vacío.' });
  }

  if (!pagos || (Array.isArray(pagos) && pagos.length === 0)) {
    return res.status(400).json({ error: 'Se debe especificar al menos un método de pago.' });
  }

  try {
    const totalUsd = items.reduce((sum, item) => sum + (parseFloat(item.precio_venta) * parseInt(item.cantidad)), 0);
    const saleCode = 'VTA-' + Math.floor(Math.random() * 90000 + 10000);

    // 1. Verify stock for all items
    for (const item of items) {
      const prod = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
      if (!prod) {
        return res.status(404).json({ error: `El producto "${item.nombre}" ya no existe en el catálogo.` });
      }
      if (prod.stock < item.cantidad) {
        return res.status(400).json({ error: `Stock insuficiente para "${item.nombre}". Stock disponible: ${prod.stock}` });
      }
    }

    // Deduct stock
    for (const item of items) {
      await db.run('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.id]);
    }

    // 2. Prepare payment breakdown
    const pagosList = Array.isArray(pagos) ? pagos : [pagos];
    const isPagoMixto = pagosList.length > 1;
    
    let conceptoItems = items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
    let clienteInfo = clienteNombre ? ` - Cliente: ${clienteNombre.trim()}` : '';
    if (clienteCi) clienteInfo += ` (CI: ${clienteCi.trim()})`;

    // Insert cash entries in `caja` for each payment method in the breakdown
    for (const pago of pagosList) {
      const montoPago = parseFloat(pago.monto_usd) || 0;
      if (montoPago > 0) {
        const transId = 't_pos_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        let conceptoCaja = `Venta Tienda #${saleCode} (${conceptoItems})${clienteInfo} [${comprobante || 'Ticket Interno'}]`;
        if (isPagoMixto) {
          conceptoCaja += ` (PAGO MIXTO: $${montoPago.toFixed(2)} USD vía ${pago.metodo})`;
        }

        await db.run(
          'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, usuarioId, usuarioNombre, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            transId,
            'Ingreso',
            conceptoCaja,
            montoPago,
            pago.metodo || 'Efectivo Bolívares',
            getFechaHoraActual(),
            req.user.id,
            req.user.nombre,
            'Market'
          ]
        );
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

// 8. GET /api/consumos/:numHabitacion - Listar consumos de una habitación (Fase 5)
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

    if (catalogProduct) {
      // 1. Bloquear al precio de venta oficial del catálogo
      finalMonto = catalogProduct.precio_venta;

      // 2. Validar disponibilidad de stock
      if (catalogProduct.stock < cant) {
        return res.status(400).json({ 
          error: `Stock insuficiente para "${catalogProduct.nombre}". Quedan ${catalogProduct.stock} unidad(es) en inventario.` 
        });
      }

      // 3. Descontar el stock en la base de datos
      await db.run('UPDATE productos SET stock = stock - ? WHERE id = ?', [cant, catalogProduct.id]);
    }

    const id = 'cns_' + Date.now();
    const now = new Date();
    const fecha = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await db.run(
      'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [id, numHabitacion, catalogProduct ? catalogProduct.nombre : concepto.trim(), finalMonto, cant, fecha]
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
      const catalogProduct = await db.get('SELECT id FROM productos WHERE LOWER(nombre) = LOWER(?)', [consumo.concepto.trim()]);
      if (catalogProduct) {
        await db.run('UPDATE productos SET stock = stock + ? WHERE id = ?', [consumo.cantidad, catalogProduct.id]);
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
  const { nombre, precio_venta, stock } = req.body;
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
    const stk = parseInt(stock) || 0;

    await db.run(
      'INSERT INTO productos (id, nombre, precio_venta, stock) VALUES (?, ?, ?, ?)',
      [id, nombre.trim(), precio, stk]
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
  const { nombre, precio_venta, stock } = req.body;

  try {
    const item = await db.get('SELECT id FROM productos WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const precio = parseFloat(precio_venta);
    const stk = parseInt(stock);

    await db.run(
      'UPDATE productos SET nombre = ?, precio_venta = ?, stock = ? WHERE id = ?',
      [nombre.trim(), precio, stk, id]
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

  const { nombre, ci, dni, tel, foto_ci } = req.body;
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
      'INSERT INTO clientes (id, nombre, dni, ci, tel, visitas, vetado, monto_deuda_usd, motivo_veto, foto_ci) VALUES (?, ?, ?, ?, ?, 0, 0, 0, "", ?)',
      [id, nombre.trim(), numDoc, numDoc, tel ? tel.trim() : '', foto_ci || '']
    );

    await registrarAuditoria(req.user.id, req.user.nombre, req.user.rol, 'Cliente Creado CRM', `Cliente ${nombre.trim()} (CI: ${numDoc}) registrado`, req.ip);

    res.json({ 
      success: true, 
      message: 'Cliente registrado correctamente en el CRM.', 
      cliente: { id, nombre: nombre.trim(), dni: numDoc, ci: numDoc, tel: tel ? tel.trim() : '', visitas: 0, vetado: 0, monto_deuda_usd: 0, foto_ci: foto_ci || '' } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar cliente.' });
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
