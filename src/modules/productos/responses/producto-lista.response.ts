// src/modules/productos/responses/producto-lista.response.ts
import { ApiProperty } from '@nestjs/swagger';

export class ProductoListaItemResponse {
    @ApiProperty() producto_comercial_id: string;
    @ApiProperty() nombre_comercial: string;
    @ApiProperty() sku: string | null;
    @ApiProperty() codigo_interno: string | null;
    @ApiProperty() principio_activo: string;
    @ApiProperty() forma_farmaceutica: string;
    @ApiProperty() concentracion: number;
    @ApiProperty() unidad_concentracion: string;
    @ApiProperty() via_administracion: string;
    @ApiProperty() requiere_receta: boolean;
    @ApiProperty() afecto_igv: boolean;
    @ApiProperty() laboratorio: string;
    @ApiProperty() categoria: string;
    @ApiProperty() presentacion_id: string;
    @ApiProperty() presentacion_nombre: string;
    @ApiProperty() unidad_abreviatura: string;
    @ApiProperty() cantidad_unidad_base: number;
    @ApiProperty() precio_actual: number;
    @ApiProperty() codigo_barras: string | null;
    @ApiProperty() stock_total: number;
    @ApiProperty() lote_fefo_numero: string | null;
    @ApiProperty() lote_fefo_vencimiento: Date | null;
}

export class PaginationMetaResponse {
    @ApiProperty() total: number;
    @ApiProperty() page: number;
    @ApiProperty() limit: number;
    @ApiProperty() totalPages: number;
}

export class ProductoListaResponse {
    @ApiProperty({ type: [ProductoListaItemResponse] })
    data: ProductoListaItemResponse[];

    @ApiProperty({ type: PaginationMetaResponse })
    meta: PaginationMetaResponse;
}