/**
 * SIMULACRO OFICIAL DE ALTA VELOCIDAD — EMISIÓN PLAYWRIGHT SUNAT SOL (NUEVO RUS)
 *
 * Ejecución:
 *   npx tsx scripts/simulacro-sunat-sol.ts
 *
 * Modo por defecto:
 *   - Navegador VISIBLE (headless: false) para ver la automatización en vivo.
 *   - MODO SEGURO / DRY-RUN (soloPreliminar: true): Llega hasta la pantalla final
 *     y verifica el botón "Emitir" sin emitir una boleta tributaria real.
 *
 * Para emitir de verdad con SUNAT:
 *   npx tsx scripts/simulacro-sunat-sol.ts --emitir
 */

import { SunatSolBotService } from '../src/modules/facturacion/sunat-sol/sunat-sol-bot.service';

const DNI = process.env.SUNAT_DNI || '40644730';
const CLAVE = process.env.SUNAT_CLAVE || 'Alarcon07';
const IS_HEADLESS = process.env.HEADLESS === 'true'; // Por defecto visible (false)
const EMITIR_REAL = process.argv.includes('--emitir') || process.env.EMITIR_REAL === 'true';

async function main() {
  console.log('\n============================================================');
  console.log(' 🚀 INICIANDO SIMULACRO DE EMISIÓN RÁPIDA SUNAT SOL');
  console.log(` 👤 DNI: ${DNI}`);
  console.log(` 🖥️  Navegador: ${IS_HEADLESS ? 'HEADLESS (Oculto)' : 'VISIBLE (Ventana interactiva)'}`);
  console.log(` ⚡ Modo: ${EMITIR_REAL ? 'EMISIÓN REAL EN SUNAT' : 'SIMULACRO SEGURO (Hasta Preliminar)'}`);
  console.log('============================================================\n');

  const botService = new SunatSolBotService();
  const inicio = Date.now();

  try {
    const resultado = await botService.emitirBoletaSol({
      boticaId: 'simulacro-local',
      credenciales: {
        dni: DNI,
        clave: CLAVE,
        modoAcceso: 'DNI',
      },
      tipoComprobante: 'BOLETA',
      moneda: 'PEN',
      headless: IS_HEADLESS,
      soloPreliminar: !EMITIR_REAL,
      receptor: {
        tipoDoc: '0', // SIN DOCUMENTO (Consumidor Final Nuevo RUS)
        razonSocialODatos: 'CLIENTE GENERAL',
      },
      items: [
        {
          descripcion: 'AGUA CIELO 500ML',
          cantidad: 1,
          precioUnitario: 1.5,
          tipo: 'BIEN',
          codigo: '7750670009041',
        },
      ],
      onProgreso: (p) => {
        const tiempo = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log(`[+${tiempo}s] \x1b[36m[Paso ${p.paso}/${p.totalPasos}]\x1b[0m \x1b[32m(${p.porcentaje}%)\x1b[0m ${p.titulo}: ${p.descripcion}`);
      },
    });

    const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log('\n============================================================');
    if (resultado.exito) {
      console.log(' \x1b[32m✔ SIMULACRO COMPLETADO EXITOSAMENTE\x1b[0m');
      console.log(` 📄 Comprobante / Estado: ${resultado.numeroComprobante || 'PRELIMINAR LISTO'}`);
      console.log(` ⏱️  Duración total: ${duracion} segundos`);
      if (!EMITIR_REAL) {
        console.log(' ℹ️  Se verificó la pantalla preliminar y el botón Emitir.');
        console.log('    (No se generó factura tributaria para proteger tus correlativos).');
      }
    } else {
      console.log(' \x1b[31m✖ ERROR EN LA EMISIÓN:\x1b[0m', resultado.mensajeRespuesta);
    }
    console.log('============================================================\n');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('\n\x1b[31m✖ Error inesperado:\x1b[0m', err.message);
  }
}

main();
