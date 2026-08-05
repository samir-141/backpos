// src/modules/comprobantes-impresion/dto/imprimir-comprobante.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ImprimirComprobanteDto {
  @IsNotEmpty()
  @IsEnum(['A4', 'TICKET80', 'TICKET58'])
  formato: 'A4' | 'TICKET80' | 'TICKET58';
}
