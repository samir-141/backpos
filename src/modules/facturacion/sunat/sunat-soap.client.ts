import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { AmbienteSunat } from '../domain/ambiente-sunat.enum';

export interface CredencialesSol {
  ruc: string;
  usuario: string;
  clave: string;
}

export interface SunatSendBillResult {
  exito: boolean;
  codigoHttp: number;
  /** ZIP de la CDR en base64 cuando SUNAT respondió con constancia. */
  cdrZipBase64?: string;
  codigoError?: string;
  mensajeError?: string;
  duracionMs: number;
}

export interface SunatTicketResult {
  exito: boolean;
  codigoHttp: number;
  ticket?: string;
  codigoError?: string;
  mensajeError?: string;
  duracionMs: number;
}

export interface SunatStatusResult {
  exito: boolean;
  codigoHttp: number;
  codigoRespuesta?: string;
  cdrZipBase64?: string;
  codigoError?: string;
  mensajeError?: string;
  duracionMs: number;
}

function escapeXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ENDPOINTS: Record<AmbienteSunat, string> = {
  [AmbienteSunat.BETA]:
    'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
  [AmbienteSunat.PRODUCCION]:
    'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
};

/**
 * Cliente SOAP directo para los Web Services de SUNAT
 * (sendBill, sendSummary, getStatus). Las credenciales viajan solo
 * dentro del sobre SOAP y nunca se registran en logs.
 */
@Injectable()
export class SunatSoapClient {
  private readonly logger = new Logger(SunatSoapClient.name);
  private readonly timeoutMs: number;

  constructor() {
    this.timeoutMs = Number(process.env.SUNAT_SOAP_TIMEOUT_MS ?? 30000);
  }

  endpointPara(ambiente: string): string {
    const esProduccion = ambiente === (AmbienteSunat.PRODUCCION as string);
    const envEndpoint = esProduccion
      ? process.env.SUNAT_PROD_ENDPOINT
      : process.env.SUNAT_BETA_ENDPOINT;
    return (
      envEndpoint ??
      ENDPOINTS[esProduccion ? AmbienteSunat.PRODUCCION : AmbienteSunat.BETA]
    );
  }

  async sendBill(
    ambiente: string,
    credenciales: CredencialesSol,
    nombreArchivoZip: string,
    zip: Buffer,
  ): Promise<SunatSendBillResult> {
    const body = `
      <ser:sendBill>
        <fileName>${escapeXml(nombreArchivoZip)}</fileName>
        <contentFile>${zip.toString('base64')}</contentFile>
      </ser:sendBill>`;
    const respuesta = await this.post(ambiente, credenciales, body);
    if (!respuesta.exito) return { ...respuesta, exito: false };

    const cdr = this.extraerTag(respuesta.xml, 'applicationResponse');
    if (!cdr) {
      return {
        ...respuesta,
        exito: false,
        codigoError: 'SOAP_SIN_CDR',
        mensajeError: 'SUNAT respondió HTTP 200 pero sin CDR',
      };
    }
    return { ...respuesta, exito: true, cdrZipBase64: cdr };
  }

  async sendSummary(
    ambiente: string,
    credenciales: CredencialesSol,
    nombreArchivoZip: string,
    zip: Buffer,
  ): Promise<SunatTicketResult> {
    const body = `
      <ser:sendSummary>
        <fileName>${escapeXml(nombreArchivoZip)}</fileName>
        <contentFile>${zip.toString('base64')}</contentFile>
      </ser:sendSummary>`;
    const respuesta = await this.post(ambiente, credenciales, body);
    if (!respuesta.exito) return { ...respuesta, exito: false };

    const ticket = this.extraerTag(respuesta.xml, 'ticket');
    if (!ticket) {
      return {
        ...respuesta,
        exito: false,
        codigoError: 'SOAP_SIN_TICKET',
        mensajeError: 'SUNAT no devolvió ticket para el resumen',
      };
    }
    return { ...respuesta, exito: true, ticket };
  }

