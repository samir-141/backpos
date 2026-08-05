/* Datos iniciales del módulo de facturación electrónica SUNAT. Es idempotente.
   Crea las series de prueba (BETA) para la empresa/sucursal principal.
   Los catálogos SUNAT (tipo comprobante, afectación IGV, unidad de medida, etc.)
   viven como enums en src/modules/facturacion/sunat/catalogos.enum.ts (no hay
   tablas catálogo en esta BD). */
require('dotenv/config');

const { Client } = require('pg');

const SERIES = [
  { tipo_documento: 'BOLETA', serie: 'B001' },
  { tipo_documento: 'FACTURA', serie: 'F001' },
  { tipo_documento: 'NOTA_CREDITO', serie: 'BC01' },
  { tipo_documento: 'NOTA_DEBITO', serie: 'FC01' },
];

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

    const empresa = await one(db, 'SELECT id FROM empresas WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1');
    if (!empresa) throw new Error('No existe empresa; ejecuta primero `npm run db:seed`.');
    const sucursal = await one(db, 'SELECT id FROM sucursales WHERE empresa_id = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1', [empresa.id]);
    if (!sucursal) throw new Error('No existe sucursal; ejecuta primero `npm run db:seed`.');

    const creadas = [];
    for (const s of SERIES) {
      const existe = await one(
        db,
        'SELECT id FROM series_documentos WHERE botica_id = $1 AND tipo_documento = $2 AND serie = $3 AND sucursal_id = $4',
        [empresa.id, s.tipo_documento, s.serie, sucursal.id],
      );
      if (existe) continue;
      await db.query(
        `INSERT INTO series_documentos (botica_id, tipo_documento, serie, correlativo_inicial, correlativo_actual, longitud_correlativo, sucursal_id, activo)
         VALUES ($1, $2, $3, 1, 1, 8, $4, true)`,
        [empresa.id, s.tipo_documento, s.serie, sucursal.id],
      );
      creadas.push(`${s.tipo_documento}/${s.serie}`);
    }

    await db.query('COMMIT');
    console.log(JSON.stringify({ ok: true, empresa_id: empresa.id, sucursal_id: sucursal.id, series_creadas: creadas, series_total: SERIES.length }, null, 2));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => { console.error('No se pudieron crear los datos de facturación electrónica:', error.message); process.exitCode = 1; });
