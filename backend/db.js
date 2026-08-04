import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = process.env.DB_PATH || path.resolve('./hotel.db');

export async function initDb() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.get('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS habitaciones (
      num TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      estado TEXT NOT NULL,
      huesped TEXT,
      acomp TEXT,
      ingreso TEXT,
      salida TEXT,
      clienteId TEXT,
      clienteCi TEXT
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      ci TEXT,
      tel TEXT NOT NULL,
      visitas INTEGER DEFAULT 0,
      vetado INTEGER DEFAULT 0,
      monto_deuda_usd REAL DEFAULT 0,
      motivo_veto TEXT DEFAULT '',
      foto_ci TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      res TEXT NOT NULL,
      clienteId TEXT NOT NULL,
      nombreAcomp TEXT,
      numHabitacion TEXT NOT NULL,
      hora TEXT NOT NULL,
      FOREIGN KEY(numHabitacion) REFERENCES habitaciones(num),
      FOREIGN KEY(clienteId) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS caja (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      concepto TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo TEXT NOT NULL,
      hora TEXT NOT NULL,
      usuarioId TEXT,
      usuarioNombre TEXT,
      origen TEXT DEFAULT 'Hospedaje'
    );

    CREATE TABLE IF NOT EXISTS consumos (
      id TEXT PRIMARY KEY,
      numHabitacion TEXT NOT NULL,
      concepto TEXT NOT NULL,
      monto REAL NOT NULL,
      cantidad INTEGER DEFAULT 1,
      fecha TEXT NOT NULL,
      FOREIGN KEY(numHabitacion) REFERENCES habitaciones(num)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      numHabitacion TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT NOT NULL,
      prioridad TEXT NOT NULL,
      estado TEXT NOT NULL,
      usuarioCreadorId TEXT,
      usuarioCreadorNombre TEXT,
      usuarioAsignadoId TEXT,
      usuarioAsignadoNombre TEXT,
      fechaCreacion TEXT NOT NULL,
      fechaResolucion TEXT
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      permisos TEXT NOT NULL,
      activo INTEGER DEFAULT 1,
      hora_inicio TEXT DEFAULT '',
      hora_fin TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      usuario_nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT,
      fecha_hora TEXT NOT NULL,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      precio_venta REAL NOT NULL,
      stock INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tarifas (
      tipo TEXT PRIMARY KEY,
      precio_diario REAL NOT NULL DEFAULT 0,
      precio_4h_usd REAL NOT NULL DEFAULT 0,
      precio_pernocta_usd REAL NOT NULL DEFAULT 0,
      precio_hora_extra_usd REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entrega_turnos (
      id TEXT PRIMARY KEY,
      usuarioSalienteId TEXT NOT NULL,
      usuarioSalienteNombre TEXT NOT NULL,
      usuarioEntranteId TEXT,
      usuarioEntranteNombre TEXT,
      fechaHoraEntrega TEXT NOT NULL,
      saldoEfectivoUsd REAL DEFAULT 0,
      saldoEfectivoVes REAL DEFAULT 0,
      stockSnackbarConteo TEXT,
      lenceriaRecepcionConteo TEXT,
      llavesHerramientasConteo TEXT,
      novedades TEXT DEFAULT '',
      observacionesConfirmacion TEXT DEFAULT '',
      estado TEXT DEFAULT 'Pendiente Confirmación'
    );

    CREATE TABLE IF NOT EXISTS inventario_lenceria (
      id TEXT PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL,
      cantidad_total INTEGER NOT NULL DEFAULT 0,
      en_almacen INTEGER NOT NULL DEFAULT 0,
      en_lavanderia INTEGER NOT NULL DEFAULT 0,
      en_habitaciones INTEGER NOT NULL DEFAULT 0,
      de_baja INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventario_habitaciones (
      numHabitacion TEXT PRIMARY KEY,
      tv TEXT DEFAULT 'Operativo',
      control_tv TEXT DEFAULT 'Operativo',
      control_aire TEXT DEFAULT 'Operativo',
      control_musica TEXT DEFAULT 'Operativo',
      aire_acondicionado TEXT DEFAULT 'Operativo',
      nevera TEXT DEFAULT 'Operativo',
      espejo TEXT DEFAULT 'Operativo',
      llave TEXT DEFAULT 'Operativo',
      poceta TEXT DEFAULT 'Operativo',
      lavamanos TEXT DEFAULT 'Operativo',
      ducha TEXT DEFAULT 'Operativo',
      microondas TEXT DEFAULT 'Operativo',
      caja_fuerte TEXT DEFAULT 'Operativo',
      no_pertenece TEXT DEFAULT '',
      observaciones TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS inventario_habitaciones_historial (
      id TEXT PRIMARY KEY,
      numHabitacion TEXT NOT NULL,
      usuarioId TEXT,
      usuarioNombre TEXT,
      fecha TEXT NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT DEFAULT '',
      observaciones TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tabla_danos (
      id TEXT PRIMARY KEY,
      concepto TEXT UNIQUE NOT NULL,
      precio_usd REAL DEFAULT 0,
      tipo_tarifa TEXT DEFAULT 'fija'
    );
  `);

  // ALTER EXISTING TABLES TO ADD NEW COLUMNS (v5)
  try {
    await db.run(`ALTER TABLE caja ADD COLUMN origen TEXT DEFAULT 'Hospedaje'`);
    console.log("Columna 'origen' añadida a 'caja'");
  } catch (err) {
    // Column might already exist
  }

  // Seed data if empty
  const countHab = await db.get('SELECT COUNT(*) as count FROM habitaciones');
  if (countHab.count === 0) {
    console.log('Seeding initial database data...');

    // Seed habitaciones
    const habs = [
      { num: '101', tipo: 'Doble', estado: 'Ocupada', huesped: 'M. Vargas', acomp: 'L. Torres', ingreso: '14:30', salida: '12:00' },
      { num: '102', tipo: 'Matrimonial', estado: 'Libre', huesped: '', acomp: '', ingreso: '', salida: '' },
      { num: '103', tipo: 'Doble', estado: 'Limpieza', huesped: '', acomp: '', ingreso: '', salida: '' },
      { num: '104', tipo: 'Suite', estado: 'Ocupada', huesped: 'J. Doe', acomp: '', ingreso: '18:15', salida: '12:00' },
      { num: '105', tipo: 'Simple', estado: 'Libre', huesped: '', acomp: '', ingreso: '', salida: '' },
      { num: '106', tipo: 'Simple', estado: 'Libre', huesped: '', acomp: '', ingreso: '', salida: '' },
      { num: '107', tipo: 'Doble', estado: 'Reservada', huesped: 'C. Santana', acomp: 'M. Diaz', ingreso: '', salida: '' },
      { num: '108', tipo: 'Matrimonial', estado: 'Ocupada', huesped: 'R. Gomez', acomp: 'A. Silva', ingreso: '09:10', salida: '12:00' },
      { num: '109', tipo: 'Suite', estado: 'Libre', huesped: '', acomp: '', ingreso: '', salida: '' },
      { num: '110', tipo: 'Simple', estado: 'Ocupada', huesped: 'L. Medina', acomp: '', ingreso: '21:05', salida: '12:00' }
    ];

    for (const h of habs) {
      await db.run(
        `INSERT INTO habitaciones (num, tipo, estado, huesped, acomp, ingreso, salida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [h.num, h.tipo, h.estado, h.huesped, h.acomp, h.ingreso, h.salida]
      );
    }

    // Seed clientes
    const clis = [
      { id: 'c1', nombre: 'Laura Medina', dni: '76543210', tel: '999888777', visitas: 1 },
      { id: 'c2', nombre: 'Carlos Santana', dni: '45678912', tel: '912345678', visitas: 5 },
      { id: 'c3', nombre: 'Roberto Gómez', dni: '12345678', tel: '987654321', visitas: 2 },
      { id: 'c4', nombre: 'Juan Pérez', dni: '78901234', tel: '955444333', visitas: 0 },
      { id: 'c5', nombre: 'María Fernández', dni: '87654321', tel: '922111000', visitas: 8 }
    ];

    for (const c of clis) {
      await db.run(
        `INSERT INTO clientes (id, nombre, dni, tel, visitas) VALUES (?, ?, ?, ?, ?)`,
        [c.id, c.nombre, c.dni, c.tel, c.visitas]
      );
    }

    // Seed reservas
    const resvs = [
      { id: 'r1', res: 'RES-4091', clienteId: 'c4', nombreAcomp: '', numHabitacion: '102', hora: '10:00' },
      { id: 'r2', res: 'RES-9022', clienteId: 'c2', nombreAcomp: 'M. Diaz', numHabitacion: '107', hora: '15:30' },
      { id: 'r3', res: 'RES-1134', clienteId: 'c5', nombreAcomp: 'E. Ruiz', numHabitacion: '109', hora: '18:00' }
    ];

    for (const r of resvs) {
      await db.run(
        `INSERT INTO reservas (id, res, clienteId, nombreAcomp, numHabitacion, hora) VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, r.res, r.clienteId, r.nombreAcomp, r.numHabitacion, r.hora]
      );
    }

    // Seed caja
    const todayStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const txn = [
      { id: 't1', tipo: 'Ingreso', concepto: 'Apertura de Turno Recepción', monto: 300.00, metodo: 'Efectivo', hora: `${todayStr}, 07:30`, origen: 'Hospedaje', usuarioNombre: 'Administrador Root' },
      { id: 't2', tipo: 'Ingreso', concepto: 'Cobro Reserva M. Vargas - Hab 101', monto: 150.00, metodo: 'Punto de Venta', hora: `${todayStr}, 08:15`, origen: 'Hospedaje', usuarioNombre: 'Laura Medina' },
      { id: 't3', tipo: 'Egreso', concepto: 'Compra de Artículos de Limpieza', monto: 45.00, metodo: 'Efectivo', hora: `${todayStr}, 09:00`, origen: 'Egresos', usuarioNombre: 'Laura Medina' }
    ];

    for (const t of txn) {
      await db.run(
        `INSERT INTO caja (id, tipo, concepto, monto, metodo, hora, origen, usuarioNombre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.tipo, t.concepto, t.monto, t.metodo, t.hora, t.origen, t.usuarioNombre]
      );
    }

    console.log('Seeding finished successfully.');
  }

  // Seed usuarios (v2 - Fase 1) - Individual self-healing checks
  const adminPassHash = bcrypt.hashSync('adminMarte2026', 10);
  const adminUser = await db.get("SELECT id FROM usuarios WHERE username = 'admin'");
  if (!adminUser) {
    console.log('Seeding default admin user...');
    await db.run(
      `INSERT INTO usuarios (id, username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'u_admin',
        'admin',
        adminPassHash,
        'Administrador Root',
        'Administrador',
        JSON.stringify(['dashboard', 'habitaciones', 'reservas', 'caja', 'tienda', 'clientes', 'configuracion'])
      ]
    );
  } else {
    // Force-reset root admin password to ensure consistency and resolve lockouts across pulled updates
    await db.run("UPDATE usuarios SET password_hash = ? WHERE id = 'u_admin'", [adminPassHash]);
  }

  const recepUser = await db.get("SELECT id FROM usuarios WHERE username = 'recepcion'");
  if (!recepUser) {
    console.log('Seeding default reception user...');
    const recepPassHash = bcrypt.hashSync('marteRecepcion', 10);
    await db.run(
      `INSERT INTO usuarios (id, username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'u_recep',
        'recepcion',
        recepPassHash,
        'Recepcionista de Turno',
        'Personal',
        JSON.stringify(['habitaciones', 'reservas', 'clientes'])
      ]
    );
  }

  // Migraciones autocurativas para la tabla usuarios (v3 - Fase 3)
  try { await db.run("ALTER TABLE usuarios ADD COLUMN activo INTEGER DEFAULT 1"); } catch (e) {}
  try { await db.run("ALTER TABLE usuarios ADD COLUMN hora_inicio TEXT DEFAULT ''"); } catch (e) {}
  try { await db.run("ALTER TABLE usuarios ADD COLUMN hora_fin TEXT DEFAULT ''"); } catch (e) {}
  await db.run("UPDATE usuarios SET activo = 1 WHERE activo IS NULL");

  // Ensure default admin u_admin always has the full set of permissions including new modules
  await db.run(
    "UPDATE usuarios SET permisos = ? WHERE id = 'u_admin'",
    [JSON.stringify(['dashboard', 'habitaciones', 'reservas', 'caja', 'tienda', 'clientes', 'configuracion', 'usuarios', 'audit_logs'])]
  );


  // Seed configuracion (v3 - Fase 1) - Tasa del Día USD/VES
  const tasaConfig = await db.get("SELECT valor FROM configuracion WHERE clave = 'tasa_usd'");
  if (!tasaConfig) {
    await db.run("INSERT INTO configuracion (clave, valor) VALUES ('tasa_usd', '50.00')");
  }

  // Migraciones y Upsert para Tarifas Oficiales (v3 - Fase 1)
  try {
    await db.run("ALTER TABLE tarifas ADD COLUMN precio_4h_usd REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE tarifas ADD COLUMN precio_pernocta_usd REAL DEFAULT 0");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE tarifas ADD COLUMN precio_hora_extra_usd REAL DEFAULT 0");
  } catch (e) {}

  await db.run(`
    INSERT INTO tarifas (tipo, precio_diario, precio_4h_usd, precio_pernocta_usd, precio_hora_extra_usd) 
    VALUES ('Matrimonial', 10.00, 10.00, 20.00, 2.50)
    ON CONFLICT(tipo) DO UPDATE SET 
      precio_4h_usd = 10.00, 
      precio_pernocta_usd = 20.00, 
      precio_hora_extra_usd = 2.50
  `);

  await db.run(`
    INSERT INTO tarifas (tipo, precio_diario, precio_4h_usd, precio_pernocta_usd, precio_hora_extra_usd) 
    VALUES ('Mini Suite', 14.00, 14.00, 24.00, 3.00)
    ON CONFLICT(tipo) DO UPDATE SET 
      precio_4h_usd = 14.00, 
      precio_pernocta_usd = 24.00, 
      precio_hora_extra_usd = 3.00
  `);

  // Actualizar categorías de habitaciones existentes a los tipos oficiales
  await db.run("UPDATE habitaciones SET tipo = 'Matrimonial' WHERE tipo IN ('Simple', 'Doble')");
  await db.run("UPDATE habitaciones SET tipo = 'Mini Suite' WHERE tipo = 'Suite'");

  // Migraciones autocurativas para la tabla clientes y habitaciones (ci, vetado, monto_deuda_usd, motivo_veto, foto_ci, clienteId, clienteCi) (v3 - Fase 4)
  try { await db.run("ALTER TABLE habitaciones ADD COLUMN clienteId TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE habitaciones ADD COLUMN clienteCi TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN ci TEXT"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN vetado INTEGER DEFAULT 0"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN monto_deuda_usd REAL DEFAULT 0"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN motivo_veto TEXT DEFAULT ''"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN foto_ci TEXT DEFAULT ''"); } catch (e) {}
  try { await db.run("ALTER TABLE clientes ADD COLUMN fechaNacimiento TEXT DEFAULT ''"); } catch (e) {}
  await db.run("UPDATE clientes SET ci = dni WHERE ci IS NULL OR ci = ''");
  await db.run("UPDATE clientes SET vetado = 0 WHERE vetado IS NULL");

  // Auto-healing encoding cleanup for caja.metodo
  try {
    await db.run("UPDATE caja SET metodo = 'Pago Móvil' WHERE metodo LIKE '%M%vil%' AND metodo NOT LIKE '%Ref%'");
    await db.run("UPDATE caja SET metodo = 'Efectivo Bolívares' WHERE metodo LIKE '%Bol%vares%'");
    await db.run("UPDATE caja SET metodo = REPLACE(metodo, 'Mvil', 'Móvil')");
    await db.run("UPDATE caja SET metodo = REPLACE(metodo, 'Bolvares', 'Bolívares')");
  } catch (e) {}

  // Seed productos (v2 - Fase 2)
  const countProducts = await db.get('SELECT COUNT(*) as count FROM productos');
  if (countProducts.count === 0) {
    console.log('Seeding default product catalog...');
    await db.run("INSERT INTO productos (id, nombre, precio_venta, stock) VALUES ('p1', 'Agua Mineral 500ml', 3.00, 50)");
    await db.run("INSERT INTO productos (id, nombre, precio_venta, stock) VALUES ('p2', 'Gaseosa Coca-Cola 350ml', 4.50, 40)");
    await db.run("INSERT INTO productos (id, nombre, precio_venta, stock) VALUES ('p3', 'Cerveza Pilsen Callao 350ml', 7.00, 30)");
    await db.run("INSERT INTO productos (id, nombre, precio_venta, stock) VALUES ('p4', 'Papas Fritas Lays Clásica', 4.00, 25)");
    await db.run("INSERT INTO productos (id, nombre, precio_venta, stock) VALUES ('p5', 'Snack Frito Lays Queso', 4.00, 20)");
    console.log('Seeding default product catalog finished.');
  }

  // Seed inventario_lenceria (v4 - Fase 3)
  const countLenceria = await db.get('SELECT COUNT(*) as count FROM inventario_lenceria');
  if (countLenceria.count === 0) {
    console.log('Seeding default lenceria inventory...');
    const defaultLenceria = [
      { id: 'l1', nombre: 'Sábanas Matrimoniales', cantidad_total: 40, en_almacen: 15, en_lavanderia: 5, en_habitaciones: 20, de_baja: 0 },
      { id: 'l2', nombre: 'Toallas de Baño / Paños', cantidad_total: 50, en_almacen: 20, en_lavanderia: 10, en_habitaciones: 20, de_baja: 0 },
      { id: 'l3', nombre: 'Toallas de Mano', cantidad_total: 30, en_almacen: 15, en_lavanderia: 5, en_habitaciones: 10, de_baja: 0 },
      { id: 'l4', nombre: 'Almohadas', cantidad_total: 25, en_almacen: 5, en_lavanderia: 0, en_habitaciones: 20, de_baja: 0 },
      { id: 'l5', nombre: 'Protectores de Colchón', cantidad_total: 15, en_almacen: 3, en_lavanderia: 2, en_habitaciones: 10, de_baja: 0 },
      { id: 'l6', nombre: 'Colchones Matrimoniales/Suite', cantidad_total: 12, en_almacen: 2, en_lavanderia: 0, en_habitaciones: 10, de_baja: 0 }
    ];

    for (const item of defaultLenceria) {
      await db.run(
        `INSERT INTO inventario_lenceria (id, nombre, cantidad_total, en_almacen, en_lavanderia, en_habitaciones, de_baja)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.nombre, item.cantidad_total, item.en_almacen, item.en_lavanderia, item.en_habitaciones, item.de_baja]
      );
    }
  }

  // Auto-sync inventario_habitaciones with all rooms
  const allRooms = await db.all('SELECT num FROM habitaciones');
  for (const r of allRooms) {
    await db.run(
      `INSERT INTO inventario_habitaciones (numHabitacion) VALUES (?) ON CONFLICT(numHabitacion) DO NOTHING`,
      [r.num]
    );
  }

  // Seed tabla_danos (v4 - Fase 4)
  const countDanos = await db.get('SELECT COUNT(*) as count FROM tabla_danos');
  if (countDanos.count === 0) {
    console.log('Seeding default tabla_danos...');
    const defaultDanos = [
      { id: 'd1', concepto: 'Olores (Desinfección por cigarro/sustancias ilícitas)', precio_usd: 5.00, tipo_tarifa: 'fija' },
      { id: 'd2', concepto: 'Daño Directo a Paredes / Pintura (Velas/Licor/Manchas)', precio_usd: 4.00, tipo_tarifa: 'fija' },
      { id: 'd3', concepto: 'Daño / Mancha Profunda en Colchón', precio_usd: 4.00, tipo_tarifa: 'fija' },
      { id: 'd4', concepto: 'Reposición de Sábanas / Fundas Dañadas', precio_usd: 10.00, tipo_tarifa: 'cotizable' },
      { id: 'd5', concepto: 'Reposición de Toallas / Paños Dañados', precio_usd: 8.00, tipo_tarifa: 'cotizable' },
      { id: 'd6', concepto: 'Control Remoto de TV Perdido / Roto', precio_usd: 15.00, tipo_tarifa: 'cotizable' },
      { id: 'd7', concepto: 'Control Remoto de Aire Perdido / Roto', precio_usd: 15.00, tipo_tarifa: 'cotizable' },
      { id: 'd8', concepto: 'Espejo de Habitación Roto', precio_usd: 20.00, tipo_tarifa: 'cotizable' },
      { id: 'd9', concepto: 'Llave de Habitación Perdida', precio_usd: 10.00, tipo_tarifa: 'cotizable' },
      { id: 'd10', concepto: 'Daño General a Equipamiento / Artefactos', precio_usd: 25.00, tipo_tarifa: 'cotizable' }
    ];

    for (const d of defaultDanos) {
      await db.run(
        `INSERT INTO tabla_danos (id, concepto, precio_usd, tipo_tarifa) VALUES (?, ?, ?, ?)`,
        [d.id, d.concepto, d.precio_usd, d.tipo_tarifa]
      );
    }
  }

  // Sincronizar estados de habitaciones con reservas activas (Autocuración de Consistencia)
  // 1. Si la habitación está marcada como 'Reservada' pero no tiene reserva activa, cambiarla a 'Libre'
  await db.run(`
    UPDATE habitaciones 
    SET estado = 'Libre', huesped = '' 
    WHERE estado = 'Reservada' AND num NOT IN (SELECT numHabitacion FROM reservas)
  `);

  // 2. Si la habitación tiene una reserva activa y está marcada como 'Libre', cambiarla a 'Reservada'
  const activeReservations = await db.all(`
    SELECT r.numHabitacion, c.nombre 
    FROM reservas r 
    JOIN clientes c ON r.clienteId = c.id
  `);

  for (const resv of activeReservations) {
    const parts = resv.nombre.trim().split(/\s+/);
    let formattedName = '';
    if (parts.length > 0) {
      const firstInitial = parts[0][0] ? parts[0][0].toUpperCase() + '.' : '';
      const rest = parts.slice(1).join(' ');
      formattedName = `${firstInitial} ${rest}`.trim();
    }
    
    await db.run(
      `UPDATE habitaciones 
       SET estado = 'Reservada', huesped = ? 
       WHERE num = ? AND estado = 'Libre'`,
      [formattedName, resv.numHabitacion]
    );
  }

  // Migraciones autocurativas para la tabla caja (v2 - Fase 5 & v4 - Fase 1)
  try {
    await db.run("ALTER TABLE caja ADD COLUMN usuarioId TEXT");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE caja ADD COLUMN usuarioNombre TEXT");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE caja ADD COLUMN validado INTEGER DEFAULT 0");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE caja ADD COLUMN fecha_validacion TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE caja ADD COLUMN usuario_validador_nombre TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }

  // Migraciones autocurativas para la tabla consumos (v7 - Pre-Consumos Minimarket)
  try {
    await db.run("ALTER TABLE consumos ADD COLUMN cliente_ci TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE consumos ADD COLUMN cliente_nombre TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE consumos ADD COLUMN estado TEXT DEFAULT 'cargado_habitacion'");
  } catch (e) { /* Columna ya existe */ }

  // Migraciones autocurativas para la tabla entrega_turnos (Corrección de cierres por Super Admin)
  try {
    await db.run("ALTER TABLE entrega_turnos ADD COLUMN solicitudCorreccion INTEGER DEFAULT 0");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE entrega_turnos ADD COLUMN motivoCorreccion TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE entrega_turnos ADD COLUMN solicitudSaldoUsd REAL DEFAULT 0");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE entrega_turnos ADD COLUMN solicitudSaldoVes REAL DEFAULT 0");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE entrega_turnos ADD COLUMN estadoCorreccion TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }

  // Migraciones autocurativas para la tabla inventario_habitaciones (Requerimiento 3)
  try {
    await db.run("ALTER TABLE inventario_habitaciones ADD COLUMN microondas TEXT DEFAULT 'Operativo'");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE inventario_habitaciones ADD COLUMN caja_fuerte TEXT DEFAULT 'Operativo'");
  } catch (e) { /* Columna ya existe */ }
  try {
    await db.run("ALTER TABLE inventario_habitaciones ADD COLUMN no_pertenece TEXT DEFAULT ''");
  } catch (e) { /* Columna ya existe */ }

  return db;
}
