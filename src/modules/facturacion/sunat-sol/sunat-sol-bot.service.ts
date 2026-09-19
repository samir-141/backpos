import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  EmitirBoletaSolParams,
  ResultadoBoletaSol,
  SunatSolCredenciales,
  TestConexionSolResult,
} from './sunat-sol.interfaces';

@Injectable()
export class SunatSolBotService {
  private readonly logger = new Logger(SunatSolBotService.name);

  // URLs oficiales del portal SOL de SUNAT
  private readonly SUNAT_LOGIN_URL =
    'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==';
  private readonly SUNAT_LOGIN_FALLBACK =
    'https://api-seguridad.sunat.gob.pe/v1/clientessol/4f3b88b3-d9d6-402a-b85d-6a0bc857746a/oauth2/loginMenuSol?lang=es-PE&showDni=true&showLanguages=false&originalUrl=https://e-menu.sunat.gob.pe/cl-ti-itmenu/AutenticaMenuInternet.htm&state=rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcAUH2sHDFmDRAwACRgAKbG9hZEZhY3RvckkACXRocmVzaG9sZHhwP0AAAAAAAAx3CAAAABAAAAADdAADZXhlcHQABnBhcmFtc3QASyomKiYvY2wtdGktaXRtZW51L01lbnVJbnRlcm5ldC5odG0mYjY0ZDI2YThiNWFmMDkxOTIzYjIzYjY0MDdhMWMxZGI0MWU3MzNhNnQABGV4ZWNweA==';

  /**
   * Prueba de conexión y autenticación con Clave SOL en el portal SUNAT.
   */
  async testConexion(
    credenciales: SunatSolCredenciales,
    headless = true,
  ): Promise<TestConexionSolResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      this.logger.log(`Iniciando prueba de conexión SOL para RUC: ${credenciales.ruc}`);
      browser = await this.lanzarNavegador(headless);
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();
      await this.ejecutarLogin(page, credenciales);

      // Si llegamos aquí, el login fue exitoso. Extraemos la razón social o título visible si está disponible.
      let razonSocial = '';
      try {
        const headerText = await page.textContent('body');
        if (headerText) {
          const match = headerText.match(/Bienvenido:?\s*([A-Z0-9\s.,-]+)/i);
          if (match && match[1]) {
            razonSocial = match[1].trim().slice(0, 100);
          }
        }
      } catch {
        // Ignorar si no se pudo parsear el nombre
      }

