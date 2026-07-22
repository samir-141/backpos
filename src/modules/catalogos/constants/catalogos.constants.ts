// src/modules/catalogos/constants/catalogos.constants.ts

/**
 * Catálogos soportados por el módulo genérico.
 * Cada entrada define: tabla, campos únicos, campos opcionales específicos.
 */
export type CampoEspecial =
    | 'abreviatura'
    | 'descripcion'
    | 'pais'
    | 'telefono'
    | 'email';
export interface CatalogoConfig {
    tabla: string;
    camposUnicos: string[];
    camposEspeciales: CampoEspecial[];
}

export const CATALOGOS_CONFIG: Record<string, CatalogoConfig> = {
    'principios-activos': {
        tabla: 'principios_activos',
        camposUnicos: ['nombre'],
        camposEspeciales: ['descripcion'],
    },
    'formas-farmaceuticas': {
        tabla: 'formas_farmaceuticas',
        camposUnicos: ['nombre'],
        camposEspeciales: [],
    },
    'laboratorios': {
        tabla: 'laboratorios',
        camposUnicos: ['nombre'],
        camposEspeciales: ['pais', 'telefono', 'email'],
    },
    'categorias': {
        tabla: 'categorias',
        camposUnicos: ['nombre'],
        camposEspeciales: [],
    },
    'unidades-presentacion': {
        tabla: 'unidades_presentacion',
        camposUnicos: ['nombre', 'abreviatura'],
        camposEspeciales: ['abreviatura'],
    },
} as const;

export type TipoCatalogo = keyof typeof CATALOGOS_CONFIG;

export const TIPOS_CATALOGO = Object.keys(CATALOGOS_CONFIG) as TipoCatalogo[];