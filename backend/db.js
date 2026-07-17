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
      salida TEXT
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      tel TEXT NOT NULL,
      visitas INTEGER DEFAULT 0
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
      hora TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL,
      permisos TEXT NOT NULL
    );
  `);

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
    const txn = [
      { id: 't1', tipo: 'Ingreso', concepto: 'Apertura de Turno Recepción', monto: 300.00, metodo: 'Efectivo', hora: '07:30' },
      { id: 't2', tipo: 'Ingreso', concepto: 'Cobro Reserva M. Vargas - Hab 101', monto: 150.00, metodo: 'Tarjeta', hora: '08:15' },
      { id: 't3', tipo: 'Egreso', concepto: 'Compra de Artículos de Limpieza', monto: 45.00, metodo: 'Efectivo', hora: '09:00' }
    ];

    for (const t of txn) {
      await db.run(
        `INSERT INTO caja (id, tipo, concepto, monto, metodo, hora) VALUES (?, ?, ?, ?, ?, ?)`,
        [t.id, t.tipo, t.concepto, t.monto, t.metodo, t.hora]
      );
    }

    console.log('Seeding finished successfully.');
  }

  // Seed usuarios (v2 - Fase 1)
  const countUsers = await db.get('SELECT COUNT(*) as count FROM usuarios');
  if (countUsers.count === 0) {
    console.log('Seeding default users...');
    const adminPassHash = bcrypt.hashSync('adminMarte2026', 10);
    const recepPassHash = bcrypt.hashSync('marteRecepcion', 10);
    
    await db.run(
      `INSERT INTO usuarios (id, username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'u_admin',
        'admin',
        adminPassHash,
        'Administrador Root',
        'Administrador',
        JSON.stringify(['dashboard', 'habitaciones', 'reservas', 'caja', 'clientes'])
      ]
    );

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
    console.log('Seeding default users finished.');
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

  return db;
}
