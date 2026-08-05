import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateGastoDto {
  @IsIn(['OPERATIVO', 'INVERSION'])
  tipo: 'OPERATIVO' | 'INVERSION';

  @IsString()
  categoria: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  monto: number;

  @IsOptional()
  @IsUUID()
  sucursal_id?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
