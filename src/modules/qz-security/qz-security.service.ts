import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants, createSign } from 'node:crypto';

@Injectable()
export class QzSecurityService {
  private readonly logger = new Logger(QzSecurityService.name);

  private readonly privateKeyPath = resolve(
    process.cwd(),
    process.env.QZ_PRIVATE_KEY_PATH ?? 'certs/private-key.pem',
  );

  private readonly certificatePath = resolve(
    process.cwd(),
    process.env.QZ_CERTIFICATE_PATH ?? 'certs/digital-certificate.txt',
  );

  getCertificate(): string {
    this.validateFile(this.certificatePath, 'certificado público');

    return readFileSync(this.certificatePath, 'utf8');
  }

  signMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      throw new InternalServerErrorException(
        'El mensaje que se desea firmar no es válido.',
      );
    }

    this.validateFile(this.privateKeyPath, 'clave privada');

    const privateKey = readFileSync(this.privateKeyPath, 'utf8');

    try {
      const signer = createSign('SHA512');

      signer.update(message, 'utf8');
      signer.end();

      return signer.sign(
        {
          key: privateKey,
          padding: constants.RSA_PKCS1_PADDING,
        },
        'base64',
      );
    } catch (error) {
      this.logger.error(
        'No se pudo firmar el mensaje solicitado por QZ Tray.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'No se pudo generar la firma para QZ Tray.',
      );
    }
  }

  private validateFile(filePath: string, description: string): void {
    if (!existsSync(filePath)) {
      this.logger.error(`No se encontró ${description}: ${filePath}`);

      throw new InternalServerErrorException(
        `No se encontró el ${description} de QZ Tray.`,
      );
    }
  }
}
