import { Request } from 'express';

/** Request HTTP con el contexto inyectado por JwtStrategy + TenantGuard. */
export interface RequestAutenticada extends Request {
  botica_id: string;
  user: {
    id: string;
    correo: string;
    nombre: string;
    rol: string;
    botica_id: string;
    sucursal_id?: string;
    es_super_admin?: boolean;
  };
}
