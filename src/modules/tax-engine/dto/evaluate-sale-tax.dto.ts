import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ClienteTaxDto {
  @IsOptional()
  @IsString()
  tipoDoc?: string; // 1=DNI, 6=RUC, 4=CE, 0=SIN_DOC

  @IsOptional()
  @IsString()
  numeroDoc?: string;

  @IsOptional()
  @IsString()
  denominacion?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  solicitaComprobante?: boolean;

  @IsOptional()
  @IsBoolean()
  solicitaIdentificacion?: boolean;
}

export class EvaluateSaleTaxDto {
  @IsOptional()
  @IsUUID()
  perfilTributarioId?: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsOptional()
  @IsString()
  tipoDocumentoSeleccionado?: string; // 01, 03, 12, NOTA_VENTA, SIN_COMPROBANTE

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteTaxDto)
  cliente?: ClienteTaxDto;
}
