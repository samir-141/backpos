/**
 * Script de utilidad para corregir o actualizar la fecha de emisión
 * de un comprobante público y su venta asociada en Marifarma POS.
 *
 * Uso:
 *   node scripts/actualizar-fecha-comprobante.js <ID_O_TOKEN_O_VENTA_ID> <YYYY-MM-DD>
 *
 * Ejemplo:
 *   node scripts/actualizar-fecha-comprobante.js 171a8c9b-2eb0-4170-bbce-cda8e2e9dc08 2026-10-07
 */

require('dotenv').config();
const { Pool } = require('pg');
const { createHash } = require('crypto');

function serializarSnapshot(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (Array.isArray(valor))
    return `[${valor.map(serializarSnapshot).join(',')}]`;
  const objeto = valor;
  return `{${Object.keys(objeto)
    .sort()
    .map(
      (clave) =>
        `${JSON.stringify(clave)}:${serializarSnapshot(objeto[clave])}`,
    )
    .join(',')}}`;
}

function hashSnapshot(snapshot) {
  return createHash('sha256')
    .update(serializarSnapshot(snapshot))
    .digest('hex');
}

async function main() {
  const identificador = process.argv[2];
  const fechaStr = process.argv[3];

  if (!identificador || !fechaStr) {
    console.error('Uso: node scripts/actualizar-fecha-comprobante.js <ID_O_TOKEN> <YYYY-MM-DD>');
    process.exit(1);
  }

  const matchFecha = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matchFecha) {
    console.error('Formato de fecha inválido. Debe ser YYYY-MM-DD (ej: 2026-10-07)');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `SELECT id, venta_id, botica_id, snapshot, hash_documento, emitido_at 
       FROM comprobantes_publicos 
       WHERE id::text = $1 OR token_publico = $1 OR venta_id::text = $1 
       FOR UPDATE`,
      [identificador]
    );

    if (res.rows.length === 0) {
      throw new Error(`No se encontró ningún comprobante público con identificador: ${identificador}`);
    }

    const row = res.rows[0];
    const snapshot = row.snapshot;

    // Preservar la hora original si existe, o usar 12:00:00 UTC
    let horaOriginal = '12:00:00.000Z';
    if (snapshot.emitido_at && snapshot.emitido_at.includes('T')) {
      horaOriginal = snapshot.emitido_at.split('T')[1];
    } else if (row.emitido_at) {
      horaOriginal = new Date(row.emitido_at).toISOString().split('T')[1];
    }

    const nuevaFechaIso = `${fechaStr}T${horaOriginal}`;

    console.log(`[Comprobante ${row.id}]`);
    console.log(`- Fecha anterior: ${snapshot.emitido_at}`);
    console.log(`- Nueva fecha:    ${nuevaFechaIso}`);

    snapshot.emitido_at = nuevaFechaIso;
    const nuevoHash = hashSnapshot(snapshot);

    await client.query(
      `UPDATE comprobantes_publicos 
       SET snapshot = $1, 
           hash_documento = $2, 
           emitido_at = $3
       WHERE id = $4`,
      [JSON.stringify(snapshot), nuevoHash, nuevaFechaIso, row.id]
    );

    if (row.venta_id) {
      await client.query(
        `UPDATE ventas 
         SET fecha = $1 
         WHERE id = $2`,
        [nuevaFechaIso, row.venta_id]
      );

      await client.query(
        `UPDATE pagos 
         SET created_at = $1, updated_at = $1 
         WHERE venta_id = $2`,
        [nuevaFechaIso, row.venta_id]
      );
      console.log(`- Venta ${row.venta_id} y pago sincronizados.`);
    }

    await client.query('COMMIT');
    console.log(`✔ Éxito: Fecha actualizada y hash criptográfico recalculado: ${nuevoHash}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar fecha:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
