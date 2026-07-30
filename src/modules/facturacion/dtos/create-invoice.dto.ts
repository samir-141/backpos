import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TipoDocumentoSunat,
  TipoDocumentoIdentidad,
  AfectacionIgv,
} from '../sunat/catalogos.enum';

export class ClienteDto {
  @IsEnum(TipoDocumentoIdentidad)
  tipoDocumento: TipoDocumentoIdentidad;

  @IsString()
  @IsNotEmpty()
  numeroDocumento: string;

  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @IsString()
  @IsOptional()
  direccion?: string;
}

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  codigoProducto: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  unidadMedida: string; // Ej: NIU para unidades

  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsNumber()
  @Min(0)
  valorUnitario: number; // Sin IGV

  @IsNumber()
  @Min(0)
  precioUnitario: number; // Con IGV

  @IsNumber()
  @Min(0)
  subtotal: number; // valorUnitario * cantidad

  @IsNumber()
  @Min(0)
  igv: number;

  @IsNumber()
  @Min(0)
  total: number; // precioUnitario * cantidad

  @IsEnum(AfectacionIgv)
  tipoAfectacionIgv: AfectacionIgv;
}

export class CreateInvoiceDto {
  @IsEnum(TipoDocumentoSunat)
  tipoDocumento: TipoDocumentoSunat; // 01 Factura, 03 Boleta

  @IsString()
  @IsNotEmpty()
  serie: string; // F001, B001

  @IsNumber()
  @Min(1)
  correlativo: number;

  @IsDateString()
  fechaEmision: string; // YYYY-MM-DDTHH:mm:ss

  @IsString()
  @IsNotEmpty()
  moneda: string; // PEN, USD

  @ValidateNested()
  @Type(() => ClienteDto)
  cliente: ClienteDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items: InvoiceLineDto[];

  @IsNumber()
  @Min(0)
  totalGravadas: number;

  @IsNumber()
  @Min(0)
  totalExoneradas: number;

  @IsNumber()
  @Min(0)
  totalInafectas: number;

  @IsNumber()
  @Min(0)
  totalIgv: number;

  @IsNumber()
  @Min(0)
  importeTotal: number;
}
