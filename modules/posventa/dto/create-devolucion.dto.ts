export class CreateDevolucionDto {
  venta_id: string;
  motivo: string;
  items: {
    detalle_venta_id: string;
    cantidad: number;
  }[];
  usuario_id?: string;
}
