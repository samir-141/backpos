// src/common/integrations/padron.client.ts
// Cliente HTTP centralizado para la consulta del padrón (RENIEC DNI / SUNAT RUC)
// a través del proveedor externo. Reemplaza los `fetch()` dispersos en
// clientes.service.ts centralizando timeout, manejo de errores y la URL base.

import axios, { AxiosError } from 'axios';

const PADRON_BASE_URL = 'https://api.apis.net.pe/v1';
const PADRON_TIMEOUT_MS = 8000;

export interface PadronResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Consulta DNI (RENIEC) o RUC (SUNAT) en el proveedor de padrón.
 * Nunca lanza: devuelve `ok:false` ante errores de red, timeout o HTTP.
 */
export async function consultarPadron(
  tipoDocumento: 'DNI' | 'RUC',
  numeroDocumento: string,
): Promise<PadronResponse> {
  const endpoint = tipoDocumento === 'DNI' ? 'dni' : 'ruc';
  const url = `${PADRON_BASE_URL}/${endpoint}?numero=${encodeURIComponent(numeroDocumento)}`;

  try {
    const { data } = await axios.get(url, {
      timeout: PADRON_TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AxiosError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
