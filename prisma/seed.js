/* Inicializa una instalación vacía. Es idempotente. */
require('dotenv/config');

const bcrypt = require('bcrypt');
const { Client } = require('pg');

const cfg = {
  nombreEmpresa: process.env.SEED_EMPRESA_NOMBRE || 'FarmaPOS',
  ruc: process.env.SEED_EMPRESA_RUC || '20000000001',
  razonSocial: process.env.SEED_EMPRESA_RAZON_SOCIAL || 'FARMA POS S.A.C.',
  sucursal: process.env.SEED_SUCURSAL_NOMBRE || 'Sucursal Principal',
  direccion: process.env.SEED_SUCURSAL_DIRECCION || 'Av. Principal 100',
  adminNombre: process.env.SEED_ADMIN_NOMBRE || 'Administrador',
  adminEmail: (process.env.SEED_ADMIN_EMAIL || 'admin@farmapos.local').trim().toLowerCase(),
  adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin123*',
};

async function one(db, sql, values = []) {
  const { rows } = await db.query(sql, values);
  return rows[0];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    let empresa = await one(db, 'SELECT id FROM empresas WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1');
    if (!empresa) empresa = await one(db, `INSERT INTO empresas (nombre, ruc, razon_social, direccion, estado) VALUES ($1, $2, $3, $4, 'ACTIVO') RETURNING id`, [cfg.nombreEmpresa, cfg.ruc, cfg.razonSocial, cfg.direccion]);

    let rol = await one(db, "SELECT id FROM roles WHERE botica_id = $1 AND nombre = 'ADMINISTRADOR' AND deleted_at IS NULL ORDER BY created_at LIMIT 1", [empresa.id]);
    if (!rol) rol = await one(db, "INSERT INTO roles (botica_id, nombre) VALUES ($1, 'ADMINISTRADOR') RETURNING id", [empresa.id]);

    let sucursal = await one(db, 'SELECT id FROM sucursales WHERE empresa_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1', [empresa.id]);
    if (!sucursal) sucursal = await one(db, 'INSERT INTO sucursales (empresa_id, nombre, direccion) VALUES ($1, $2, $3) RETURNING id', [empresa.id, cfg.sucursal, cfg.direccion]);

    let usuario = await one(db, 'SELECT id FROM usuarios WHERE correo = $1 AND deleted_at IS NULL LIMIT 1', [cfg.adminEmail]);
    if (!usuario) {
      const hash = await bcrypt.hash(cfg.adminPassword, 12);
      usuario = await one(db, "INSERT INTO usuarios (botica_id, rol_id, nombre, correo, password_hash, estado) VALUES ($1, $2, $3, $4, $5, 'ACTIVO') RETURNING id", [empresa.id, rol.id, cfg.adminNombre, cfg.adminEmail, hash]);
    }

    await db.query(`INSERT INTO usuario_sucursales (usuario_id, botica_id, sucursal_id, es_principal, activo) VALUES ($1, $2, $3, true, true) ON CONFLICT (usuario_id, sucursal_id) DO UPDATE SET botica_id = EXCLUDED.botica_id, es_principal = true, activo = true, updated_at = CURRENT_TIMESTAMP`, [usuario.id, empresa.id, sucursal.id]);

    let caja = await one(db, 'SELECT id FROM cajas WHERE sucursal_id = $1 AND botica_id = $2 AND deleted_at IS NULL ORDER BY created_at LIMIT 1', [sucursal.id, empresa.id]);
    if (!caja) caja = await one(db, "INSERT INTO cajas (sucursal_id, botica_id, nombre, estado, created_by) VALUES ($1, $2, $3, 'CERRADA', $4) RETURNING id", [sucursal.id, empresa.id, `Caja Principal - ${cfg.sucursal}`, usuario.id]);
    await db.query('COMMIT');
    console.log(JSON.stringify({ ok: true, empresa_id: empresa.id, sucursal_id: sucursal.id, caja_id: caja.id, admin_email: cfg.adminEmail }, null, 2));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => { console.error('No se pudo inicializar la base de datos:', error.message); process.exitCode = 1; });
