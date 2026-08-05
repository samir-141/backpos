import { IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Emisión de comprobante electrónico desde una venta registrada.
 * El backend recalcula todos los importes y asigna el correlativo;
 * el frontend NO puede enviar totales, correlativos ni datos del emisor.
 */
export class EmitirComprobanteDto {
  @ApiProperty({ description: 'ID de la venta ya registrada y cerrada' })
  @IsUUID('4')
  ventaId: string;

  @ApiProperty({ description: 'Catálogo 01 SUNAT', enum: ['01', '03'] })
  @IsIn(['01', '03'], {
    message: 'tipoComprobante debe ser 01 (Factura) o 03 (Boleta)',
  })
  tipoComprobante: '01' | '03';

  @ApiProperty({ description: 'ID de la serie (series_documentos) a usar' })
  @IsUUID('4')
  serieId: string;
}
