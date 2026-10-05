/**
 * SIMULACRO DE ALTA VELOCIDAD: EMISIÓN DE BOLETA SEE-SOL (NUEVO RUS)
 *
 * Ejecución:
 *   node scripts/simulacro-sunat-sol.js
 *
 * Opciones por variables de entorno o argumentos:
 *   HEADLESS=false node scripts/simulacro-sunat-sol.js          (Abre el navegador visible)
 *   HEADLESS=true node scripts/simulacro-sunat-sol.js           (Ejecución en segundo plano)
 *   node scripts/simulacro-sunat-sol.js --emitir               (Emite de forma real en SUNAT)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DNI = process.env.SUNAT_DNI || '40644730';
const CLAVE = process.env.SUNAT_CLAVE || 'Alarcon07';
const IS_HEADLESS = process.env.HEADLESS === 'true';
const EMITIR_REAL = process.argv.includes('--emitir') || process.env.EMITIR_REAL === 'true';

const LOGIN_URL =
  'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==';

const logsDir = path.join(process.cwd(), 'logs', 'simulacro');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function logPaso(paso, msj) {
  const tiempo = new Date().toLocaleTimeString();
  console.log(`[${tiempo}] \x1b[36m[Paso ${paso}]\x1b[0m ${msj}`);
}

function logExito(msj) {
  console.log(`\x1b[32m✔ ${msj}\x1b[0m`);
}

function logInfo(msj) {
  console.log(`\x1b[33mℹ ${msj}\x1b[0m`);
}

async function obtenerFrameTrabajo(page) {
  for (const frame of page.frames()) {
    try {
      const tieneForm = await frame.evaluate(() => {
        return !!(
          document.getElementById('inicio.tipoDocumento') ||
          document.getElementById('inicio.numeroDocumento') ||
          document.getElementById('btnEmitir') ||
          document.querySelector('[id*="tipoDocumento"]') ||
          document.querySelector('button[id*="Continuar"], input[value*="Continuar"]') ||
          Array.from(document.querySelectorAll('button, input[type="button"]')).some(
            (b) => /emitir|continuar|adicionar/i.test(b.textContent || b.value || '')
          )
        );
      });
      if (tieneForm) return frame;
    } catch {
      // Ignorar frames en navegación
    }
  }

  const frameApp = page.frame({ name: 'iframeApplication' });
  if (frameApp) return frameApp;

  for (const frame of page.frames()) {
    const url = frame.url();
    if (
      url.includes('iframeApplication') ||
      url.includes('11.5.4.1.1') ||
      url.includes('ebp') ||
      url.includes('itemision')
    ) {
      return frame;
    }
  }

  return page;
}

async function autoAceptarModales(frameOrPage, page) {
  const selector = [
    '.dijitDialog button:has-text("Aceptar")',
    '.dijitDialog input[value="Aceptar"]',
    '.dijitDialog span.dijitButtonText:has-text("Aceptar")',
    '.dijitDialog button:has-text("Sí")',
    '.dijitDialog button:has-text("Si")',
    '#dlgBtnAceptar',
    'button:has-text("Aceptar")',
  ].join(', ');

  for (const target of [frameOrPage, page]) {
    try {
      const btn = target.locator(selector).filter({ visible: true }).first();
      if (await btn.isVisible({ timeout: 150 }).catch(() => false)) {
        console.log('   \x1b[35m[Auto-Modal]\x1b[0m Cuadro emergente detectado -> Aceptando automáticamente...');
        await btn.click({ force: true, timeout: 2000 }).catch(() => {});
        return true;
      }
    } catch {
      // Ignorar
    }
  }
  return false;
}

async function ejecutarSimulacro() {
  const inicioTotal = Date.now();
  console.log('\n============================================================');
  console.log(' 🚀 INICIANDO SIMULACRO DE EMISIÓN RÁPIDA SUNAT SOL');
  console.log(` 👤 Modo: DNI (${DNI})`);
  console.log(` 🖥️  Modo Navegador: ${IS_HEADLESS ? 'HEADLESS (Oculto)' : 'VISIBLE (Ventana interactiva)'}`);
  console.log(` ⚡ Tipo: ${EMITIR_REAL ? 'EMISIÓN REAL EN SUNAT' : 'SIMULACRO / DRY-RUN (Se detiene en Preliminar sin gastar boleta)'}`);
  console.log('============================================================\n');

  const browser = await chromium.launch({
    headless: IS_HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=site-per-process',
      '--start-maximized',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Optimización de red: abortar trackers y fuentes pesadas
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    const u = route.request().url().toLowerCase();
    if (t === 'font' || t === 'media') return route.abort().catch(() => {});
    if (u.includes('analytics') || u.includes('doubleclick') || u.includes('facebook') || u.includes('hotjar')) {
      return route.abort().catch(() => {});
    }
    return route.continue().catch(() => {});
  });

  // Auto-aceptar alertas nativas del navegador
  page.on('dialog', async (dialog) => {
    console.log(`   \x1b[35m[Alerta Nativa]\x1b[0m "${dialog.message()}" -> Aceptando`);
    await dialog.accept().catch(() => {});
  });

  try {
    // -------------------------------------------------------------
    // PASO 1: LOGIN ULTRA RÁPIDO
    // -------------------------------------------------------------
    const t0 = Date.now();
    logPaso(1, 'Navegando a formulario de autenticación SOL...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Clic en pestaña DNI
    const tabDni = page
      .getByRole('button', { name: 'DNI' })
      .or(page.locator('button:has-text("DNI"), a:has-text("DNI"), #aDni, #btnPorDni, [id*="Dni" i]'))
      .first();

    await tabDni.waitFor({ state: 'visible', timeout: 8000 });
    await tabDni.click();
    await page.evaluate(() => {
      const el = document.getElementById('aDni') || Array.from(document.querySelectorAll('button, a')).find(b => b.textContent && b.textContent.trim() === 'DNI');
      if (el) el.click();
    }).catch(() => {});

    const dniInput = page.locator('#txtDni, input[name="txtDni"], #dni').first();
    const passInput = page.locator('#txtContrasena, input[type="password"]').first();
    const loginBtn = page.locator('#btnAceptar, button[type="submit"]').first();

    await dniInput.waitFor({ state: 'visible', timeout: 10000 });
    await dniInput.fill(DNI);
    await passInput.fill(CLAVE);
    await loginBtn.click();

    // Esperar a salir del login
    const inicioLogin = Date.now();
    while (Date.now() - inicioLogin < 20000) {
      const url = page.url();
      if (!url.includes('oauth2/loginMenuSol') && (url.includes('menu') || url.includes('e-menu'))) {
        break;
      }
      await page.waitForTimeout(100);
    }
    logExito(`Sesión iniciada en ${Date.now() - t0} ms`);

    // Cerrar comunicados o avisos iniciales
    const cerrarAviso = page.locator('button:has-text("Continuar sin confirmar"), button:has-text("Cerrar")').first();
    if (await cerrarAviso.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cerrarAviso.click().catch(() => {});
    }

    // A) Diagnóstico HTML del contenido y frames
    const content = await page.content();
    const idx = content.indexOf('Empresas');
    console.log('   [Diagnóstico] Índice de "Empresas" en página principal:', idx);
    if (idx !== -1) {
      console.log('   [Diagnóstico HTML Empresas]:\n', content.slice(Math.max(0, idx - 250), idx + 250));
    } else {
      console.log('   [Diagnóstico] "Empresas" no está en página principal. Total frames:', page.frames().length);
      for (const f of page.frames()) {
        const fc = await f.content().catch(() => '');
        console.log(`   Frame [${f.name()} - ${f.url()}]: contiene Empresas? ${fc.includes('Empresas')}`);
      }
    }

    const t1 = Date.now();
    logPaso(2, 'Conmutando a Empresas y cargando emisión de Boleta (11.5.4.1.1)...');

    // Conmutar a Empresas (#divOpcionServicio2)
    const btnEmpresas = page.locator('#divOpcionServicio2, [data-id="2"]').first();
    await btnEmpresas.waitFor({ state: 'visible', timeout: 15000 });
    await btnEmpresas.click({ force: true });
    await page.waitForTimeout(800);

    // Ejecutar opción oficial de Boleta 11.5.4.1.1
    await page.evaluate(() => {
      if (typeof window.ejecuta === 'function') {
        window.ejecuta(
          'MenuInternet.htm?action=execute&code=11.5.4.1.1',
          false,
          'Emitir Boleta de Venta',
          '#nivel1_11',
          '11.5.4.1.1'
        );
      }
    });

    // Esperar al frame de trabajo de emisión
    const inicioEsperaFrame = Date.now();
    let frameOrPage = page;
    while (Date.now() - inicioEsperaFrame < 25000) {
      for (const f of page.frames()) {
        const ok = await f.evaluate(() => {
          return !!(
            document.getElementById('inicio.tipoDocumento') ||
            document.querySelector('[id*="tipoDocumento"]')
          );
        }).catch(() => false);
        if (ok) {
          frameOrPage = f;
          break;
        }
      }
      if (frameOrPage !== page) break;
      await page.waitForTimeout(200);
    }

    if (frameOrPage === page) {
      throw new Error('No se pudo acceder al iframe de emisión de boleta (SEE-SOL)');
    }
    logExito(`Formulario SEE-SOL cargado en ${Date.now() - t1} ms`);

    // -------------------------------------------------------------
    // PASO 3: CONFIGURACIÓN MÍNIMA DE RECEPTOR (NUEVO RUS / CONSUMIDOR FINAL)
    // -------------------------------------------------------------
    const t2 = Date.now();
    logPaso(3, 'Llenando datos del Receptor: SIN DOCUMENTO (Consumidor Final)...');

    // 1. Seleccionar "SIN DOCUMENTO" en combo Dijit (#widget_inicio.tipoDocumento)
    const flechaTipoDoc = frameOrPage.locator('[id="widget_inicio.tipoDocumento"] .dijitArrowButton').first();
    await flechaTipoDoc.waitFor({ state: 'visible', timeout: 8000 });
    await flechaTipoDoc.click({ force: true });
    await page.waitForTimeout(300);

    const optSinDoc = frameOrPage.locator('#inicio\\.tipoDocumento_popup0').first();
    await optSinDoc.waitFor({ state: 'visible', timeout: 5000 });
    await optSinDoc.click({ force: true });
    await page.waitForTimeout(300);

    // 2. Asignar Razón Social por defecto (campo deshabilitado nativamente)
    await frameOrPage.evaluate(() => {
      const win = window;
      if (win.dijit && win.dijit.byId) {
        win.dijit.byId('inicio.razonSocial')?.set('value', 'CLIENTE GENERAL');
      }
      const el = document.getElementById('inicio.razonSocial');
      if (el) el.value = 'CLIENTE GENERAL';
    }).catch(() => {});

    // 3. Clic en Continuar hacia la pantalla de ítems
    logInfo('Presionando botón Continuar (#inicio.botonGrabarDocumento)...');
    const btnContinuarPaso1 = frameOrPage.locator('#inicio\\.botonGrabarDocumento').first();
    await btnContinuarPaso1.waitFor({ state: 'visible', timeout: 10000 });
    await btnContinuarPaso1.click({ force: true });

    // Esperar a que la pantalla de ítems esté activa
    const inicioItems = Date.now();
    while (Date.now() - inicioItems < 15000) {
      const listo = await frameOrPage.evaluate(() => {
        return !document.getElementById('inicio.form') && !!document.getElementById('item.form');
      }).catch(() => false);
      if (listo) break;
      await page.waitForTimeout(200);
    }
    logExito(`Paso Receptor completado en ${Date.now() - t2} ms`);

    // -------------------------------------------------------------
    // PASO 4: ADICIONAR ÍTEM (BIEN, CANTIDAD 1, S/ 1.50)
    // -------------------------------------------------------------
    const t3 = Date.now();
    logPaso(4, 'Adicionando 1 Ítem de prueba en el comprobante...');

    const btnAddItem = frameOrPage.locator('#boleta\\.addItemButton, span[role="button"]:has-text("Adicionar"):not([id*="docrel"])').filter({ visible: true }).first();
    await btnAddItem.waitFor({ state: 'visible', timeout: 12000 });
    await btnAddItem.click({ force: true });

    const modalItem = frameOrPage.locator('.dijitDialog:not([style*="display: none"])').first();
    await modalItem.waitFor({ state: 'visible', timeout: 10000 });

    // Seleccionar "Bien"
    await frameOrPage.evaluate(() => {
      const dlg = document.querySelector('.dijitDialog:not([style*="display: none"])');
      if (!dlg) return;
      const radios = Array.from(dlg.querySelectorAll('input[type="radio"]'));
      for (const r of radios) {
        const text = (r.closest('tr')?.textContent || '').toLowerCase();
        if (text.includes('bien') && !text.includes('servicio')) {
          r.click();
          const wid = r.closest('.dijitRadio')?.getAttribute('widgetid') || r.id;
          if (wid && window.dijit?.byId) window.dijit.byId(wid)?.set('checked', true);
          return;
        }
      }
    }).catch(() => {});

    // Código
    const inputCod = modalItem.locator('[id="item.codigoItem"], input.dijitInputInner[name*="codigo"]').first();
    if (await inputCod.isVisible({ timeout: 1000 }).catch(() => false)) {
      await inputCod.fill('7750670009041');
    }

    // Descripción
    const inputDesc = modalItem.locator('textarea, [id="item.descripcion"]').first();
    await inputDesc.waitFor({ state: 'visible', timeout: 10000 });
    await inputDesc.fill('AGUA CIELO 500ML');

    // Valor Unitario (descartando iconos readonly de validación Dijit)
    const inputPrecio = modalItem.locator('[id="item.valorUnitario"], tr:has-text("Valor Unitario") input.dijitInputInner:not([readonly])').first();
    await inputPrecio.waitFor({ state: 'visible', timeout: 10000 });
    await inputPrecio.click({ force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('1.50', { delay: 20 });
    await page.keyboard.press('Tab');

    // Botón Aceptar en el modal
    logInfo('Guardando ítem...');
    const btnAceptarItem = modalItem.locator('[widgetid="item.botonAceptar"], span.dijitButtonText:has-text("Aceptar")').first();
    await btnAceptarItem.click({ force: true, timeout: 5000 });

    // Esperar reactivamente a que el modal se cierre
    const inicioItemTabla = Date.now();
    while (Date.now() - inicioItemTabla < 10000) {
      const cerrado = await frameOrPage.evaluate(() => {
        const dlg = document.querySelector('.dijitDialog:not([style*="display: none"])');
        return !dlg;
      }).catch(() => false);
      if (cerrado) break;
      await page.waitForTimeout(200);
    }
    logExito(`Ítem agregado correctamente a la tabla en ${Date.now() - t3} ms`);

    // -------------------------------------------------------------
    // PASO 5: AVANZAR A OBSERVACIONES Y PRELIMINAR
    // -------------------------------------------------------------
    const t4 = Date.now();
    logPaso(5, 'Avanzando hacia la pantalla Preliminar...');

    // Continuar desde Ítems (#boleta.botonGrabarDocumento)
    const btnContinuarPaso2 = frameOrPage.locator('#boleta\\.botonGrabarDocumento').first();
    await btnContinuarPaso2.waitFor({ state: 'visible', timeout: 10000 });
    await btnContinuarPaso2.click({ force: true });

    // Esperar pantalla de Observaciones
    const btnContinuarPaso3 = frameOrPage.locator('#docsrel\\.botonGrabarDocumento').first();
    await btnContinuarPaso3.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    // Continuar desde Observaciones (#docsrel.botonGrabarDocumento)
    await btnContinuarPaso3.click({ force: true });

    // Localizar el botón Emitir en Preliminar
    const btnEmitirFinal = frameOrPage.locator('#boleta-preliminar\\.botonGrabarDocumento').first();
    await btnEmitirFinal.waitFor({ state: 'visible', timeout: 20000 });
    logExito(`¡Pantalla Preliminar alcanzada en ${Date.now() - t4} ms!`);

    const screenshotPath = path.join(logsDir, 'simulacro-preliminar-exito.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logInfo(`Captura guardada en: ${screenshotPath}`);

    // -------------------------------------------------------------
    // PASO 6: EMISIÓN FINAL O DETENCIÓN EN MODO SEGURO
    // -------------------------------------------------------------
    if (!EMITIR_REAL) {
      console.log('\n------------------------------------------------------------');
      console.log(' 🛑 SIMULACRO COMPLETADO CON ÉXITO');
      console.log(' El flujo completo hasta la pantalla PRELIMINAR funcionó');
      console.log(' de manera impecable y en los mínimos pasos posibles.');
      console.log(' NOTA: El botón "Emitir" NO fue pulsado para proteger');
      console.log(' tu correlativo tributario en SUNAT (Modo Seguro).');
      console.log(' Para emitir de verdad, agrega la bandera --emitir al comando.');
      console.log('------------------------------------------------------------\n');
    } else {
      logPaso(6, 'Pulsando Emitir y confirmando con SUNAT...');
      await btnEmitirFinal.click({ timeout: 5000 });

      // Confirmar diálogo de "¿Está seguro de emitir...?"
      const btnAceptarEmision = frameOrPage.locator('button:has-text("Aceptar"), #btnAceptar').filter({ visible: true }).first();
      await btnAceptarEmision.waitFor({ state: 'visible', timeout: 8000 });
      await btnAceptarEmision.click({ timeout: 3000 });

      // Detectar número
      const inicioComp = Date.now();
      let comprobante = '';
      while (Date.now() - inicioComp < 15000) {
        const txt = (await page.textContent('body')) + ' ' + (await frameOrPage.textContent('body'));
        const m = txt.match(/(EB\d{2}|B\d{3})\s*[-–]\s*(\d+)/i);
        if (m) {
          comprobante = `${m[1]}-${m[2]}`;
          break;
        }
        await page.waitForTimeout(100);
      }
      logExito(`🎉 Comprobante emitido con éxito: ${comprobante}`);
    }

    const duracionTotal = ((Date.now() - inicioTotal) / 1000).toFixed(1);
    console.log(`⏱️  TIEMPO TOTAL TRANSCURRIDO: ${duracionTotal} segundos.`);
  } catch (err) {
    console.error('\n\x1b[31m✖ Error en el simulacro:\x1b[0m', err.message);
    const errPath = path.join(logsDir, 'simulacro-error.png');
    await page.screenshot({ path: errPath }).catch(() => {});
    console.error(`Captura del error guardada en: ${errPath}`);
  } finally {
    if (!IS_HEADLESS) {
      logInfo('Dejando navegador abierto 5 segundos para inspección visual...');
      await page.waitForTimeout(5000).catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

ejecutarSimulacro();
