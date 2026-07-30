export class CreateCambioDto {
  venta_id: string;
  motivo: string;
  items_devolver: {
    detalle_venta_id: string;
    cantidad: number;
  }[];
  items_entregar: {
    producto_comercial_id: string;
    cantidad: number;
    precio_unitario: number;
  }[];
  usuario_id?: string;
}
