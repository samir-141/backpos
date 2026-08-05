import { Test, TestingModule } from '@nestjs/testing';
import { PosventaController } from './posventa.controller';
import { PosventaService } from './posventa.service';

const BOTICA_ID = 'botica-1';

describe('PosventaController', () => {
  let controller: PosventaController;
  let service: jest.Mocked<PosventaService>;

  const mockReq = { botica_id: BOTICA_ID };

  beforeEach(async () => {
    service = {
      createDevolucion: jest.fn(),
      createCambio: jest.fn(),
      createGarantia: jest.fn(),
      createReclamo: jest.fn(),
      findByVenta: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosventaController],
      providers: [
        {
          provide: PosventaService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PosventaController>(PosventaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('createDevolucion', () => {
    it('debería llamar al servicio para crear devolución', async () => {
      const dto: Parameters<PosventaController['createDevolucion']>[0] = {
        venta_id: 'venta-1',
        motivo: 'Producto defectuoso',
        items: [{ detalle_venta_id: 'detalle-1', cantidad: 1 }],
      };
      service.createDevolucion.mockResolvedValue({
        exito: true,
        mensaje: 'Devolución registrada',
      } as any);

      const result = await controller.createDevolucion(dto, mockReq);

      expect(service.createDevolucion).toHaveBeenCalledWith(dto, BOTICA_ID);
      expect(result.exito).toBe(true);
    });
  });

  describe('createCambio', () => {
    it('debería llamar al servicio para crear cambio', async () => {
      const dto: Parameters<PosventaController['createCambio']>[0] = {
        venta_id: 'venta-1',
        motivo: 'Cliente quiere otro producto',
        items_devolver: [{ detalle_venta_id: 'detalle-1', cantidad: 1 }],
        items_entregar: [
          { producto_comercial_id: 'prod-1', cantidad: 1, precio_unitario: 50 },
        ],
      };
      service.createCambio.mockResolvedValue({
        exito: true,
        mensaje: 'Cambio registrado',
      } as any);

      const result = await controller.createCambio(dto, mockReq);

      expect(service.createCambio).toHaveBeenCalledWith(dto, BOTICA_ID);
      expect(result.exito).toBe(true);
    });
  });

  describe('createGarantia', () => {
    it('debería llamar al servicio para crear garantía', async () => {
      const dto: Parameters<PosventaController['createGarantia']>[0] = {
        venta_id: 'venta-1',
        detalle_venta_id: 'detalle-1',
        tipo: 'CAMBIO',
        motivo: 'Producto defectuoso',
      };
      service.createGarantia.mockResolvedValue({
        exito: true,
        mensaje: 'Garantía registrada',
      } as any);

      const result = await controller.createGarantia(dto, mockReq);

      expect(service.createGarantia).toHaveBeenCalledWith(dto, BOTICA_ID);
      expect(result.exito).toBe(true);
    });
  });

  describe('createReclamo', () => {
    it('debería llamar al servicio para crear reclamo', async () => {
      const dto: Parameters<PosventaController['createReclamo']>[0] = {
        venta_id: 'venta-1',
        tipo: 'PRODUCTO',
        descripcion: 'Producto en mal estado',
      };
      service.createReclamo.mockResolvedValue({
        exito: true,
        mensaje: 'Reclamo registrado',
      } as any);

      const result = await controller.createReclamo(dto, mockReq);

      expect(service.createReclamo).toHaveBeenCalledWith(dto, BOTICA_ID);
      expect(result.exito).toBe(true);
    });
  });

  describe('findByVenta', () => {
    it('debería llamar al servicio para buscar por venta', async () => {
      service.findByVenta.mockResolvedValue({
        venta_id: 'venta-1',
        devoluciones: [],
        cambios: [],
        garantias: [],
        reclamos: [],
      } as any);

      const result = await controller.findByVenta('venta-1', mockReq);

      expect(service.findByVenta).toHaveBeenCalledWith('venta-1', BOTICA_ID);
      expect(result.venta_id).toBe('venta-1');
    });
  });
});
