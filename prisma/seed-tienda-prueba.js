/* Script para crear una botica/tienda limpia para pruebas con usuario, sucursal, caja, productos, lotes y series SUNAT. */
require('dotenv/config');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const TIENDA = {
  nombre: 'Botica San Pedro',
  ruc: '20609999992',
  razonSocial: 'BOTICA SAN PEDRO S.A.C.',
  direccion: 'Av. Los Próceres 450, Santiago de Surco, Lima',
  telefono: '987654321',
  sucursalNombre: 'Sucursal Central - San Pedro',
  sucursalDireccion: 'Av. Los Próceres 450, Lima',
  adminNombre: 'Administrador San Pedro',
  adminEmail: 'admin.sanpedro@farmapos.pe',
  adminPassword: 'Password123*',
};

async function one(db, sql, values = []) {
  const { rows } = await db.query(sql, values);
  return rows[0];
}

async function ensure(db, table, where, values, data) {
  let row = await one(db, `SELECT id FROM ${table} WHERE ${where} AND deleted_at IS NULL LIMIT 1`, values);
  if (!row) {
    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    row = await one(db, `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) RETURNING id`, Object.values(data));
  }
  return row.id;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    await db.query('BEGIN');

    // 1. Crear Empresa / Botica
    let empresa = await one(db, 'SELECT id FROM empresas WHERE ruc = $1 AND deleted_at IS NULL LIMIT 1', [TIENDA.ruc]);
    if (!empresa) {
      empresa = await one(
        db,
        `INSERT INTO empresas (nombre, ruc, razon_social, direccion, telefono, estado) 
         VALUES ($1, $2, $3, $4, $5, 'ACTIVO') RETURNING id`,
        [TIENDA.nombre, TIENDA.ruc, TIENDA.razonSocial, TIENDA.direccion, TIENDA.telefono]
      );
    }
    const boticaId = empresa.id;

    // 2. Rol Administrador
    let rol = await one(db, "SELECT id FROM roles WHERE botica_id = $1 AND nombre = 'ADMINISTRADOR' AND deleted_at IS NULL LIMIT 1", [boticaId]);
    if (!rol) {
      rol = await one(db, "INSERT INTO roles (botica_id, nombre) VALUES ($1, 'ADMINISTRADOR') RETURNING id", [boticaId]);
    }

    // 3. Sucursal Principal
    let sucursal = await one(db, 'SELECT id FROM sucursales WHERE empresa_id = $1 AND deleted_at IS NULL LIMIT 1', [boticaId]);
    if (!sucursal) {
      sucursal = await one(
        db,
        'INSERT INTO sucursales (empresa_id, nombre, direccion, telefono) VALUES ($1, $2, $3, $4) RETURNING id',
        [boticaId, TIENDA.sucursalNombre, TIENDA.sucursalDireccion, TIENDA.telefono]
      );
    }

    // 4. Usuario Administrador
    let usuario = await one(db, 'SELECT id FROM usuarios WHERE correo = $1 AND deleted_at IS NULL LIMIT 1', [TIENDA.adminEmail]);
    const hash = await bcrypt.hash(TIENDA.adminPassword, 10);
    if (!usuario) {
      usuario = await one(
        db,
        "INSERT INTO usuarios (botica_id, rol_id, nombre, correo, password_hash, estado) VALUES ($1, $2, $3, $4, $5, 'ACTIVO') RETURNING id",
        [boticaId, rol.id, TIENDA.adminNombre, TIENDA.adminEmail, hash]
      );
    } else {
      await db.query("UPDATE usuarios SET password_hash = $1, estado = 'ACTIVO', rol_id = $2, botica_id = $3 WHERE id = $4", [hash, rol.id, boticaId, usuario.id]);
    }

    // Asignar sucursal a usuario
    await db.query(
      `INSERT INTO usuario_sucursales (usuario_id, botica_id, sucursal_id, es_principal, activo) 
       VALUES ($1, $2, $3, true, true) 
       ON CONFLICT (usuario_id, sucursal_id) DO UPDATE SET botica_id = EXCLUDED.botica_id, es_principal = true, activo = true`,
      [usuario.id, boticaId, sucursal.id]
    );

    // 5. Caja Operativa
    let caja = await one(db, 'SELECT id FROM cajas WHERE sucursal_id = $1 AND botica_id = $2 AND deleted_at IS NULL LIMIT 1', [sucursal.id, boticaId]);
    if (!caja) {
      caja = await one(
        db,
        "INSERT INTO cajas (sucursal_id, botica_id, nombre, estado, created_by) VALUES ($1, $2, $3, 'ABIERTA', $4) RETURNING id",
        [sucursal.id, boticaId, `Caja 1 - Principal`, usuario.id]
      );
      // Registrar apertura inicial con S/ 100 de fondo
      await db.query(
        "INSERT INTO movimientos_caja (caja_id, botica_id, usuario_id, tipo, monto, observacion, fecha, created_by) VALUES ($1, $2, $3, 'APERTURA', 100, 'Apertura inicial para pruebas', CURRENT_TIMESTAMP, $3)",
        [caja.id, boticaId, usuario.id]
      );
    } else {
      await db.query("UPDATE cajas SET estado = 'ABIERTA' WHERE id = $1", [caja.id]);
    }

    // 6. Métodos de Pago
    const metodos = [
      { nombre: 'EFECTIVO', requiere_referencia: false },
      { nombre: 'YAPE', requiere_referencia: true },
      { nombre: 'PLIN', requiere_referencia: true },
      { nombre: 'TARJETA', requiere_referencia: true },
    ];
    for (const m of metodos) {
      let mRow = await one(db, 'SELECT id FROM metodos_pago WHERE nombre=$1 AND deleted_at IS NULL LIMIT 1', [m.nombre]);
      if (!mRow) {
        await db.query('INSERT INTO metodos_pago (botica_id, nombre, requiere_referencia) VALUES ($1, $2, $3)', [boticaId, m.nombre, m.requiere_referencia]);
      }
    }

    // 7. Series de Comprobantes SUNAT
    const seriesSunat = [
      { tipo_documento: 'BOLETA', serie: 'B001' },
      { tipo_documento: 'FACTURA', serie: 'F001' },
      { tipo_documento: 'NOTA_VENTA', serie: 'NV01' },
      { tipo_documento: 'NOTA_CREDITO', serie: 'BC01' },
      { tipo_documento: 'NOTA_DEBITO', serie: 'FC01' },
    ];
    for (const s of seriesSunat) {
      const existe = await one(
        db,
        'SELECT id FROM series_documentos WHERE botica_id = $1 AND tipo_documento = $2 AND serie = $3 AND sucursal_id = $4 LIMIT 1',
        [boticaId, s.tipo_documento, s.serie, sucursal.id]
      );
      if (!existe) {
        await db.query(
          `INSERT INTO series_documentos (botica_id, tipo_documento, serie, correlativo_inicial, correlativo_actual, longitud_correlativo, sucursal_id, activo)
           VALUES ($1, $2, $3, 1, 1, 8, $4, true)`,
          [boticaId, s.tipo_documento, s.serie, sucursal.id]
        );
      }
    }

    // 8. Cliente de Prueba
    await ensure(db, 'clientes', 'botica_id=$1 AND numero_documento=$2', [boticaId, '70809010'], {
      botica_id: boticaId,
      tipo_documento: 'DNI',
      numero_documento: '70809010',
      nombre: 'Juan Pérez Quispe',
      direccion: 'Jr. Las Flores 123, Surco',
      telefono: '991122334',
      email: 'juan.perez@example.com',
      created_by: usuario.id,
    });

    // 9. Catálogos base de Farmacia
    const catAnalg = await ensure(db, 'categorias', 'botica_id=$1 AND nombre=$2', [boticaId, 'Analgésicos y Antiinflamatorios'], { botica_id: boticaId, nombre: 'Analgésicos y Antiinflamatorios', created_by: usuario.id });
    const catAntib = await ensure(db, 'categorias', 'botica_id=$1 AND nombre=$2', [boticaId, 'Antibióticos'], { botica_id: boticaId, nombre: 'Antibióticos', created_by: usuario.id });
    const catGastro = await ensure(db, 'categorias', 'botica_id=$1 AND nombre=$2', [boticaId, 'Gastroenterología'], { botica_id: boticaId, nombre: 'Gastroenterología', created_by: usuario.id });
    const catAntihist = await ensure(db, 'categorias', 'botica_id=$1 AND nombre=$2', [boticaId, 'Antihistamínicos'], { botica_id: boticaId, nombre: 'Antihistamínicos', created_by: usuario.id });
    const catCuidado = await ensure(db, 'categorias', 'botica_id=$1 AND nombre=$2', [boticaId, 'Cuidado Personal e Higiene'], { botica_id: boticaId, nombre: 'Cuidado Personal e Higiene', created_by: usuario.id });

    const formaTab = await ensure(db, 'formas_farmaceuticas', 'botica_id=$1 AND nombre=$2', [boticaId, 'Tableta'], { botica_id: boticaId, nombre: 'Tableta', created_by: usuario.id });
    const formaCap = await ensure(db, 'formas_farmaceuticas', 'botica_id=$1 AND nombre=$2', [boticaId, 'Cápsula'], { botica_id: boticaId, nombre: 'Cápsula', created_by: usuario.id });
    const formaGel = await ensure(db, 'formas_farmaceuticas', 'botica_id=$1 AND nombre=$2', [boticaId, 'Gel Tópico'], { botica_id: boticaId, nombre: 'Gel Tópico', created_by: usuario.id });

    const undUnidad = await ensure(db, 'unidades_presentacion', 'botica_id=$1 AND nombre=$2', [boticaId, 'Unidad'], { botica_id: boticaId, nombre: 'Unidad', abreviatura: 'und', created_by: usuario.id });
    const undBlister = await ensure(db, 'unidades_presentacion', 'botica_id=$1 AND nombre=$2', [boticaId, 'Blíster'], { botica_id: boticaId, nombre: 'Blíster', abreviatura: 'bls', created_by: usuario.id });
    const undCaja = await ensure(db, 'unidades_presentacion', 'botica_id=$1 AND nombre=$2', [boticaId, 'Caja'], { botica_id: boticaId, nombre: 'Caja', abreviatura: 'cja', created_by: usuario.id });
    const undFrasco = await ensure(db, 'unidades_presentacion', 'botica_id=$1 AND nombre=$2', [boticaId, 'Frasco'], { botica_id: boticaId, nombre: 'Frasco', abreviatura: 'fco', created_by: usuario.id });

    const labBago = await ensure(db, 'laboratorios', 'botica_id=$1 AND nombre=$2', [boticaId, 'Laboratorios Bagó'], { botica_id: boticaId, nombre: 'Laboratorios Bagó', pais: 'Perú', created_by: usuario.id });
    const labRoemmers = await ensure(db, 'laboratorios', 'botica_id=$1 AND nombre=$2', [boticaId, 'Laboratorios Roemmers'], { botica_id: boticaId, nombre: 'Laboratorios Roemmers', pais: 'Perú', created_by: usuario.id });
    const labGenfar = await ensure(db, 'laboratorios', 'botica_id=$1 AND nombre=$2', [boticaId, 'Genfar'], { botica_id: boticaId, nombre: 'Genfar', pais: 'Colombia', created_by: usuario.id });

    // 10. Productos con códigos de barras y stock
    const productosData = [
      {
        nombre: 'Paracetamol 500 mg',
        sku: 'MED-PARA-500',
        codigoBarras: '7751234560011',
        categoriaId: catAnalg,
        formaId: formaTab,
        labId: labGenfar,
        principioActivo: 'Paracetamol',
        concentracion: 500,
        unidadConc: 'mg',
        costoBase: 0.10,
        precioVenta: 0.50,
        stock: 100,
        lote: 'LOTE-PA-2026',
        vencimiento: '2028-10-30',
        requiereReceta: false,
      },
      {
        nombre: 'Ibuprofeno 400 mg',
        sku: 'MED-IBU-400',
        codigoBarras: '7751234560028',
        categoriaId: catAnalg,
        formaId: formaTab,
        labId: labBago,
        principioActivo: 'Ibuprofeno',
        concentracion: 400,
        unidadConc: 'mg',
        costoBase: 0.20,
        precioVenta: 0.80,
        stock: 80,
        lote: 'LOTE-IB-2026',
        vencimiento: '2028-06-15',
        requiereReceta: false,
      },
      {
        nombre: 'Amoxicilina 500 mg',
        sku: 'MED-AMOX-500',
        codigoBarras: '7751234560035',
        categoriaId: catAntib,
        formaId: formaCap,
        labId: labRoemmers,
        principioActivo: 'Amoxicilina',
        concentracion: 500,
        unidadConc: 'mg',
        costoBase: 0.45,
        precioVenta: 1.50,
        stock: 50,
        lote: 'LOTE-AM-2026',
        vencimiento: '2027-12-31',
        requiereReceta: true,
      },
      {
        nombre: 'Omeprazol 20 mg',
        sku: 'MED-OME-20',
        codigoBarras: '7751234560042',
        categoriaId: catGastro,
        formaId: formaCap,
        labId: labGenfar,
        principioActivo: 'Omeprazol',
        concentracion: 20,
        unidadConc: 'mg',
        costoBase: 0.30,
        precioVenta: 1.20,
        stock: 60,
        lote: 'LOTE-OM-2026',
        vencimiento: '2028-04-20',
        requiereReceta: false,
      },
      {
        nombre: 'Loratadina 10 mg',
        sku: 'MED-LORA-10',
        codigoBarras: '7751234560059',
        categoriaId: catAntihist,
        formaId: formaTab,
        labId: labBago,
        principioActivo: 'Loratadina',
        concentracion: 10,
        unidadConc: 'mg',
        costoBase: 0.25,
        precioVenta: 1.00,
        stock: 75,
        lote: 'LOTE-LO-2026',
        vencimiento: '2028-08-31',
        requiereReceta: false,
      },
      {
        nombre: 'Alcohol en Gel Antibacterial 70% 500ml',
        sku: 'CUID-ALC-500',
        codigoBarras: '7751234560066',
        categoriaId: catCuidado,
        formaId: formaGel,
        labId: labBago,
        principioActivo: 'Alcohol Etílico',
        concentracion: 70,
        unidadConc: '%',
        costoBase: 4.50,
        precioVenta: 9.90,
        stock: 30,
        lote: 'LOTE-AG-2026',
        vencimiento: '2028-11-30',
        requiereReceta: false,
        unidadPresentacion: undFrasco,
      },
    ];

    const productosCreados = [];
    for (const p of productosData) {
      const pa = await ensure(db, 'principios_activos', 'botica_id=$1 AND nombre=$2', [boticaId, p.principioActivo], {
        botica_id: boticaId,
        nombre: p.principioActivo,
        created_by: usuario.id,
      });

      let med = await one(
        db,
        'SELECT id FROM medicamentos WHERE botica_id=$1 AND principio_activo_id=$2 AND forma_farmaceutica_id=$3 AND concentracion=$4 AND deleted_at IS NULL LIMIT 1',
        [boticaId, pa, p.formaId, p.concentracion]
      );
      if (!med) {
        med = await one(
          db,
          `INSERT INTO medicamentos (botica_id, principio_activo_id, forma_farmaceutica_id, concentracion, unidad_concentracion, via_administracion, requiere_receta, afecto_igv, created_by)
           VALUES ($1, $2, $3, $4, $5, 'Oral', $6, true, $7) RETURNING id`,
          [boticaId, pa, p.formaId, p.concentracion, p.unidadConc, p.requiereReceta, usuario.id]
        );
      }

      let prod = await one(db, 'SELECT id FROM productos_comerciales WHERE botica_id=$1 AND sku=$2 AND deleted_at IS NULL LIMIT 1', [boticaId, p.sku]);
      if (!prod) {
        prod = await one(
          db,
          `INSERT INTO productos_comerciales (botica_id, medicamento_id, laboratorio_id, categoria_id, unidad_base_id, sku, codigo_interno, nombre_comercial, estado, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO', $9) RETURNING id`,
          [boticaId, med.id, p.labId, p.categoriaId, p.unidadPresentacion || undUnidad, p.sku, p.sku, p.nombre, usuario.id]
        );
      }

      // Presentación base (Unidad / Frasco)
      let pres = await one(
        db,
        'SELECT id FROM productos_presentaciones WHERE producto_comercial_id=$1 AND unidad_presentacion_id=$2 AND deleted_at IS NULL LIMIT 1',
        [prod.id, p.unidadPresentacion || undUnidad]
      );
      if (!pres) {
        pres = await one(
          db,
          `INSERT INTO productos_presentaciones (botica_id, producto_comercial_id, unidad_presentacion_id, cantidad_unidad_base, precio_actual, codigo_barras, orden, created_by)
           VALUES ($1, $2, $3, 1, $4, $5, 1, $6) RETURNING id`,
          [boticaId, prod.id, p.unidadPresentacion || undUnidad, p.precioVenta, p.codigoBarras, usuario.id]
        );
      }

      // Lote con stock disponible
      let lote = await one(
        db,
        'SELECT id FROM lotes WHERE producto_comercial_id=$1 AND numero_lote=$2 AND deleted_at IS NULL LIMIT 1',
        [prod.id, p.lote]
      );
      if (!lote) {
        lote = await one(
          db,
          `INSERT INTO lotes (producto_comercial_id, sucursal_id, botica_id, numero_lote, fecha_fabricacion, fecha_vencimiento, fecha_ingreso, precio_compra_unidad_base, stock_actual, created_by)
           VALUES ($1, $2, $3, $4, '2026-01-15', $5, '2026-08-20', $6, $7, $8) RETURNING id`,
          [prod.id, sucursal.id, boticaId, p.lote, p.vencimiento, p.costoBase, p.stock, usuario.id]
        );
      }

      productosCreados.push({
        nombre: p.nombre,
        sku: p.sku,
        codigo_barras: p.codigoBarras,
        precio: p.precioVenta,
        stock: p.stock,
      });
    }

    await db.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          mensaje: 'Tienda de prueba creada con éxito',
          empresa: {
            id: boticaId,
            nombre: TIENDA.nombre,
            ruc: TIENDA.ruc,
            razon_social: TIENDA.razonSocial,
          },
          usuario_admin: {
            correo: TIENDA.adminEmail,
            password: TIENDA.adminPassword,
            rol: 'ADMINISTRADOR',
          },
          sucursal: {
            id: sucursal.id,
            nombre: TIENDA.sucursalNombre,
          },
          caja: {
            id: caja.id,
            nombre: 'Caja 1 - Principal',
            estado: 'ABIERTA',
          },
          productos_creados: productosCreados,
        },
        null,
        2
      )
    );
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('Error al crear tienda de prueba:', error);
  process.exitCode = 1;
});
