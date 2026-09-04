import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CajasService } from './cajas.service';
import { todayInLima } from './utils/date-caja.utils';

@Injectable()
export class CajasAutoCierreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CajasAutoCierreService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private midnightTimeoutRef: NodeJS.Timeout | null = null;
  private startupTimeoutRef: NodeJS.Timeout | null = null;

  constructor(private readonly cajasService: CajasService) {}

  onModuleInit() {
    // 1. Escaneo inicial unos segundos después de que el backend inicie
    this.startupTimeoutRef = setTimeout(() => {
      void this.ejecutarEscaneoSeguro('INICIO_SISTEMA');
    }, 4000);

    // 2. Intervalo periódico de respaldo cada 10 minutos
    this.intervalRef = setInterval(
      () => {
        void this.ejecutarEscaneoSeguro('INTERVALO_PERIODICO');
      },
      10 * 60 * 1000,
    );

    // 3. Programar ejecución exacta a medianoche (hora Perú)
    this.programarMedianoche();

    this.logger.log(
      'Servicio de Cierre Automático de Caja por Cambio de Día inicializado correctamente.',
    );
  }

  onModuleDestroy() {
    if (this.startupTimeoutRef) clearTimeout(this.startupTimeoutRef);
    if (this.intervalRef) clearInterval(this.intervalRef);
    if (this.midnightTimeoutRef) clearTimeout(this.midnightTimeoutRef);
    this.logger.log('Servicio de Cierre Automático de Caja detenido.');
  }

  private async ejecutarEscaneoSeguro(origen: string) {
    try {
      this.logger.debug(
        `[${origen}] Escaneando cajas abiertas de días anteriores...`,
      );
      await this.cajasService.cerrarTodasCajasDiasAnteriores();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Error durante escaneo de auto-cierre (${origen}): ${errorMessage}`,
        errorStack,
      );
    }
  }

  private programarMedianoche() {
    if (this.midnightTimeoutRef) {
      clearTimeout(this.midnightTimeoutRef);
    }

    const msUntilMidnight = this.calcularMsHastaMedianocheLima();
    this.logger.log(
      `Próximo cierre automático programado a medianoche en ${(
        msUntilMidnight /
        1000 /
        60
      ).toFixed(1)} minutos.`,
    );

    this.midnightTimeoutRef = setTimeout(() => {
      void (async () => {
        await this.ejecutarEscaneoSeguro('MEDIANOCHE');
        this.programarMedianoche();
      })();
    }, msUntilMidnight);
  }

  private calcularMsHastaMedianocheLima(): number {
    const now = new Date();
    const limaDateStr = todayInLima(now);
    const [year, month, day] = limaDateStr.split('-').map(Number);
    // 00:00:05 en Lima (UTC-5) equivale a 05:00:05 UTC del día siguiente
    const tomorrowLimaMidnightUtc = new Date(
      Date.UTC(year, month - 1, day + 1, 5, 0, 5),
    );
    const diff = tomorrowLimaMidnightUtc.getTime() - now.getTime();
    return diff > 1000 ? diff : 60000;
  }
}
