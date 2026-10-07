import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVentaDto {
  @ApiPropertyOptional({ description: 'Nombre o razón social del cliente' })
  @IsOptional()
  @IsString()
  cliente_nombre?: string;

  @ApiPropertyOptional({ description: 'Tipo de documento (DNI, RUC, CE)' })
  @IsOptional()
  @IsString()
  cliente_tipo_documento?: string;

  @ApiPropertyOptional({ description: 'Número de documento de identidad' })
  @IsOptional()
  @IsString()
  cliente_numero_documento?: string;

  @ApiPropertyOptional({ description: 'Teléfono o WhatsApp de contacto' })
  @IsOptional()
  @IsString()
  cliente_telefono?: string;

  @ApiPropertyOptional({ description: 'Dirección del cliente' })
  @IsOptional()
  @IsString()
  cliente_direccion?: string;

  @ApiPropertyOptional({ description: 'Método de pago (EFECTIVO, TARJETA, YAPE_PLIN, TRANSFERENCIA)' })
  @IsOptional()
  @IsString()
  metodo_pago?: string;

  @ApiPropertyOptional({ description: 'Observación o nota administrativa' })
  @IsOptional()
  @IsString()
  observacion?: string;
}
