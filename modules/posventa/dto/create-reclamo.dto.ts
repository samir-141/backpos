export class CreateReclamoDto {
  venta_id: string;
  tipo: 'PRODUCTO' | 'SERVICIO' | 'FACTURACION' | 'OTRO';
  descripcion: string;
  usuario_id?: string;
}