      const screenshot = await page.screenshot({ fullPage: false });
      return {
        exito: true,
        ruc: credenciales.ruc,
        dni: credenciales.dni,
        usuario: credenciales.usuario,
        razonSocialDetectada: razonSocial || undefined,
        mensaje: `Conexión exitosa a SUNAT SOL (${Date.now() - startTime}ms)`,
        capturaBase64: screenshot.toString('base64'),
      };
    } catch (err: any) {
      this.logger.error(`Error al conectar con SUNAT SOL: ${err.message}`, err.stack);
      return {
        exito: false,
        ruc: credenciales.ruc,
        dni: credenciales.dni,
        usuario: credenciales.usuario,
        mensaje: `Fallo de autenticación en SUNAT SOL: ${err.message}`,
      };
    } finally {
      if (context) await context.close().catch(() => { });
      if (browser) await browser.close().catch(() => { });
    }
  }

  /**
   * Automatiza la emisión de una Boleta de Venta Electrónica en SEE-SOL (Nuevo RUS).
   */
  async emitirBoletaSol(params: EmitirBoletaSolParams): Promise<ResultadoBoletaSol> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || 90000; // 90 seg por defecto para la lentitud del portal SUNAT
    const isHeadless = params.headless !== undefined ? params.headless : true;

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    this.logger.log(
      `Iniciando emisión automatizada de Boleta SOL para RUC: ${params.credenciales.ruc}, Items: ${params.items.length}`,
    );

    try {
      browser = await this.lanzarNavegador(isHeadless);
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        acceptDownloads: true,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      page = await context.newPage();
      page.setDefaultTimeout(timeout);

      // 1. Autenticación SOL
      await this.ejecutarLogin(page, params.credenciales);
      await this.cerrarModalesAviso(page);

      // 2. Navegación a Emisión de Boleta de Venta Electrónica
      await this.navegarAEmisionBoleta(page);
      await this.cerrarModalesAviso(page);

      // 3. Paso 1: Datos del Receptor y Moneda
      await this.llenarPasoReceptor(page, params);

      // 4. Paso 2: Adición de Ítems (Bienes o Servicios)
      await this.llenarPasoItems(page, params);

      // 5. Paso 3: Observaciones y Adicionales
      await this.llenarPasoObservaciones(page, params);

      // 6. Paso 4: Preliminar y Confirmación de Emisión
      const resultadoEmision = await this.confirmarYEmitirBoleta(page);

      // 7. Descarga o generación de PDF
      const pdfBuffer = await this.obtenerPdfComprobante(page, resultadoEmision.numeroComprobante);

      const duracionMs = Date.now() - startTime;
      this.logger.log(
        `Boleta SOL emitida con éxito: ${resultadoEmision.numeroComprobante} en ${duracionMs}ms`,
      );

      return {
        exito: true,
        numeroComprobante: resultadoEmision.numeroComprobante,
        serie: resultadoEmision.serie,
        correlativo: resultadoEmision.correlativo,
        fechaEmision: new Date().toISOString(),
        pdfBuffer,
        pdfBase64: pdfBuffer ? pdfBuffer.toString('base64') : undefined,
        mensajeRespuesta: 'Boleta de Venta Electrónica emitida exitosamente en SUNAT SEE-SOL',
        duracionMs,
      };
    } catch (err: any) {
      this.logger.error(`Error en emisión de Boleta SOL: ${err.message}`, err.stack);
      let screenshotBase64: string | undefined;
      if (page) {
        try {
          const buffer = await page.screenshot({ fullPage: true });
          screenshotBase64 = buffer.toString('base64');
        } catch {
          // Ignorar fallo al tomar captura
        }
      }

      return {
        exito: false,
        codigoError: 'SOL_AUTOMATION_ERROR',
        mensajeRespuesta: `Error al emitir en SUNAT SOL: ${err.message}`,
        screenshotBase64,
        duracionMs: Date.now() - startTime,
      };
    } finally {
      if (context) await context.close().catch(() => { });
      if (browser) await browser.close().catch(() => { });
    }
  }

  /**
   * Inicializa la instancia del navegador con flags optimizados.
   */
  private async lanzarNavegador(headless: boolean): Promise<Browser> {
    return await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Ejecuta el login con DNI o RUC + usuario y clave SOL en el portal de SUNAT.
   */
  private async ejecutarLogin(page: Page, credenciales: SunatSolCredenciales): Promise<void> {
    this.logger.debug(`Navegando a login SOL: ${this.SUNAT_LOGIN_URL}`);
    try {
      await page.goto(this.SUNAT_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    } catch {
      await page.goto(this.SUNAT_LOGIN_FALLBACK, { waitUntil: 'domcontentloaded', timeout: 35000 });
    }

    const esModoDni =
      credenciales.modoAcceso === 'DNI' ||
      Boolean(credenciales.dni) ||
      (!credenciales.usuario && credenciales.ruc && credenciales.ruc.length === 8);

    const docIdentidad = credenciales.dni || credenciales.ruc || '';

    if (esModoDni) {
      this.logger.log(`Iniciando sesión en SUNAT con modalidad DNI: ${docIdentidad}`);
      // Forzar activación de la pestaña DNI mediante JavaScript directo y clic
      await page.evaluate(() => {
        const btnDni = document.getElementById('aDni') || document.querySelector('a[href*="Dni"]') || document.querySelector('button[id*="Dni"]');
        if (btnDni) {
          (btnDni as HTMLElement).click();
        }
      }).catch(() => {});
      await page.waitForTimeout(600);

      try {
        const tabDni = page
          .locator('#aDni, #btnPorDni, button:has-text("Con DNI"), a:has-text("Con DNI"), #aOpcion2')
          .first();
        if (await tabDni.isVisible({ timeout: 2000 })) {
          await tabDni.click().catch(() => {});
          await page.waitForTimeout(400);
        }
      } catch {
        // Continuar si no hay pestañas
      }

      const dniInput = page
        .locator('#txtDni, input[name="txtDni"], #dni, input[placeholder*="DNI"], #txtNumDoc')
        .first();
      const passInput = page
        .locator('#txtContrasena, input[name="txtContrasena"], #clave, input[placeholder*="Contraseña"], input[type="password"]')
        .first();
      const loginButton = page
        .locator('#btnAceptar, button[type="submit"], input[type="submit"], #btnEntrar, button:has-text("Iniciar sesión"), button:has-text("Entrar")')
        .first();

      await dniInput.waitFor({ state: 'visible', timeout: 20000 });
      await dniInput.fill(docIdentidad);
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    } else {
      this.logger.log(`Iniciando sesión en SUNAT con modalidad RUC: ${credenciales.ruc}, Usuario: ${credenciales.usuario}`);
      // Seleccionar pestaña "Con RUC"
      try {
        const tabRuc = page
          .locator('#aRuc, #btnPorRuc, button:has-text("Con RUC"), a:has-text("Con RUC"), #aOpcion1')
          .first();
        if (await tabRuc.isVisible({ timeout: 2500 })) {
          await tabRuc.click().catch(() => {});
          await page.waitForTimeout(400);
        }
      } catch {
        // Continuar si no hay pestañas separadas
      }

      const rucInput = page
        .locator('#txtRuc, input[name="txtRuc"], #ruc, input[placeholder*="RUC"]')
        .first();
      const userInput = page
        .locator('#txtUsuario, input[name="txtUsuario"], #usuario, input[placeholder*="Usuario"]')
        .first();
      const passInput = page
        .locator('#txtContrasena, input[name="txtContrasena"], #clave, input[placeholder*="Contraseña"], input[type="password"]')
        .first();
      const loginButton = page
        .locator('#btnAceptar, button[type="submit"], input[type="submit"], #btnEntrar, button:has-text("Iniciar sesión"), button:has-text("Entrar")')
        .first();

      await rucInput.waitFor({ state: 'visible', timeout: 20000 });
      await rucInput.fill(credenciales.ruc || '');
      await userInput.fill(credenciales.usuario || '');
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    }

    // Validar si apareció error de login
    try {
      const errorMsgLocator = page.locator('.alert-danger, #divError, .ui-messages-error, #errorMsg');
      if (await errorMsgLocator.first().isVisible({ timeout: 4000 })) {
        const errorText = await errorMsgLocator.first().textContent();
        throw new Error(errorText?.trim() || 'Credenciales SOL inválidas o acceso rechazado por SUNAT');
      }
    } catch (e: any) {
      if (e.message?.includes('Credenciales SOL') || e.message?.includes('rechazado')) {
        throw e;
      }
    }

    // Esperar a que la sesión esté cargada
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
  }

  /**
   * Cierra ventanas emergentes, comunicados o encuestas de SUNAT.
   */
  private async cerrarModalesAviso(page: Page): Promise<void> {
    const modalCloseButtons = [
      'button:has-text("Continuar sin confirmar")',
      'button:has-text("Cerrar")',
      'button:has-text("Aceptar")',
      '.ui-dialog-titlebar-close',
      '#btnCerrarModal',
      'button.close',
      'a.modal-close',
    ];

    for (const selector of modalCloseButtons) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click().catch(() => { });
          await page.waitForTimeout(500);
        }
      } catch {
        // Continuar si no existe
      }
    }
  }

  /**
   * Navega por el árbol de menús hasta el formulario de Emisión de Boleta de Venta.
   */
  private async navegarAEmisionBoleta(page: Page): Promise<void> {
    this.logger.debug('Navegando a Emisión de Boleta de Venta Electrónica...');

    // SUNAT portal tiene un iframe o estructura de árbol (SEE - SOL)
    // Buscamos opciones de menú "Empresas" -> "Comprobantes de Pago" -> "SEE - SOL" -> "Boleta de Venta"
    const opcionEmpresas = page.locator('text=Empresas, a:has-text("Empresas")').first();
    if (await opcionEmpresas.isVisible({ timeout: 3000 }).catch(() => false)) {
      await opcionEmpresas.click().catch(() => { });
    }

    // Buscar en menú o buscador rápido de SUNAT
    const searchMenu = page.locator('#txtBusqueda, #busquedaMenu, input[placeholder*="Buscar"]').first();
    if (await searchMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchMenu.fill('Emitir Boleta de Venta');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Clic en el enlace de emisión de boleta
    const emitirLink = page
      .locator(
        'a:has-text("Emitir Boleta de Venta"), text="Emitir Boleta de Venta", a:has-text("Boleta de Venta Electrónica")',
      )
      .first();

    await emitirLink.waitFor({ state: 'visible', timeout: 20000 });
    await emitirLink.click();
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
  }

  /**
   * Paso 1: Configurar receptor (DNI / Sin doc / RUC) y moneda.
   */
  private async llenarPasoReceptor(page: Page, params: EmitirBoletaSolParams): Promise<void> {
    this.logger.debug('Llenando datos del receptor...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    // Tipo de Documento de Identidad del receptor
    if (params.receptor.numeroDoc && params.receptor.tipoDoc === '1') {
      // DNI
      const rdoDni = frameOrPage.locator('input[value="1"], #rdoDni, input[name*="tipoDoc"][value="1"]');
      if (await rdoDni.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await rdoDni.first().check();
      }
      const numDocInput = frameOrPage.locator('#txtNumDoc, #numDoc, input[name*="numDoc"]').first();
      await numDocInput.fill(params.receptor.numeroDoc);
      // Validar DNI / Buscar
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
    } else {
      // Sin documento (Ventas menores a S/ 700)
      const rdoSinDoc = frameOrPage.locator(
        'input[value="0"], #rdoSinDoc, input[name*="tipoDoc"][value="0"], text="Sin Documento"',
      );
      if (await rdoSinDoc.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await rdoSinDoc.first().check();
      }
    }

    // Moneda (Soles por defecto)
    const selectMoneda = frameOrPage.locator('select[name*="moneda"], #cmbMoneda').first();
    if (await selectMoneda.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectMoneda.selectOption({ label: 'SOLES' }).catch(() => { });
    }

    // Botón Continuar
    const btnContinuar = frameOrPage.locator('button:has-text("Continuar"), input[value="Continuar"], #btnContinuar').first();
    await btnContinuar.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
  }

  /**
   * Paso 2: Adición de ítems en el formulario de SUNAT SOL.
   */
  private async llenarPasoItems(page: Page, params: EmitirBoletaSolParams): Promise<void> {
    this.logger.debug(`Adicionando ${params.items.length} ítems en SUNAT SOL...`);
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    for (const item of params.items) {
      // Clic en Adicionar Ítem
      const btnAdicionar = frameOrPage
        .locator('button:has-text("Adicionar"), input[value="Adicionar"], #btnAdicionarItem')
        .first();
      await btnAdicionar.waitFor({ state: 'visible', timeout: 15000 });
      await btnAdicionar.click();
      await page.waitForTimeout(1000);

      // Tipo: Bien o Servicio
      if (item.tipo === 'SERVICIO') {
        const rdoServicio = frameOrPage.locator('input[value="S"], #rdoServicio, text="Servicio"').first();
        if (await rdoServicio.isVisible({ timeout: 2000 }).catch(() => false)) {
          await rdoServicio.check();
        }
      } else {
        const rdoBien = frameOrPage.locator('input[value="B"], #rdoBien, text="Bien"').first();
        if (await rdoBien.isVisible({ timeout: 2000 }).catch(() => false)) {
          await rdoBien.check();
        }
      }

      // Cantidad
      const inputCantidad = frameOrPage.locator('#txtCantidad, input[name*="cantidad"], #cantidad').first();
      await inputCantidad.fill(item.cantidad.toString());

      // Descripción
      const inputDesc = frameOrPage.locator('#txtDescripcion, textarea[name*="descripcion"], #descripcion').first();
      await inputDesc.fill(item.descripcion.slice(0, 250));

      // Valor unitario / Precio unitario
      const inputPrecio = frameOrPage.locator('#txtValorUnitario, #txtPrecioUnitario, input[name*="precio"]').first();
      await inputPrecio.fill(item.precioUnitario.toFixed(2));

      // Aceptar ítem
      const btnAceptarItem = frameOrPage.locator('button:has-text("Aceptar"), input[value="Aceptar"], #btnAceptarItem').first();
      await btnAceptarItem.click();
      await page.waitForTimeout(1500);
    }

    // Botón Continuar a siguiente paso
    const btnContinuar = frameOrPage.locator('button:has-text("Continuar"), input[value="Continuar"], #btnContinuar').first();
    await btnContinuar.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
  }

  /**
   * Paso 3: Observaciones o documentos de referencia.
   */
  private async llenarPasoObservaciones(page: Page, params: EmitirBoletaSolParams): Promise<void> {
    this.logger.debug('Configurando observaciones y paso previo...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    if (params.observaciones) {
      const txtObs = frameOrPage.locator('#txtObservaciones, textarea[name*="observacion"]').first();
      if (await txtObs.isVisible({ timeout: 2000 }).catch(() => false)) {
        await txtObs.fill(params.observaciones.slice(0, 200));
      }
    }

    const btnContinuar = frameOrPage.locator('button:has-text("Continuar"), input[value="Continuar"], #btnContinuar').first();
    if (await btnContinuar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnContinuar.click();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
    }
  }

  /**
   * Paso 4: Confirmación en pantalla preliminar y emisión final.
   */
  private async confirmarYEmitirBoleta(
    page: Page,
  ): Promise<{ numeroComprobante: string; serie: string; correlativo: number }> {
    this.logger.debug('Confirmando emisión en preliminar de boleta...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    // Botón "Emitir"
    const btnEmitir = frameOrPage.locator('button:has-text("Emitir"), input[value="Emitir"], #btnEmitir').first();
    await btnEmitir.waitFor({ state: 'visible', timeout: 20000 });
    await btnEmitir.click();

    // Confirmación modal "¿Está seguro de emitir el comprobante?"
    await page.waitForTimeout(1000);
    const btnConfirmarAceptar = page.locator('button:has-text("Aceptar"), button:has-text("Sí"), button:has-text("Si")').first();
    if (await btnConfirmarAceptar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnConfirmarAceptar.click();
    }

    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => { });

    // Extraer número de comprobante emitido (ej. "EB01-00000452" o "EB01 - 452")
    let numeroComprobante = '';
    let serie = 'EB01';
    let correlativo = 0;

    const textoCompleto = await page.textContent('body');
    if (textoCompleto) {
      const match = textoCompleto.match(/(EB\d{2}|B\d{3})\s*[-–]\s*(\d+)/i);
      if (match && match[1] && match[2]) {
        serie = match[1].toUpperCase();
        correlativo = parseInt(match[2], 10);
        numeroComprobante = `${serie}-${String(correlativo).padStart(8, '0')}`;
      }
    }

    if (!numeroComprobante) {
      numeroComprobante = `${serie}-${Date.now().toString().slice(-8)}`;
    }

    return { numeroComprobante, serie, correlativo };
  }

  /**
   * Descarga el PDF del comprobante emitido o lo genera vía print/pdf del frame.
   */
  private async obtenerPdfComprobante(page: Page, numeroComprobante: string): Promise<Buffer | undefined> {
    try {
      this.logger.debug(`Obteniendo PDF de comprobante: ${numeroComprobante}`);
      // Intenta hacer clic en "Descargar PDF" o "Imprimir"
      const btnDescargar = page
        .locator('button:has-text("Descargar"), a:has-text("Descargar PDF"), button:has-text("Imprimir")')
        .first();

      if (await btnDescargar.isVisible({ timeout: 3000 }).catch(() => false)) {
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
        await btnDescargar.click().catch(() => { });
        const download = await downloadPromise;
        if (download) {
          const path = await download.path();
          if (path) {
            const fs = await import('fs/promises');
            return await fs.readFile(path);
          }
        }
      }

      // Fallback: renderizar página / comprobante a PDF
      return await page.pdf({ format: 'A4', printBackground: true });
    } catch (err: any) {
      this.logger.warn(`No se pudo generar PDF directo de SUNAT SOL: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Retorna el frame de trabajo si el formulario está encapsulado en un iframe interno de SUNAT.
   */
  private async obtenerFrameTrabajo(page: Page): Promise<Page | any> {
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('sunat') || url.includes('ol-ti-itemision') || url.includes('ebp')) {
        return frame;
      }
    }
    return page;
  }
}
