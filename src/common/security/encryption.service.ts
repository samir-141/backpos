import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifrado simétrico AES-256-GCM para secretos del módulo de facturación
 * (usuario/clave SOL, contraseña del certificado digital).
 * La clave maestra proviene de la variable de entorno ENCRYPTION_KEY
 * (64 caracteres hex = 32 bytes). Nunca se registra en logs.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer | null;

  constructor() {
    const hex = process.env.ENCRYPTION_KEY ?? '';
    this.key = /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, 'hex') : null;
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plainText: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const parts = payload.split('.');
    if (parts.length !== 3) {
      throw new InternalServerErrorException(
        'Formato de dato cifrado inválido',
      );
    }
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY no configurada: no se pueden cifrar/descifrar credenciales',
      );
    }
    return this.key;
  }
}
