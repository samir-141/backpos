import { Prisma } from '../../../generated/prisma/client';
import { CorrelativosService } from '../services/correlativos.service';

type TxMock = {
  $queryRaw: jest.Mock;
  series_documentos: { findFirst: jest.Mock };
};

function txMock(
  filas: unknown[],
  serieExistente: unknown = null,
): Prisma.TransactionClient {
  const tx: TxMock = {
    $queryRaw: jest.fn().mockResolvedValue(filas),
    series_documentos: {
      findFirst: jest.fn().mockResolvedValue(serieExistente),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

describe('CorrelativosService', () => {
  let service: CorrelativosService;

  beforeEach(() => {
    service = new CorrelativosService();
  });

  it('incrementa y devuelve el correlativo reservado', async () => {
    const tx = txMock([
      {
        id: 's1',
        serie: 'B001',
        correlativo_asignado: 5,
        tipo_documento: 'BOLETA',
      },
    ]);
    const r = await service.reservarSiguiente(tx, 'botica-1', 's1');
    expect(r).toEqual({
      serieId: 's1',
      serie: 'B001',
      correlativo: 5,
      tipoDocumento: 'BOLETA',
    });

    expect((tx as unknown as TxMock).$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('falla si la serie no existe en la empresa', async () => {
    const tx = txMock([], null);
    await expect(
      service.reservarSiguiente(tx, 'botica-1', 'inexistente'),
    ).rejects.toThrow('no existe');
  });

  it('falla si la serie está inactiva', async () => {
    const tx = txMock([], { id: 's1', activo: false });
    await expect(
      service.reservarSiguiente(tx, 'botica-1', 's1'),
    ).rejects.toThrow('inactiva');
  });
});
