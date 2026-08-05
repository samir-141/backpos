import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class PrintingQzService {
  private readonly logger = new Logger(PrintingQzService.name);
  private privateKey: string | null = null;
  private algorithm: string;

  constructor(private readonly config: ConfigService) {
    this.algorithm = this.config.get<string>(
      'QZ_SIGNATURE_ALGORITHM',
      'SHA512withRSA',
    );
  }

  private loadPrivateKey(): string | null {
    if (this.privateKey) return this.privateKey;

    const keyPath = this.config.get<string>('QZ_PRIVATE_KEY_PATH');
    if (!keyPath) {
      this.logger.warn(
        'QZ_PRIVATE_KEY_PATH no está configurado. La firma de solicitudes QZ no está disponible.',
      );
      return null;
    }

    try {
      this.privateKey = fs.readFileSync(keyPath, 'utf-8');
      return this.privateKey;
    } catch (error) {
      this.logger.error(`Error al leer la clave privada QZ: ${error}`);
      return null;
    }
  }

  signRequest(request: string): string | null {
    const key = this.loadPrivateKey();
    if (!key) {
      this.logger.warn('No se puede firmar: clave privada no disponible.');
      return null;
    }

    try {
      const sign = crypto.createSign('RSA-SHA512');
      sign.update(request);
      sign.end();
      const signature = sign.sign(key, 'base64');
      return signature;
    } catch (error) {
      this.logger.error(`Error al firmar solicitud QZ: ${error}`);
      return null;
    }
  }

  getCertificate(): string | null {
    const certPath = this.config.get<string>('QZ_CERTIFICATE_PATH');
    if (!certPath) return null;

    try {
      return fs.readFileSync(certPath, 'utf-8');
    } catch (error) {
      this.logger.error(`Error al leer el certificado QZ: ${error}`);
      return null;
    }
  }

  isConfigured(): boolean {
    return this.config.get<string>('QZ_PRIVATE_KEY_PATH') !== undefined;
  }
}
