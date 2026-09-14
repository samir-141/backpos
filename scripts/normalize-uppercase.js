require('dotenv/config');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  console.log('Conectado a la base de datos PostgreSQL.');

  try {
    await db.query('BEGIN');

    console.log('1. Normalizando productos comerciales...');
    await db.query(`
      UPDATE public.productos_comerciales 
      SET nombre_comercial = UPPER(TRIM(nombre_comercial)),
          sku = UPPER(TRIM(sku)),
          codigo_interno = UPPER(TRIM(codigo_interno)),
          registro_sanitario = UPPER(TRIM(registro_sanitario)),
          tipo_producto = UPPER(TRIM(tipo_producto))
      WHERE deleted_at IS NULL;
    `);

    console.log('2. Normalizando laboratorios...');
    await db.query(`
      UPDATE public.laboratorios 
      SET nombre = UPPER(TRIM(nombre)),
          pais = UPPER(TRIM(pais))
      WHERE deleted_at IS NULL;
    `);

    console.log('3. Normalizando categorías...');
    await db.query(`
      UPDATE public.categorias 
      SET nombre = UPPER(TRIM(nombre))
      WHERE deleted_at IS NULL;
    `);

    console.log('4. Normalizando principios activos...');
    await db.query(`
      UPDATE public.principios_activos 
      SET nombre = UPPER(TRIM(nombre))
      WHERE deleted_at IS NULL;
    `);

    console.log('5. Normalizando formas farmacéuticas...');
    await db.query(`
      UPDATE public.formas_farmaceuticas 
      SET nombre = UPPER(TRIM(nombre))
      WHERE deleted_at IS NULL;
    `);

    console.log('6. Normalizando unidades de presentación...');
    await db.query(`
      UPDATE public.unidades_presentacion 
      SET nombre = UPPER(TRIM(nombre)),
          abreviatura = UPPER(TRIM(abreviatura))
      WHERE deleted_at IS NULL;
    `);

    console.log('7. Normalizando medicamentos...');
    await db.query(`
      UPDATE public.medicamentos 
      SET via_administracion = UPPER(TRIM(via_administracion)),
          unidad_concentracion = UPPER(TRIM(unidad_concentracion))
      WHERE deleted_at IS NULL;
    `);

    console.log('8. Normalizando catálogo maestro si existe...');
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'catalogo_maestro_productos') THEN
          UPDATE public.catalogo_maestro_productos 
          SET nombre_comercial = UPPER(TRIM(nombre_comercial)),
              principio_activo = UPPER(TRIM(principio_activo)),
              laboratorio = UPPER(TRIM(laboratorio)),
              categoria = UPPER(TRIM(categoria)),
              forma_farmaceutica = UPPER(TRIM(forma_farmaceutica)),
              unidad_presentacion = UPPER(TRIM(unidad_presentacion)),
              unidad_base = UPPER(TRIM(unidad_base)),
              via_administracion = UPPER(TRIM(via_administracion)),
              registro_sanitario = UPPER(TRIM(registro_sanitario))
          WHERE deleted_at IS NULL;
        END IF;
      END $$;
    `);

    await db.query('COMMIT');
    console.log('✅ Toda la base de datos ha sido normalizada a MAYÚSCULAS exitosamente.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error normalizando base de datos:', error.message);
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