  async getStatus(
    ambiente: string,
    credenciales: CredencialesSol,
    ticket: string,
  ): Promise<SunatStatusResult> {
    const body = `
      <ser:getStatus>
        <ticket>${escapeXml(ticket)}</ticket>
      </ser:getStatus>`;
    const respuesta = await this.post(ambiente, credenciales, body);
    if (!respuesta.exito) return { ...respuesta, exito: false };

    const status = respuesta.parsed?.['statusResponse'] as
      { statusCode?: unknown } | undefined;
    const statusCode =
      typeof status?.statusCode === 'string' ||
      typeof status?.statusCode === 'number'
        ? String(status.statusCode)
        : undefined;
    const cdr = this.extraerTag(respuesta.xml, 'content');
    return {
      exito: true,
      codigoHttp: respuesta.codigoHttp,
      duracionMs: respuesta.duracionMs,
      codigoRespuesta: statusCode,
      cdrZipBase64: cdr ?? undefined,
    };
  }

  private envoltura(credenciales: CredencialesSol, body: string): string {
    const usuario = `${credenciales.ruc}${credenciales.usuario}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(usuario)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(credenciales.clave)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>${body}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private async post(
    ambiente: string,
    credenciales: CredencialesSol,
    body: string,
  ): Promise<{
    exito: boolean;
    codigoHttp: number;
    xml: string;
    parsed?: Record<string, any>;
    codigoError?: string;
    mensajeError?: string;
    duracionMs: number;
  }> {
    const endpoint = this.endpointPara(ambiente);
    const inicio = Date.now();
    let codigoHttp = 0;
    let xml = '';
    try {
      const resp = await axios.post<string>(
        endpoint,
        this.envoltura(credenciales, body),
        {
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          timeout: this.timeoutMs,
          responseType: 'text',
          validateStatus: () => true,
        },
      );
      codigoHttp = resp.status;
      xml = typeof resp.data === 'string' ? resp.data : String(resp.data);
    } catch (error) {
      const err = error as AxiosError;
      this.logger.warn(
        `Error de conexión con SUNAT (${endpoint}): ${err.message}`,
      );
      return {
        exito: false,
        codigoHttp: 0,
        xml: '',
        codigoError: 'ERROR_CONEXION',
        mensajeError:
          err.code === 'ECONNABORTED'
            ? 'Tiempo de espera agotado con SUNAT'
            : 'No se pudo conectar con SUNAT',
        duracionMs: Date.now() - inicio,
      };
    }

    const parser = new XMLParser({
      removeNSPrefix: true,
      ignoreAttributes: true,
    });
    let parsed: Record<string, any> | undefined;
    try {
      parsed = parser.parse(xml) as Record<string, any>;
    } catch {
      parsed = undefined;
    }

    // Fault SOAP (credenciales inválidas, XML mal formado, etc.)
    const envelope = parsed?.['Envelope'] as Record<string, any> | undefined;
    const cuerpo = envelope?.['Body'] as Record<string, any> | undefined;
    const fault = cuerpo?.['Fault'] as Record<string, any> | undefined;
    if (fault) {
      const codigo = String(fault['faultcode'] ?? 'SOAP_FAULT');
      const detalle = fault['detail'] as Record<string, any> | undefined;
      const mensaje = String(
        detalle?.['message'] ?? fault['faultstring'] ?? 'Error SOAP de SUNAT',
      );
      return {
        exito: false,
        codigoHttp,
        xml,
        parsed: cuerpo,
        codigoError: codigo.replace(/^\D+/, '') || codigo,
        mensajeError: mensaje,
        duracionMs: Date.now() - inicio,
      };
    }

    if (codigoHttp !== 200) {
      return {
        exito: false,
        codigoHttp,
        xml,
        parsed: cuerpo,
        codigoError: `HTTP_${codigoHttp}`,
        mensajeError: `SUNAT respondió HTTP ${codigoHttp}`,
        duracionMs: Date.now() - inicio,
      };
    }

    return {
      exito: true,
      codigoHttp,
      xml,
      parsed: cuerpo,
      duracionMs: Date.now() - inicio,
    };
  }

  /** Respuesta SOAP: busca el tag dentro de Body (con o sin prefijo). */
  private extraerTag(xml: string, tag: string): string | null {
    const regex = new RegExp(
      `<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
    );
    const match = regex.exec(xml);
    return match?.[1]?.trim() ?? null;
  }
}
