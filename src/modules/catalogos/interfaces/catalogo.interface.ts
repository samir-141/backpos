// src/modules/catalogos/interfaces/catalogo.interface.ts

export interface ICatalogoItem {
    id: string;
    nombre: string;
    abreviatura?: string;
    descripcion?: string;
    pais?: string;
    telefono?: string;
    email?: string;
    created_at: Date;
    updated_at?: Date;
    created_by?: string;
    updated_by?: string;
}

export interface ICatalogoListaResponse {
    data: ICatalogoItem[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}