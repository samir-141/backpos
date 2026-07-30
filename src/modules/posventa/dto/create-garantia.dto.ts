export class CreateGarantiaDto {
  venta_id: string;
  detalle_venta_id: string;
  tipo: 'CAMBIO' | 'REPARACION' | 'DEVOLUCION';
  motivo: string;
  usuario_id?: string;
}
