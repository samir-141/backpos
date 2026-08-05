# Unicidad por botica y evidencia RLS

## Alcance

La migración `20260801040000_tenant_unique_indexes` reemplaza índices únicos
globales por índices únicos parciales cuyo primer componente es `botica_id`.
De esta forma dos boticas pueden registrar el mismo valor comercial, pero una
misma botica no puede duplicarlo mientras la fila esté activa.

Los campos cubiertos son:

- categoría, forma farmacéutica, laboratorio y principio activo por nombre;
- permiso y tipo de movimiento por código;
- producto por SKU y código interno;
- presentación por código de barras;
- proveedor por RUC;
- rol por nombre;
- unidad de presentación por nombre y abreviatura.

`roles` y `permisos` ya tenían sus índices compuestos en la migración
`20260731180000_administracion_general`; DB-F4 alinea `schema.prisma`, conserva
el preflight y verifica esa condición. No se modifican `boticas.ruc`,
`usuarios.correo`, identificadores de comprobantes, tokens ni otras identidades
globales.

## Evidencia de reglas de negocio

Los servicios consultan y crean estos registros con `botica_id`. Un caso
especialmente reproducible es `UsuariosService.getRoles`: cada botica siembra
los mismos nombres de roles y códigos de permisos. La unicidad global impedía
crear correctamente una segunda botica. Productos, presentaciones y tipos de
movimiento también se consultan dentro del tenant y deben poder reutilizar SKU,
código de barras o códigos operativos en otra botica independiente.

La consulta read-only ejecutada el 1 de agosto de 2026 contra la base actual no
encontró duplicados activos dentro de una misma botica para ninguno de los 13
índices. Sí confirmó que 11 tablas conservaban el índice global en producción;
roles y permisos ya usaban el índice compuesto de la migración administrativa.

## Preflight y despliegue

La migración aborta con SQLSTATE `23505` antes de cambiar índices si encuentra
una colisión dentro de una botica. Construye primero los índices compuestos y
solo después elimina los globales, dentro de la transacción de migración.

No se aplicó la migración durante la auditoría. Antes de desplegar:

1. realizar respaldo y abrir una ventana de mantenimiento, porque PostgreSQL
   debe recorrer las tablas y puede tomar bloqueos al construir índices;
2. ejecutar la migración con el rol propietario usado por Prisma;
3. ejecutar `prisma/tenant_unique_indexes.verify.sql` con ese mismo rol;
4. comprobar que no quedan índices globales obsoletos y que el probe termina en
   `ROLLBACK`.

## RLS

La inspección reproducible de `pg_class` y `pg_policy` mostró `relrowsecurity =
false`, `relforcerowsecurity = false` y cero políticas para las 11 tablas
auditadas. Aunque comentarios heredados de `schema.prisma` mencionan RLS, el
estado actual no lo tiene habilitado para estas tablas y las migraciones del
repositorio no contienen políticas reproducibles.

No es seguro habilitar RLS todavía: `PrismaService` abre un pool PostgreSQL sin
establecer un identificador de tenant local a cada transacción. Activar una
política basada en sesión podría bloquear operaciones legítimas o, con una
configuración incompleta, no aislarlas. Primero se necesita diseñar y probar un
contexto transaccional (`SET LOCAL` o equivalente), políticas `USING` y `WITH
CHECK`, comportamiento del propietario/service role y pruebas de aislamiento.
Por ello DB-F4 no altera RLS ni crea una migración de políticas.

## Alineación de la aplicación

`ProductosService` incluye ahora `botica_id` en las comprobaciones previas de
SKU, código interno y código de barras, tanto al crear como al agregar o editar
presentaciones. Las pruebas A/B confirman que un duplicado activo se rechaza
dentro de la misma botica y que otra botica puede reutilizar los tres
identificadores. El ingreso de stock conserva un código de movimiento sufijado
con la botica como workaround histórico; es redundante tras esta migración,
aunque no afecta la integridad.
