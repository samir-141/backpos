import { PrismaService } from '../../../prisma/prisma.service';
import { ComprobanteValidationService } from '../services/comprobante-validation.service';
import { EmitirComprobanteDto } from '../dtos/emitir-comprobante.dto';

const BOTICA = 'botica-1';

function dto(
  parcial: Partial<EmitirComprobanteDto> = {},
): EmitirComprobanteDto {
  return {
    ventaId: '11111111-1111-4111-8111-111111111111',
    tipoComprobante: '03',
    serieId: '22222222-2222-4222-8222-222222222222',
    ...parcial,
  };
}

function ventaOk() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    estado: 'EMITIDO',
    total: 100,
    cliente_id: 'c1',
    cajas: { sucursal_id: 'suc-1' },
    clientes: {
      tipo_documento: 'DNI',
      numero_documento: '72456189',
      nombre: 'JUAN PEREZ',
    } as {
      tipo_documento: string;
      numero_documento: string;
      nombre: string;
    } | null,
    detalles_ventas: [
      {
        cantidad: 1,
        productos_presentaciones: {
          productos_comerciales: {
            nombre_comercial: 'PARACETAMOL',
            medicamentos: { afecto_igv: true },
          },
        },
      },
    ],
  };
}

function serieOk() {
  return { id: 's1', activo: true, tipo_documento: 'BOLETA', serie: 'B001' };
}

function configOk() {
  return {
    id: 'cfg1',
    activo: true,
    regimen_tributario: 'GENERAL',
    certificado_fecha_vencimiento: new Date(Date.now() + 86400000),
  };
}

interface OpcionesMock {
  venta?: unknown;
  duplicado?: unknown;
  serie?: unknown;
  config?: unknown;
}

type PrismaMock = {
  ventas: { findFirst: jest.Mock };
  comprobantes_electronicos: { findFirst: jest.Mock };
  series_documentos: { findFirst: jest.Mock };
  configuraciones_tributarias: { findFirst: jest.Mock };
};

function prismaMock(opts: OpcionesMock): PrismaService {
  const mock: PrismaMock = {
    ventas: {
      findFirst: jest
        .fn()
        .mockResolvedValue('venta' in opts ? opts.venta : ventaOk()),
    },
    comprobantes_electronicos: {
      findFirst: jest
        .fn()
        .mockResolvedValue('duplicado' in opts ? opts.duplicado : null),
    },
    series_documentos: {
      findFirst: jest
        .fn()
        .mockResolvedValue('serie' in opts ? opts.serie : serieOk()),
    },
    configuraciones_tributarias: {
      findFirst: jest
        .fn()
        .mockResolvedValue('config' in opts ? opts.config : configOk()),
    },
  };
  return mock as unknown as PrismaService;
}

describe('ComprobanteValidationService', () => {
  let service: ComprobanteValidationService;

  const montar = (opts: OpcionesMock) => {
    service = new ComprobanteValidationService(prismaMock(opts));
  };

  it('acepta una boleta válida', async () => {
    montar({});
    const ctx = await service.validarYObtenerContexto(dto(), BOTICA, 'suc-1');
    expect(ctx.venta.id).toBe(dto().ventaId);
    expect(ctx.serie.serie).toBe('B001');
  });

  it('rechaza venta inexistente', async () => {
    montar({ venta: null });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('no existe');
  });

  it('rechaza venta de otra sucursal', async () => {
    montar({});
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA, 'otra-sucursal'),
    ).rejects.toThrow('sucursal');
  });

  it('rechaza venta anulada', async () => {
    const venta = ventaOk();
    venta.estado = 'ANULADO';
    montar({ venta });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('ANULADO');
  });

  it('rechaza comprobante duplicado', async () => {
    montar({
      duplicado: { serie: 'B001', correlativo: 1, estado: 'ACEPTADO' },
    });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('ya tiene el comprobante');
  });

  it('rechaza serie inactiva o de otro tipo', async () => {
    montar({ serie: { ...serieOk(), activo: false } });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('inactiva');

    montar({ serie: { ...serieOk(), tipo_documento: 'FACTURA' } });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('no corresponde');
  });

  it('rechaza si no hay configuración tributaria activa', async () => {
    montar({ config: null });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('configuración tributaria');
  });

  it('rechaza certificado vencido', async () => {
    montar({
      config: {
        ...configOk(),
        certificado_fecha_vencimiento: new Date(Date.now() - 86400000),
      },
    });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('vencido');
  });

  it('bloquea factura en régimen Nuevo RUS', async () => {
    montar({
      config: { ...configOk(), regimen_tributario: 'NUEVO_RUS' },
      serie: { ...serieOk(), tipo_documento: 'FACTURA' },
    });
    await expect(
      service.validarYObtenerContexto(dto({ tipoComprobante: '01' }), BOTICA),
    ).rejects.toThrow('Nuevo RUS');
  });

  it('bloquea cualquier comprobante con régimen desconocido', async () => {
    montar({ config: { ...configOk(), regimen_tributario: 'OTRO' } });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('no permite emitir');
  });

  it('permite factura en régimen RER con cliente RUC', async () => {
    const venta = ventaOk();
    venta.clientes = {
      tipo_documento: 'RUC',
      numero_documento: '20123456789',
      nombre: 'EMPRESA CLIENTE SAC',
    };
    montar({
      venta,
      config: { ...configOk(), regimen_tributario: 'RER' },
      serie: { ...serieOk(), tipo_documento: 'FACTURA' },
    });
    const ctx = await service.validarYObtenerContexto(
      dto({ tipoComprobante: '01' }),
      BOTICA,
    );
    expect(ctx.serie.tipo_documento).toBe('FACTURA');
  });

  it('exige RUC de 11 dígitos para factura', async () => {
    montar({ serie: { ...serieOk(), tipo_documento: 'FACTURA' } });
    await expect(
      service.validarYObtenerContexto(dto({ tipoComprobante: '01' }), BOTICA),
    ).rejects.toThrow('RUC');
  });

  it('exige DNI o CE en boletas de S/ 700 o más', async () => {
    const venta = ventaOk();
    venta.total = 750;
    venta.clientes = null;
    montar({ venta });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('DNI o CE');
  });

  it('exige ítems en la venta', async () => {
    const venta = ventaOk();
    venta.detalles_ventas = [];
    montar({ venta });
    await expect(
      service.validarYObtenerContexto(dto(), BOTICA),
    ).rejects.toThrow('ítems');
  });
});
