// src/modules/productos/responses/producto-detalle.response.ts
import { ApiProperty } from '@nestjs/swagger';

export class PrincipioActivoResponse {
    @ApiProperty() id: string;
    @ApiProperty() nombre: string;
}

export class FormaFarmaceuticaResponse {
    @ApiProperty() id: string;
    @ApiProperty() nombre: string;
}

export class MedicamentoResponse {
    @ApiProperty() id: string;
    @ApiProperty() concentracion: number;
    @ApiProperty() unidad_concentracion: string;
    @ApiProperty() via_administracion: string;
    @ApiProperty() requiere_receta: boolean;
    @ApiProperty() afecto_igv: boolean;
    @ApiProperty({ type: PrincipioActivoResponse }) principio_activo: PrincipioActivoResponse;
    @ApiProperty({ type: FormaFarmaceuticaResponse }) forma_farmaceutica: FormaFarmaceuticaResponse;
}

export class LaboratorioResponse {
    @ApiProperty() id: string;
    @ApiProperty() nombre: string;
    @ApiProperty({ required: false }) pais?: string;
}

export class CategoriaResponse {
    @ApiProperty() id: string;
    @ApiProperty() nombre: string;
}

export class UnidadResponse {
    @ApiProperty() id: string;
    @ApiProperty() nombre: string;
    @ApiProperty() abreviatura: string;
}

export class PresentacionResponse {
    @ApiProperty() id: string;
    @ApiProperty() cantidad_unidad_base: number;
    @ApiProperty() codigo_barras: string | null;
    @ApiProperty() precio_actual: number;
    @ApiProperty() orden: number | null;
    @ApiProperty({ type: UnidadResponse }) unidad_presentacion: UnidadResponse;
}

export class ProductoDetalleResponse {
    @ApiProperty() id: string;
    @ApiProperty() sku: string | null;
    @ApiProperty() nombre_comercial: string;
    @ApiProperty() registro_sanitario: string | null;
    @ApiProperty() codigo_interno: string | null;
    @ApiProperty() estado: string;
    @ApiProperty() created_at: Date;
    @ApiProperty({ type: MedicamentoResponse }) medicamento: MedicamentoResponse;
    @ApiProperty({ type: LaboratorioResponse }) laboratorio: LaboratorioResponse;
    @ApiProperty({ type: CategoriaResponse }) categoria: CategoriaResponse;
    @ApiProperty({ type: UnidadResponse }) unidad_base: UnidadResponse;
    @ApiProperty({ type: [PresentacionResponse] }) presentaciones: PresentacionResponse[];
}