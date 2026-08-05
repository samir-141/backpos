import { EncryptionService } from '../../../common/security/encryption.service';

const CLAVE_VALIDA =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

describe('EncryptionService', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  it('cifra y descifra correctamente (AES-256-GCM)', () => {
    process.env.ENCRYPTION_KEY = CLAVE_VALIDA;
    const service = new EncryptionService();
    const secreto = 'MiClaveSOL*2026';
    const cifrado = service.encrypt(secreto);

    expect(cifrado).not.toContain(secreto);
    expect(cifrado.split('.')).toHaveLength(3);
    expect(service.decrypt(cifrado)).toBe(secreto);
  });

  it('genera IV distinto en cada cifrado', () => {
    process.env.ENCRYPTION_KEY = CLAVE_VALIDA;
    const service = new EncryptionService();
    expect(service.encrypt('x')).not.toBe(service.encrypt('x'));
  });

  it('falla sin ENCRYPTION_KEY configurada', () => {
    delete process.env.ENCRYPTION_KEY;
    const service = new EncryptionService();
    expect(service.isConfigured()).toBe(false);
    expect(() => service.encrypt('x')).toThrow('ENCRYPTION_KEY');
  });

  it('falla al descifrar un payload manipulado', () => {
    process.env.ENCRYPTION_KEY = CLAVE_VALIDA;
    const service = new EncryptionService();
    const cifrado = service.encrypt('secreto');
    const partes = cifrado.split('.');
    const manipulado = [partes[0], partes[1], 'AAAA'].join('.');
    expect(() => service.decrypt(manipulado)).toThrow();
  });
});
