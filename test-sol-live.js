const { chromium } = require('playwright');

(async () => {
  console.log('--- Iniciando navegador Playwright para Emisión Boleta ---');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
    args: ['--start-maximized', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const url = 'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==';

  console.log('Navegando al portal de login...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  // Forzar activación de la pestaña DNI mediante JavaScript directo y clic
  console.log('Activando pestaña DNI...');
  await page.evaluate(() => {
    const btnDni = document.getElementById('aDni') || document.querySelector('a[href*="Dni"]') || document.querySelector('button[id*="Dni"]');
    if (btnDni) {
      btnDni.click();
    }
  });
  await page.waitForTimeout(1000);

  // Si aún no está visible, probar clic en selector
  try {
    const tabLocator = page.locator('#aDni, a:has-text("DNI")').first();
    if (await tabLocator.isVisible({ timeout: 2000 })) {
      await tabLocator.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  // Llenar campos DNI y Contraseña
  console.log('Llenando DNI: 40644730...');
  const dniInput = page.locator('#txtDni');
  await dniInput.waitFor({ state: 'visible', timeout: 15000 });
  await dniInput.fill('40644730');

  console.log('Llenando Contraseña...');
  const passInput = page.locator('#txtContrasena, input[type="password"]').first();
  await passInput.fill('Alarcon07');

  console.log('Haciendo clic en Iniciar Sesión...');
  const btnLogin = page.locator('#btnAceptar, button[type="submit"]').first();
  await btnLogin.click();

  console.log('Esperando autenticación y carga de menú de SUNAT...');
  await page.waitForTimeout(6000);
  console.log('URL tras login:', page.url());

  // Cerrar posibles modales
  for (let i = 0; i < 3; i++) {
    const btnCerrar = page.locator('button:has-text("Continuar"), button:has-text("Cerrar"), button:has-text("Aceptar"), a:has-text("Cerrar"), .ui-dialog-titlebar-close').first();
    if (await btnCerrar.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Cerrando modal emergente...');
      await btnCerrar.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  // Clic en pestaña Empresas
  console.log('Buscando pestaña Empresas...');
  const btnEmpresas = page.locator('a:has-text("Empresas"), text="Empresas", #divOpcion2, #aOpcion2').first();
  if (await btnEmpresas.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Clic en Empresas...');
    await btnEmpresas.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Buscar en el buscador rápido de SUNAT "Emitir Boleta"
  const searchMenu = page.locator('#txtBusqueda, #busquedaMenu, input[placeholder*="Buscar"]').first();
  if (await searchMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Escribiendo en buscador rápido de SUNAT: "Emitir Boleta"...');
    await searchMenu.fill('Emitir Boleta');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }

  console.log('Buscando enlace en el árbol de menús...');
  const linkEmitir = page.locator('a:has-text("Emitir Boleta"), a:has-text("Boleta de Venta")').first();
  if (await linkEmitir.isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log('Haciendo clic en Emitir Boleta de Venta...');
    await linkEmitir.click();
    await page.waitForTimeout(3000);
  }

  console.log('Ventana activa en tu pantalla. Tienes 60 segundos para visualizar e interactuar en directo...');
  await page.waitForTimeout(60000);

  await browser.close();
  console.log('--- Proceso finalizado ---');
})();
