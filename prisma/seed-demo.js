/* Datos ficticios idempotentes para pruebas funcionales. */
require('dotenv/config');
const { Client } = require('pg');
const one = async (db, sql, args=[]) => (await db.query(sql,args)).rows[0];
async function ensure(db, table, where, values, data) {
  let row = await one(db, `SELECT id FROM ${table} WHERE ${where} AND deleted_at IS NULL LIMIT 1`, values);
  if (!row) row = await one(db, `INSERT INTO ${table} (${Object.keys(data).join(',')}) VALUES (${Object.keys(data).map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`, Object.values(data));
  return row.id;
}
async function main(){
 const db=new Client({connectionString:process.env.DATABASE_URL}); await db.connect();
 try { await db.query('BEGIN');
  const empresa=await one(db,'SELECT id FROM empresas WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1');
  const usuario=await one(db,'SELECT id FROM usuarios WHERE botica_id=$1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1',[empresa.id]);
  const sucursal=await one(db,'SELECT id FROM sucursales WHERE empresa_id=$1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1',[empresa.id]);
  const caja=await one(db,'SELECT id FROM cajas WHERE botica_id=$1 AND sucursal_id=$2 AND deleted_at IS NULL ORDER BY created_at LIMIT 1',[empresa.id,sucursal.id]);
  const categoria=await ensure(db,'categorias','botica_id=$1 AND nombre=$2',[empresa.id,'Medicamentos'],{botica_id:empresa.id,nombre:'Medicamentos'});
  const lab=await ensure(db,'laboratorios','botica_id=$1 AND nombre=$2',[empresa.id,'Laboratorios Demo Perú'],{botica_id:empresa.id,nombre:'Laboratorios Demo Perú',pais:'Perú'});
  const forma=await ensure(db,'formas_farmaceuticas','botica_id=$1 AND nombre=$2',[empresa.id,'Tableta'],{botica_id:empresa.id,nombre:'Tableta'});
  const unidad=await ensure(db,'unidades_presentacion','botica_id=$1 AND nombre=$2',[empresa.id,'Tableta'],{botica_id:empresa.id,nombre:'Tableta',abreviatura:'und'});
  const blister=await ensure(db,'unidades_presentacion','botica_id=$1 AND nombre=$2',[empresa.id,'Blíster'],{botica_id:empresa.id,nombre:'Blíster',abreviatura:'bls'});
  const cajaUnidad=await ensure(db,'unidades_presentacion','botica_id=$1 AND nombre=$2',[empresa.id,'Caja'],{botica_id:empresa.id,nombre:'Caja',abreviatura:'cja'});
  const proveedor=await ensure(db,'proveedores','botica_id=$1 AND ruc=$2',[empresa.id,'20999999991'],{botica_id:empresa.id,ruc:'20999999991',razon_social:'Distribuidora Demo SAC'});
  const efectivo=await ensure(db,'metodos_pago','botica_id=$1 AND nombre=$2',[empresa.id,'EFECTIVO'],{botica_id:empresa.id,nombre:'EFECTIVO',requiere_referencia:false});
  const cliente=await ensure(db,'clientes','botica_id=$1 AND numero_documento=$2',[empresa.id,'00000001'],{botica_id:empresa.id,tipo_documento:'DNI',numero_documento:'00000001',nombre:'Cliente de Prueba'});
  const productos=[['Paracetamol 500 mg','PARA-500',500,0.12,0.50,4.50,35],['Ibuprofeno 400 mg','IBU-400',400,0.20,0.80,7.50,25],['Amoxicilina 500 mg','AMOX-500',500,0.45,1.50,14.00,18]];
  const creados=[];
  for(const [nombre,sku,mg,costo,pUnidad,pCaja,stock] of productos){
   const pa=await ensure(db,'principios_activos','botica_id=$1 AND nombre=$2',[empresa.id,nombre.split(' ')[0]],{botica_id:empresa.id,nombre:nombre.split(' ')[0]});
   let med=await one(db,'SELECT id FROM medicamentos WHERE botica_id=$1 AND principio_activo_id=$2 AND forma_farmaceutica_id=$3 AND concentracion=$4 AND deleted_at IS NULL LIMIT 1',[empresa.id,pa,forma,mg]);
   if(!med) med=await one(db,"INSERT INTO medicamentos (botica_id,principio_activo_id,forma_farmaceutica_id,concentracion,unidad_concentracion,via_administracion) VALUES ($1,$2,$3,$4,'mg','Oral') RETURNING id",[empresa.id,pa,forma,mg]);
   let prod=await one(db,'SELECT id FROM productos_comerciales WHERE botica_id=$1 AND sku=$2 AND deleted_at IS NULL LIMIT 1',[empresa.id,sku]);
   if(!prod) prod=await one(db,"INSERT INTO productos_comerciales (botica_id,medicamento_id,laboratorio_id,categoria_id,unidad_base_id,sku,nombre_comercial,estado) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVO') RETURNING id",[empresa.id,med.id,lab,categoria,unidad,sku,nombre]);
   const pres=[]; for(const [u,cant,precio,orden] of [[unidad,1,pUnidad,1],[blister,10,pUnidad*10*.92,2],[cajaUnidad,100,pCaja,3]]){let p=await one(db,'SELECT id FROM productos_presentaciones WHERE producto_comercial_id=$1 AND unidad_presentacion_id=$2 AND deleted_at IS NULL LIMIT 1',[prod.id,u]); if(!p)p=await one(db,'INSERT INTO productos_presentaciones (botica_id,producto_comercial_id,unidad_presentacion_id,cantidad_unidad_base,precio_actual,orden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[empresa.id,prod.id,u,cant,precio,orden]); pres.push(p.id);}
   const lote=await ensure(db,'lotes','producto_comercial_id=$1 AND numero_lote=$2',[prod.id,`DEMO-${sku}`],{producto_comercial_id:prod.id,sucursal_id:sucursal.id,botica_id:empresa.id,numero_lote:`DEMO-${sku}`,fecha_fabricacion:'2026-01-15',fecha_vencimiento:'2028-12-31',precio_compra_unidad_base:costo,stock_actual:stock});
   await db.query('UPDATE lotes SET fecha_fabricacion=$1, fecha_vencimiento=$2, precio_compra_unidad_base=$3 WHERE id=$4',['2026-01-15','2028-12-31',costo,lote]);
   creados.push({prod:prod.id,base:pres[0],blister:pres[1],caja:pres[2],lote,precio:pUnidad,costo});
  }
  const yape=await ensure(db,'metodos_pago','botica_id=$1 AND nombre=$2',[empresa.id,'YAPE'],{botica_id:empresa.id,nombre:'YAPE',requiere_referencia:true});
  const gastos=[['Alquiler demo','OPERATIVO',1200,'Pago mensual del local','2026-07-21'],['Servicio de energía','OPERATIVO',185.40,'Recibo de luz demo','2026-07-23'],['Internet','OPERATIVO',99.90,'Plan de internet del local','2026-07-24'],['Compra de vitrina','INVERSION',850,'Activo fijo para exhibición','2026-07-22']];
  for(const [categoria,tipo,monto,descripcion,fecha] of gastos) await ensure(db,'gastos_operativos','botica_id=$1 AND categoria=$2',[empresa.id,categoria],{botica_id:empresa.id,sucursal_id:sucursal.id,tipo,categoria,descripcion,monto,fecha,comprobante:`DEMO-${fecha.replaceAll('-','')}`});
  let apertura=await one(db,"SELECT id FROM movimientos_caja WHERE caja_id=$1 AND tipo='APERTURA' AND deleted_at IS NULL LIMIT 1",[caja.id]);
  if(!apertura) await db.query("INSERT INTO movimientos_caja (caja_id,botica_id,usuario_id,tipo,monto,observacion,fecha,created_by) VALUES ($1,$2,$3,'APERTURA',200,'Apertura de semana demo',$4,$3)",[caja.id,empresa.id,usuario.id,'2026-07-21']);
  await db.query("UPDATE cajas SET estado='ABIERTA', updated_by=$1 WHERE id=$2",[usuario.id,caja.id]);
  const compra=await one(db,"SELECT id FROM compras WHERE botica_id=$1 AND serie='D001' AND numero='0000001' AND deleted_at IS NULL LIMIT 1",[empresa.id]) || await one(db,"INSERT INTO compras (proveedor_id,usuario_id,sucursal_id,botica_id,fecha,serie,numero,subtotal,igv,total,created_by) VALUES ($1,$2,$3,$4,$5,'D001','0000001',900,162,1062,$2) RETURNING id",[proveedor,usuario.id,sucursal.id,empresa.id,'2026-07-21']);
  for(const item of creados){let det=await one(db,'SELECT id FROM detalles_compras WHERE compra_id=$1 AND producto_presentacion_id=$2 AND deleted_at IS NULL LIMIT 1',[compra.id,item.caja]);if(!det) det=await one(db,'INSERT INTO detalles_compras (compra_id,botica_id,producto_presentacion_id,cantidad,precio_unitario,created_by) VALUES ($1,$2,$3,3,$4,$5) RETURNING id',[compra.id,empresa.id,item.caja,item.costo*100,usuario.id]); await db.query('UPDATE lotes SET detalle_compra_id=$1 WHERE id=$2',[det.id,item.lote]);}
  const dias=['2026-07-21','2026-07-22','2026-07-23','2026-07-24','2026-07-25','2026-07-26','2026-07-27'];
  for(let i=0;i<dias.length;i++){const item=creados[i%creados.length];const cantidad=i%2?1:2;const total=Number((item.precio*cantidad).toFixed(2));let venta=await one(db,"SELECT id FROM ventas WHERE botica_id=$1 AND fecha::date=$2::date AND deleted_at IS NULL LIMIT 1",[empresa.id,dias[i]]);if(!venta){venta=await one(db,"INSERT INTO ventas (botica_id,cliente_id,usuario_id,caja_id,fecha,subtotal,descuento,igv,total,estado,created_by) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,'EMITIDO',$3) RETURNING id",[empresa.id,cliente,usuario.id,caja.id,dias[i],total,Number((total*0.18/1.18).toFixed(2)),total]);await db.query('INSERT INTO detalles_ventas (venta_id,botica_id,producto_presentacion_id,lote_id,cantidad,precio_unitario_presentacion,subtotal,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[venta.id,empresa.id,item.base,item.lote,cantidad,item.precio,total,usuario.id]);await db.query('INSERT INTO pagos (venta_id,botica_id,metodo_pago_id,monto,referencia,created_by) VALUES ($1,$2,$3,$4,$5,$6)',[venta.id,empresa.id,i%2?yape:efectivo,total,i%2?`YAPE-DEMO-${i+1}`:null,usuario.id]);await db.query('UPDATE lotes SET stock_actual=GREATEST(0,stock_actual-$1) WHERE id=$2',[cantidad,item.lote]);}}
  // Completar campos opcionales y de auditoría. No se llenan deleted_at/deleted_by:
  // esos campos deben permanecer NULL mientras un registro esté activo.
  await db.query(`UPDATE categorias SET created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE principios_activos SET descripcion=COALESCE(descripcion,'Principio activo ficticio para pruebas'), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE formas_farmaceuticas SET created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE laboratorios SET pais=COALESCE(pais,'Perú'), telefono=COALESCE(telefono,'(01) 555-0101'), email=COALESCE(email,'ventas@laboratorios-demo.pe'), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE unidades_presentacion SET created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE proveedores SET direccion=COALESCE(direccion,'Av. Industrial 123, Lima'), telefono=COALESCE(telefono,'999888777'), email=COALESCE(email,'pedidos@distribuidora-demo.pe'), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE clientes SET direccion=COALESCE(direccion,'Av. Los Olivos 456, Lima'), telefono=COALESCE(telefono,'987654321'), email=COALESCE(email,'cliente.demo@example.com'), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE medicamentos SET requiere_receta=CASE WHEN concentracion=500 AND unidad_concentracion='mg' THEN false ELSE requiere_receta END, afecto_igv=true, created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE productos_comerciales SET codigo_interno=COALESCE(codigo_interno,'DEMO-'||sku), registro_sanitario=COALESCE(registro_sanitario,'RS-DEMO-'||substring(id::text,1,8)), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE productos_presentaciones pp SET codigo_barras=COALESCE(pp.codigo_barras,'775000'||substring(pp.id::text,1,7)), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE pp.botica_id=$2 AND pp.deleted_at IS NULL`,[usuario.id,empresa.id]);
  await db.query(`UPDATE lotes SET fecha_fabricacion=COALESCE(fecha_fabricacion,'2026-01-15'), fecha_ingreso=COALESCE(fecha_ingreso,'2026-07-21'), created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  for (const tabla of ['compras','detalles_compras','ventas','detalles_ventas','pagos']) {
    await db.query(`UPDATE ${tabla} SET created_by=$1, updated_by=$1, updated_at=CURRENT_TIMESTAMP WHERE botica_id=$2 AND deleted_at IS NULL`,[usuario.id,empresa.id]);
  }
  await db.query(`UPDATE gastos_operativos SET comprobante=COALESCE(comprobante,'COMP-DEMO-'||substring(id::text,1,8)), updated_at=CURRENT_TIMESTAMP WHERE botica_id=$1 AND deleted_at IS NULL`,[empresa.id]);
  await db.query('COMMIT'); console.log(JSON.stringify({ok:true,productos:creados.length,compras:1,ventas_semana:7,gastos:gastos.length,nota:'Simulación semanal creada con campos de negocio y auditoría completos.'},null,2));
 }catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
