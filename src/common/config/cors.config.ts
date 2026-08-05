import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export interface CorsEnvironment {
  CORS_ORIGINS?: string;
  NODE_ENV?: string;
}

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const CORS_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
];

function normalizeOrigin(value: string): string {
  const candidate = value.trim();
  if (!candidate || candidate === '*') {
    throw new Error(
      'CORS_ORIGINS debe contener orígenes explícitos; "*" no está permitido.',
    );
  }

  const parsed = new URL(candidate);
  if (
    !HTTP_PROTOCOLS.has(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`Origen CORS inválido: ${candidate}`);
  }
  return parsed.origin;
}

export function parseCorsOrigins(value?: string): ReadonlySet<string> {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
  return new Set(origins);
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isDevelopmentOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return (
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.') ||
    isPrivateIpv4(hostname)
  );
}

export function isCorsOriginAllowed(
  requestOrigin: string | undefined,
  environment: CorsEnvironment = process.env,
): boolean {
  // Clientes servidor-a-servidor, CLI y aplicaciones nativas no envían Origin.
  if (!requestOrigin) return true;

  let normalized: string;
  try {
    normalized = normalizeOrigin(requestOrigin);
  } catch {
    return false;
  }

  if (parseCorsOrigins(environment.CORS_ORIGINS).has(normalized)) return true;

  const mode = (environment.NODE_ENV || 'development').toLowerCase();
  return mode === 'development' && isDevelopmentOrigin(normalized);
}

export function createCorsOptions(
  environment: CorsEnvironment = process.env,
): CorsOptions {
  // Valida la configuración al arrancar para no operar con una allowlist defectuosa.
  parseCorsOrigins(environment.CORS_ORIGINS);

  return {
    origin: (requestOrigin, callback) => {
      if (isCorsOriginAllowed(requestOrigin, environment)) {
        callback(null, true);
        return;
      }
      callback(
        new Error(
          `Origen CORS no permitido: ${requestOrigin || 'desconocido'}`,
        ),
        false,
      );
    },
    methods: CORS_METHODS,
    credentials: true,
    optionsSuccessStatus: 204,
  };
}
