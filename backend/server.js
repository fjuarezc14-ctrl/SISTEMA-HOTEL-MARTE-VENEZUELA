import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretMarteHotel2026';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

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

// Helper: Format full name to reception shorthand (e.g., "Laura Medina" -> "L. Medina")
function formatGuestName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const firstInitial = parts[0][0] ? parts[0][0].toUpperCase() + '.' : '';
  const rest = parts.slice(1).join(' ');
  return `${firstInitial} ${rest}`.trim();
}

// ====================================================
// SEGURIDAD Y AUTH MIDDLEWARE (v2 - Fase 1)
// ====================================================
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Falta token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validate if user exists in database (Immediate session revocation on user deletion)
    const user = await db.get('SELECT id, username, nombre, rol, permisos FROM usuarios WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o sesión revocada.' });
    }
    
    req.user = user;
    req.user.permisos = JSON.parse(user.permisos || '[]');
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

// POST /api/auth/login - Autenticar usuario y firmar token
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Debe ingresar usuario y contraseña.' });
  }

  try {
    const user = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        permisos: JSON.parse(user.permisos || '[]')
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
    const users = await db.all('SELECT id, username, nombre, rol, permisos FROM usuarios');
    const parsedUsers = users.map(u => ({
      ...u,
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
  const { username, password, nombre, rol, permisos } = req.body;
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

    await db.run(
      'INSERT INTO usuarios (id, username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, hash, nombre, rol, permsStr]
    );

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
  const { nombre, rol, permisos, password } = req.body;

  if (id === 'u_admin') {
    return res.status(400).json({ error: 'El administrador por defecto es inmutable y no puede modificarse.' });
  }

  try {
    const user = await db.get('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await db.run(
        'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ?, password_hash = ? WHERE id = ?',
        [nombre, rol, JSON.stringify(permisos), hash, id]
      );
    } else {
      await db.run(
        'UPDATE usuarios SET nombre = ?, rol = ?, permisos = ? WHERE id = ?',
        [nombre, rol, JSON.stringify(permisos), id]
      );
    }

    res.json({ success: true, message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (Solo Admin - Cierre de sesion inmediato en todos los disp.)
app.delete('/api/usuarios/:id', requireAuth, async (req, res) => {
  if (req.user.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }
  const { id } = req.params;

  if (id === 'u_admin') {
    return res.status(400).json({ error: 'El administrador por defecto es inmutable y no puede eliminarse.' });
  }

  try {
    const user = await db.get('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await db.run('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario eliminado correctamente. Todas sus sesiones han sido revocadas.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// 1. GET /api/state - Fetch the entire application state
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const habitaciones = await db.all('SELECT * FROM habitaciones');
    
    // Joint query to fetch reservation details along with the client's information
    const reservasRaw = await db.all(`
      SELECT r.*, c.nombre as clienteNombre, c.dni as clienteDni, c.tel as clienteTel, c.visitas as clienteVisitas
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
        tel: r.clienteTel,
        visitas: r.clienteVisitas
      }
    }));

    const clientes = await db.all('SELECT * FROM clientes');
    const caja = await db.all('SELECT * FROM caja');
    const consumos = await db.all('SELECT * FROM consumos');
    const productos = await db.all('SELECT * FROM productos');
    const tarifas = await db.all('SELECT * FROM tarifas');

    res.json({ habitaciones, reservas, clientes, caja, consumos, productos, tarifas });
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. POST /api/checkin-directo - Process immediate walk-in check-in
app.post('/api/checkin-directo', requireAuth, async (req, res) => {
  const { dni, nombre, tel, numHabitacion, nomAcomp, dniAcomp, monto, metodo, comprobante } = req.body;

  if (!dni || !nombre || !tel || !numHabitacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // 1. Check if client exists, otherwise create
    let cliente = await db.get('SELECT * FROM clientes WHERE dni = ?', [dni]);
    const clientId = cliente ? cliente.id : 'c_' + Date.now();
    
    if (!cliente) {
      await db.run(
        'INSERT INTO clientes (id, nombre, dni, tel, visitas) VALUES (?, ?, ?, ?, ?)',
        [clientId, nombre.trim(), dni.trim(), tel.trim(), 1]
      );
    } else {
      await db.run(
        'UPDATE clientes SET visitas = visitas + 1, nombre = ?, tel = ? WHERE id = ?',
        [nombre.trim(), tel.trim(), clientId]
      );
    }

    // 2. Update room status to Ocupada
    const formattedName = formatGuestName(nombre);
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', huesped = ?, acomp = ?, ingreso = ?, salida = '12:00' 
       WHERE num = ?`,
      [formattedName, nomAcomp ? nomAcomp.trim() : '', getHoraActual(), numHabitacion]
    );

    // 3. Register transaction in Cash register if amount > 0
    const finalMonto = parseFloat(monto) || 0;
    if (finalMonto > 0) {
      const transactionId = 't_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transactionId, 
          'Ingreso', 
          `Hospedaje Check-In Hab ${numHabitacion} (${nombre.trim()}) - ${comprobante}`, 
          finalMonto, 
          metodo, 
          getHoraActual()
        ]
      );
    }

    res.json({ success: true, message: 'Check-in directo registrado correctamente' });
  } catch (error) {
    console.error('Error processing walk-in check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/reservar - Bloquea una habitación y guarda la reserva (Fase 3)
app.post('/api/reservar', requireAuth, async (req, res) => {
  const { numHabitacion, dni, nombre, tel, nomAcomp, dniAcomp, hora, monto, metodo, comprobante } = req.body;

  if (!numHabitacion || !dni || !nombre || !tel || !hora) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // 1. Check/Create guest
    let cliente = await db.get('SELECT * FROM clientes WHERE dni = ?', [dni]);
    const clientId = cliente ? cliente.id : 'c_' + Date.now();

    if (!cliente) {
      await db.run(
        'INSERT INTO clientes (id, nombre, dni, tel, visitas) VALUES (?, ?, ?, ?, ?)',
        [clientId, nombre.trim(), dni.trim(), tel.trim(), 0]
      );
    } else {
      await db.run(
        'UPDATE clientes SET nombre = ?, tel = ? WHERE id = ?',
        [nombre.trim(), tel.trim(), clientId]
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
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Adelanto Reserva Hab ${numHabitacion} (${nombre.trim()}) - ${comprobante}`,
          finalMonto,
          metodo,
          getHoraActual()
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

    // Increment guest visits
    await db.run('UPDATE clientes SET visitas = visitas + 1 WHERE id = ?', [reserva.clienteId]);

    // Update room status to Ocupada
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Ocupada', acomp = ?, ingreso = ?, salida = '12:00' 
       WHERE num = ?`,
      [reserva.nombreAcomp || '', getHoraActual(), numHabitacion]
    );

    // Delete reservation
    await db.run('DELETE FROM reservas WHERE id = ?', [reserva.id]);

    res.json({ success: true, message: 'Check-In de reserva procesado correctamente' });
  } catch (error) {
    console.error('Error confirming reservation check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/checkout - Procesar check-out de la habitación (Fase 6)
app.post('/api/checkout', requireAuth, async (req, res) => {
  const { numHabitacion, penalidad, detallePenalidad, montoConsumos, montoHabitacion, metodoPago } = req.body;

  if (!numHabitacion) {
    return res.status(400).json({ error: 'Falta número de habitación' });
  }

  try {
    const room = await db.get('SELECT * FROM habitaciones WHERE num = ?', [numHabitacion]);
    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    const huespedNombre = room.huesped || 'Huésped';
    const metodo = metodoPago || 'Efectivo';

    // 1. Update room status to Limpieza
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Limpieza', huesped = '', acomp = '', ingreso = '', salida = '' 
       WHERE num = ?`,
      [numHabitacion]
    );

    // 2. Register penalty in Caja if penalty > 0
    const finalPenalidad = parseFloat(penalidad) || 0;
    if (finalPenalidad > 0) {
      const transactionId = 't_pen_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Penalidad Check-Out Hab ${numHabitacion} - ${detallePenalidad || 'Incumplimiento de checklist'}`,
          finalPenalidad,
          metodo,
          getHoraActual()
        ]
      );
    }

    // 3. Register room balance payment in Caja if > 0
    const finalHab = parseFloat(montoHabitacion) || 0;
    if (finalHab > 0) {
      const transactionId = 't_hab_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Saldo Pendiente Hab ${numHabitacion} (${huespedNombre})`,
          finalHab,
          metodo,
          getHoraActual()
        ]
      );
    }

    // 4. Register consumption consolidated payment in Caja if > 0
    const finalConsumos = parseFloat(montoConsumos) || 0;
    if (finalConsumos > 0) {
      const transactionId = 't_cns_' + Date.now();
      await db.run(
        'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transactionId,
          'Ingreso',
          `Cobro Consumos Extras Hab ${numHabitacion} (${huespedNombre})`,
          finalConsumos,
          metodo,
          getHoraActual()
        ]
      );
    }

    // 5. Delete all consumptions of the room
    await db.run('DELETE FROM consumos WHERE numHabitacion = ?', [numHabitacion]);

    res.json({ success: true, message: 'Check-Out finalizado correctamente. Habitación enviada a limpieza y consumos liquidados.' });
  } catch (error) {
    console.error('Error performing checkout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. POST /api/caja - Registro manual de movimientos de caja (Fase 4)
app.post('/api/caja', requireAuth, async (req, res) => {
  const { tipo, concepto, monto, metodo } = req.body;

  if (!tipo || !concepto || !monto || !metodo) {
    return res.status(400).json({ error: 'Faltan campos de la transacción' });
  }

  try {
    const transactionId = 't_' + Date.now();
    await db.run(
      'INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)',
      [transactionId, tipo, concepto.trim(), parseFloat(monto), metodo, getHoraActual()]
    );

    res.json({ success: true, message: 'Movimiento de caja registrado' });
  } catch (error) {
    console.error('Error logging manual transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. POST /api/limpieza-terminada - Change room status from Limpieza to Libre
app.post('/api/limpieza-terminada', requireAuth, async (req, res) => {
  const { numHabitacion } = req.body;

  if (!numHabitacion) {
    return res.status(400).json({ error: 'Falta número de habitación' });
  }

  try {
    await db.run(`UPDATE habitaciones SET estado = 'Libre' WHERE num = ? AND estado = 'Limpieza'`, [numHabitacion]);
    res.json({ success: true, message: `Habitación ${numHabitacion} ahora está libre` });
  } catch (error) {
    console.error('Error completing room cleaning:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// 9. POST /api/consumos - Agregar un consumo a una habitación (Fase 5)
app.post('/api/consumos', requireAuth, async (req, res) => {
  const { numHabitacion, concepto, monto, cantidad } = req.body;
  if (!numHabitacion || !concepto || !monto) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const id = 'cns_' + Date.now();
    const cant = parseInt(cantidad) || 1;
    
    // Obtener la hora actual en formato HH:MM
    const now = new Date();
    const fecha = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await db.run(
      'INSERT INTO consumos (id, numHabitacion, concepto, monto, cantidad, fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [id, numHabitacion, concepto.trim(), parseFloat(monto), cant, fecha]
    );
    res.json({ success: true, message: 'Consumo registrado correctamente' });
  } catch (error) {
    console.error('Error adding consumo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. DELETE /api/consumos/:id - Eliminar un consumo por ID (Fase 5)
app.delete('/api/consumos/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM consumos WHERE id = ?', [id]);
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
  if (!req.user.permisos.includes('configuracion')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Catálogo y Tarifas.' });
  }
  const { tipo } = req.params;
  const { precio_diario } = req.body;

  try {
    const rate = await db.get('SELECT tipo FROM tarifas WHERE tipo = ?', [tipo]);
    if (!rate) {
      return res.status(404).json({ error: 'Tipo de tarifa no encontrada.' });
    }

    const precio = parseFloat(precio_diario);
    if (isNaN(precio) || precio <= 0) {
      return res.status(400).json({ error: 'Precio diario inválido.' });
    }

    await db.run('UPDATE tarifas SET precio_diario = ? WHERE tipo = ?', [precio, tipo]);
    res.json({ success: true, message: `Tarifa de habitación ${tipo} actualizada a S/ ${precio.toFixed(2)}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar tarifa.' });
  }
});

// POST /api/clientes - Registrar un nuevo cliente directamente (CRM) (v2 - Fase 3)
app.post('/api/clientes', requireAuth, async (req, res) => {
  if (!req.user.permisos.includes('clientes')) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere el permiso del módulo Clientes.' });
  }

  const { nombre, dni, tel } = req.body;
  if (!nombre || !dni) {
    return res.status(400).json({ error: 'El nombre y el DNI son obligatorios.' });
  }

  try {
    const existing = await db.get('SELECT id FROM clientes WHERE dni = ?', [dni.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un cliente registrado con este DNI.' });
    }

    const id = 'c_' + Date.now();
    await db.run(
      'INSERT INTO clientes (id, nombre, dni, tel, visitas) VALUES (?, ?, ?, ?, 0)',
      [id, nombre.trim(), dni.trim(), tel ? tel.trim() : '']
    );

    res.json({ 
      success: true, 
      message: 'Cliente registrado correctamente en el CRM.', 
      cliente: { id, nombre: nombre.trim(), dni: dni.trim(), tel: tel ? tel.trim() : '', visitas: 0 } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar cliente.' });
  }
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
