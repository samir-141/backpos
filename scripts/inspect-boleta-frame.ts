import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('1. Login con DNI 40644730...');
  await page.goto(
    'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==',
    { waitUntil: 'domcontentloaded' }
  );

  const tabDni = page.locator('#aDni, #btnPorDni, a:has-text("DNI")').first();
  await tabDni.waitFor({ state: 'visible', timeout: 8000 });
  await tabDni.click();

  const dniInput = page.locator('#txtDni, input[name="txtDni"]').first();
  await dniInput.waitFor({ state: 'visible', timeout: 8000 });
  await dniInput.fill('40644730');
  await page.locator('#txtContrasena, input[name="txtContrasena"]').first().fill('Alarcon07');
  await page.locator('#btnAceptar, button[type="submit"]').first().click();

  console.log('2. Esperando MenuInternet.htm y pasando a Empresas...');
  const inicio = Date.now();
  while (Date.now() - inicio < 25000) {
    const url = page.url();
    if (url.includes('MenuInternet.htm') || (await page.locator('#divServicios, #divOpcionServicio2').first().isVisible().catch(() => false))) {
      break;
    }
    await page.waitForTimeout(200);
  }

  const btnEmpresas = page.locator('#divOpcionServicio2, [data-id="2"]').first();
  await btnEmpresas.waitFor({ state: 'visible', timeout: 15000 });
  await btnEmpresas.click({ force: true });
  await page.waitForTimeout(800);

  console.log('3. Ejecutando Boleta 11.5.4.1.1...');
  await page.evaluate(() => {
    (window as any).ejecuta(
      'MenuInternet.htm?action=execute&code=11.5.4.1.1',
      false,
      'Emitir Boleta de Venta',
      '#nivel1_11',
      '11.5.4.1.1'
    );
  });

  console.log('4. Esperando iframeApplication...');
  let targetFrame: any = null;
  const startWait = Date.now();
  while (Date.now() - startWait < 25000) {
    for (const f of page.frames()) {
      const ok = await f.evaluate(() => {
        return !!(document.getElementById('inicio.tipoDocumento') || document.querySelector('[id*="tipoDocumento"]'));
      }).catch(() => false);
      if (ok) {
        targetFrame = f;
        break;
      }
    }
    if (targetFrame) break;
    await page.waitForTimeout(250);
  }

  if (!targetFrame) {
    console.error('No se encontró el frame');
    await browser.close();
    return;
  }

  // PASO 1: SIN DOCUMENTO
  console.log('5. Seleccionando SIN DOCUMENTO y llenando CLIENTE GENERAL...');
  const flecha = targetFrame.locator('[id="widget_inicio.tipoDocumento"] .dijitArrowButton').first();
  await flecha.click({ force: true });
  await page.waitForTimeout(300);

  const optSinDoc = targetFrame.locator('#inicio\\.tipoDocumento_popup0').first();
  await optSinDoc.click({ force: true });
  await page.waitForTimeout(300);

  await targetFrame.evaluate(() => {
    const win = window as any;
    win.dijit?.byId('inicio.razonSocial')?.set('value', 'CLIENTE GENERAL');
    const el = document.getElementById('inicio.razonSocial') as HTMLInputElement;
    if (el) el.value = 'CLIENTE GENERAL';
  });

  console.log('6. Clic en Continuar (#inicio.botonGrabarDocumento)...');
  await targetFrame.locator('#inicio\\.botonGrabarDocumento').first().click({ force: true });

  // Esperar a que el formulario inicio.form desaparezca y aparezca item.form
  console.log('7. Esperando pantalla de ítems...');
  const tItems = Date.now();
  while (Date.now() - tItems < 20000) {
    const paso = await targetFrame.evaluate(() => {
      return !document.getElementById('inicio.form') && !!document.getElementById('item.form');
    }).catch(() => false);
    if (paso) break;
    await page.waitForTimeout(300);
  }

  console.log('8. Clic en Adicionar...');
  const btnAdd = targetFrame.locator('span[role="button"]:has-text("Adicionar"), button:has-text("Adicionar")')
    .filter({ visible: true })
    .first();
  await btnAdd.click({ force: true });

  console.log('9. Esperando modal de ítem...');
  const dlgItem = targetFrame.locator('.dijitDialog:not([style*="display: none"])').first();
  await dlgItem.waitFor({ state: 'visible', timeout: 8000 });

  // 1. Diagnóstico exacto de radios en el modal
  console.log('10. Inspeccionando radios en el modal...');
  const infoRadios = await targetFrame.evaluate(() => {
    const dlg = document.querySelector('.dijitDialog:not([style*="display: none"])');
    if (!dlg) return [];
    return Array.from(dlg.querySelectorAll('input[type="radio"]')).map((r: any) => ({
      id: r.id,
      name: r.name,
      value: r.value,
      parentText: r.parentElement?.textContent?.trim(),
      grandparentText: r.parentElement?.parentElement?.textContent?.trim(),
      wrapperWidgetId: r.closest('.dijitRadio')?.getAttribute('widgetid'),
      wrapperId: r.closest('.dijitRadio')?.id,
      html: r.closest('tr')?.outerHTML?.slice(0, 300)
    }));
  });
  console.log('RADIOS EN EL MODAL:\n', JSON.stringify(infoRadios, null, 2));

  // Clic en Bien según el ID / widget encontrado
  await targetFrame.evaluate(() => {
    const dlg = document.querySelector('.dijitDialog:not([style*="display: none"])');
    if (!dlg) return;
    const radios = Array.from(dlg.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    for (const r of radios) {
      const text = (r.closest('tr')?.textContent || r.parentElement?.textContent || '').toLowerCase();
      if (text.includes('bien') && !text.includes('servicio')) {
        r.click();
        const win = window as any;
        const wid = r.closest('.dijitRadio')?.getAttribute('widgetid') || r.id;
        if (wid) win.dijit?.byId(wid)?.set('checked', true);
        return;
      }
    }
    // Fallback: el primer radio del modal
    if (radios.length > 0) {
      radios[0].click();
      const win = window as any;
      const wid = radios[0].closest('.dijitRadio')?.getAttribute('widgetid') || radios[0].id;
      if (wid) win.dijit?.byId(wid)?.set('checked', true);
    }
  });
  await page.waitForTimeout(400);

  // 2. Código
  console.log('11. Llenando Código: 7750670009041...');
  const inpCodigo = dlgItem.locator('input.dijitInputInner[name*="codigo"], tr:has-text("Código") input.dijitInputInner, [id="item.codigoItem"]').first();
  if (await inpCodigo.isVisible().catch(() => false)) {
    await inpCodigo.fill('7750670009041');
  }

  // 3. Descripción
  console.log('12. Llenando Descripción: AGUA CIELO 500ML...');
  const inpDesc = dlgItem.locator('textarea, [id="item.descripcion"]').first();
  await inpDesc.fill('AGUA CIELO 500ML');

  // 4. Valor Unitario - usando input.dijitInputInner que no sea readonly!
  console.log('13. Llenando Valor Unitario: 1.50...');
  const inpPrecio = dlgItem.locator('input.dijitInputInner:not([readonly])').filter({ hasText: '' }).last();
  // Directamente con selector ID exacto:
  const inpPrecioExacto = dlgItem.locator('[id="item.valorUnitario"], tr:has-text("Valor Unitario") input.dijitInputInner:not([readonly])').first();
  await inpPrecioExacto.click({ force: true });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('1.50', { delay: 20 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);

  // Sincronizar Dojo
  await targetFrame.evaluate(() => {
    const win = window as any;
    const wVal = win.dijit?.byId('item.valorUnitario') || win.dijit?.byId('item.precioUnitario');
    if (wVal) {
      wVal.set('value', 1.5);
      wVal.set('displayedValue', '1.50');
      if (wVal.onChange) wVal.onChange(1.5);
    }
  });

  // 5. Clic en Aceptar en el modal
  console.log('14. Clic en Aceptar modal ([widgetid="item.botonAceptar"])...');
  const btnAceptarModal = dlgItem.locator('[widgetid="item.botonAceptar"], span.dijitButtonText:has-text("Aceptar")').first();
  await btnAceptarModal.click({ force: true });

  console.log('15. Esperando que el modal se cierre y aparezca en la tabla...');
  const tWaitModal = Date.now();
  let itemAgregado = false;
  while (Date.now() - tWaitModal < 10000) {
    const cerrado = await targetFrame.evaluate(() => {
      const dlg = document.querySelector('.dijitDialog:not([style*="display: none"])');
      const text = document.body.textContent || '';
      return !dlg && text.includes('AGUA CIELO');
    }).catch(() => false);
    if (cerrado) {
      itemAgregado = true;
      break;
    }
    await page.waitForTimeout(300);
  }

  console.log(`   ¿Ítem agregado?: ${itemAgregado}`);
  const ssPaso2Tabla = path.join(process.cwd(), 'logs', 'test-paso2-tabla-con-item.png');
  await page.screenshot({ path: ssPaso2Tabla, fullPage: false });
  console.log('Captura con ítem guardada en:', ssPaso2Tabla);

  // 6. Clic en Continuar en la pantalla de la tabla de ítems
  console.log('16. Localizando botón Continuar de la pantalla de ítems...');
  const btnContinuarPaso2 = targetFrame.locator('span[role="button"]:has-text("Continuar"), button:has-text("Continuar")')
    .filter({ visible: true })
    .first();
  console.log('17. Pulsando Continuar para avanzar a Observaciones / Preliminar...');
  await btnContinuarPaso2.click({ force: true });

  console.log('18. Esperando 5 segundos para ver siguiente pantalla...');
  await page.waitForTimeout(5000);

  const ssPaso3 = path.join(process.cwd(), 'logs', 'test-paso3-siguiente.png');
  await page.screenshot({ path: ssPaso3, fullPage: false });
  console.log('Captura de pantalla siguiente guardada en:', ssPaso3);

  // 7. Clic en Continuar en la pantalla de Observaciones (Paso 3 -> Preliminar)
  console.log('19. Pulsando Continuar en Observaciones (#docsrel.botonGrabarDocumento)...');
  const btnContinuarPaso3 = targetFrame.locator('#docsrel\\.botonGrabarDocumento, span[role="button"]:has-text("Continuar"), button:has-text("Continuar")')
    .filter({ visible: true })
    .first();
  await btnContinuarPaso3.click({ force: true });

  console.log('20. Esperando pantalla Preliminar...');
  const tPrelim = Date.now();
  let llegoPreliminar = false;
  while (Date.now() - tPrelim < 15000) {
    const hayEmitir = await targetFrame.evaluate(() => {
      const btn = document.querySelector('button:has-text("Emitir"), input[value*="Emitir"], [id*="Emitir"], [widgetid*="Emitir"]');
      const text = document.body.textContent || '';
      return !!btn || /emitir/i.test(text);
    }).catch(() => false);
    if (hayEmitir) {
      llegoPreliminar = true;
      break;
    }
    await page.waitForTimeout(300);
  }

  console.log(`   ¿Llegó a Preliminar?: ${llegoPreliminar}`);
  const ssPrelim = path.join(process.cwd(), 'logs', 'test-paso4-preliminar.png');
  await page.screenshot({ path: ssPrelim, fullPage: false });
  console.log('Captura de PRELIMINAR guardada en:', ssPrelim);

  // Diagnóstico final de la pantalla preliminar
  const diagPrelim = await targetFrame.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('span[role="button"], button, a, input[type="button"]'))
      .filter((b: any) => window.getComputedStyle(b).display !== 'none')
      .map((b: any) => ({ id: b.id, widgetId: b.getAttribute('widgetid'), val: (b as any).value, text: b.textContent?.trim() }));
    return btns;
  });
  console.log('BOTONES EN PRELIMINAR:', JSON.stringify(diagPrelim, null, 2));

  await browser.close();
}

main().catch(console.error);
