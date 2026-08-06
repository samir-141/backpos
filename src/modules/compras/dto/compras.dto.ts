import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCompraDetalleDto {
  @IsUUID()
  producto_presentacion_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cantidad: number;

  /** Costo de compra por presentación, antes de IGV. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(999_999_999)
  costo_unitario: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero_lote?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fecha_fabricacion?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fecha_vencimiento?: string;
}

export class CreateCompraDto {
  @IsOptional()
  @IsUUID()
  proveedor_id?: string;

  @IsOptional()
  @IsUUID()
  sucursal_id?: string;

  @Transform(trim)
  @IsString()
  @Length(1, 10)
  @Matches(/^[A-Za-z0-9-]+$/)
  serie: string;

  @Transform(trim)
  @IsString()
  @Length(1, 20)
  @Matches(/^[A-Za-z0-9-]+$/)
  numero: string;

  @IsOptional()
  @IsDateString({ strict: true })
  fecha?: string;

  // Se aceptan por compatibilidad del cliente, pero nunca se usan para persistir.
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  igv?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  total?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateCompraDetalleDto)
  detalles: CreateCompraDetalleDto[];
}

export class QueryComprasDto {
  @IsOptional()
  @IsUUID()
  sucursal_id?: string;

  @IsOptional()
  @IsUUID()
  proveedor_id?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  buscar?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
