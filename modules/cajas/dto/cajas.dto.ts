import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AperturaCajaDto {
  @IsNumber({}, { message: 'El monto inicial debe ser un número válido' })
  @Min(0, { message: 'El monto inicial no puede ser negativo' })
  monto_inicial: number;

  @IsOptional()
  @IsString()
  sucursal_id?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class CierreCajaDto {
  @IsNumber({}, { message: 'El efectivo contado debe ser un número válido' })
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  efectivo_contado: number;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsOptional()
  @IsString()
  sucursal_id?: string;
}

export class MovimientoCajaDto {
  @IsString()
  tipo: 'INGRESO' | 'EGRESO';

  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @Min(0.1, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsString()
  observacion: string;

  @IsOptional()
  @IsString()
  sucursal_id?: string;
}
