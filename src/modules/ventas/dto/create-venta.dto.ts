import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DatosClienteDto {
    @ApiProperty()
    @IsString()
    tipo_documento: string;

    @ApiProperty()
    @IsString()
    numero_documento: string;

    @ApiProperty()
    @IsString()
    nombre_razon_social: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    direccion?: string;
}

export class DetalleVentaItemDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    producto_comercial_id: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    presentacion_nombre: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    cantidad: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    precio_unitario: number;
}

export class CreateVentaDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    tipo_comprobante: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    tipo_pago: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    metodo_pago: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    monto_recibido?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    vuelto?: number;

    @ApiPropertyOptional({ type: DatosClienteDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DatosClienteDto)
    datos_cliente?: DatosClienteDto;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    subtotal: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    igv: number;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    total: number;

    @ApiProperty({ type: [DetalleVentaItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DetalleVentaItemDto)
    items: DetalleVentaItemDto[];
}
