import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page, Frame } from 'playwright';
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
      this.logger.log(
        `Iniciando prueba de conexión SOL para RUC: ${credenciales.ruc}`,
      );
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
      this.logger.error(
        `Error al conectar con SUNAT SOL: ${err.message}`,
        err.stack,
      );
      return {
        exito: false,
        ruc: credenciales.ruc,
        dni: credenciales.dni,
        usuario: credenciales.usuario,
        mensaje: `Fallo de autenticación en SUNAT SOL: ${err.message}`,
      };
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Automatiza la emisión de una Boleta de Venta Electrónica en SEE-SOL (Nuevo RUS).
   */
  async emitirBoletaSol(
    params: EmitirBoletaSolParams,
  ): Promise<ResultadoBoletaSol> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || 90000; // 90 seg por defecto para la lentitud del portal SUNAT
    const envHeadless = process.env.SUNAT_SOL_HEADLESS;
    const isHeadless =
      envHeadless !== undefined
        ? envHeadless !== 'false'
        : params.headless !== undefined
          ? params.headless
          : true;

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

      // 2. Navegación a Emisión de Boleta o Factura Electrónica
      await this.navegarAEmision(page, params.tipoComprobante || 'BOLETA');
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
      const pdfBuffer =
        resultadoEmision.pdfBuffer ||
        (await this.obtenerPdfComprobante(
          page,
          resultadoEmision.numeroComprobante,
        ));

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
        mensajeRespuesta:
          'Boleta de Venta Electrónica emitida exitosamente en SUNAT SEE-SOL',
        duracionMs,
      };
    } catch (err: any) {
      this.logger.error(
        `Error en emisión de Boleta SOL: ${err.message}`,
        err.stack,
      );
      let screenshotBase64: string | undefined;
      if (page) {
        try {
          const buffer = await page.screenshot({ fullPage: true });
          screenshotBase64 = buffer.toString('base64');

          // Guardar captura física en disco para inspección visual directa
          const logsDir = path.join(
            process.cwd(),
            'logs',
            'sunat-sol-screenshots',
          );
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = path.join(logsDir, `error-${timestamp}.png`);
          fs.writeFileSync(screenshotPath, buffer);
          this.logger.error(
            `[DIAGNÓSTICO VISUAL] Captura de error guardada en: ${screenshotPath}`,
          );

          const htmlPath = path.join(logsDir, `error-${timestamp}.html`);
          const htmlContent = await page.content();
          fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
          this.logger.error(
            `[DIAGNÓSTICO VISUAL] Volcado HTML de la pantalla guardado en: ${htmlPath}`,
          );
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
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Inicializa la instancia del navegador con flags optimizados y modo visible/slowMo si se desea.
   */
  private async lanzarNavegador(headless: boolean): Promise<Browser> {
    const slowMo = process.env.SUNAT_SOL_SLOWMO
      ? parseInt(process.env.SUNAT_SOL_SLOWMO, 10)
      : headless
        ? 0
        : 350;

    return await chromium.launch({
      headless,
      slowMo,
      args: headless
        ? [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ]
        : ['--start-maximized'],
    });
  }

  /**
   * Ejecuta el login con DNI o RUC + usuario y clave SOL en el portal de SUNAT.
   */
  private async ejecutarLogin(
    page: Page,
    credenciales: SunatSolCredenciales,
  ): Promise<void> {
    this.logger.debug(`Navegando a login SOL: ${this.SUNAT_LOGIN_URL}`);
    try {
      await page.goto(this.SUNAT_LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
    } catch {
      await page.goto(this.SUNAT_LOGIN_FALLBACK, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
    }

    const esModoDni =
      credenciales.modoAcceso === 'DNI' ||
      Boolean(credenciales.dni) ||
      (!credenciales.usuario &&
        credenciales.ruc &&
        credenciales.ruc.length === 8);

    const docIdentidad = credenciales.dni || credenciales.ruc || '';

    if (esModoDni) {
      this.logger.log(
        `Iniciando sesión en SUNAT con modalidad DNI: ${docIdentidad}`,
      );
      // Forzar activación de la pestaña DNI mediante JavaScript directo y clic
      await page
        .evaluate(() => {
          const btnDni =
            document.getElementById('aDni') ||
            document.querySelector('a[href*="Dni"]') ||
            document.querySelector('button[id*="Dni"]');
          if (btnDni) {
            btnDni.click();
          }
        })
        .catch(() => {});
      await page.waitForTimeout(600);

      try {
        const tabDni = page
          .getByRole('button', { name: 'DNI' })
          .or(
            page.locator(
              '#aDni, #btnPorDni, button:has-text("Con DNI"), a:has-text("Con DNI"), #aOpcion2',
            ),
          )
          .first();
        if (await tabDni.isVisible({ timeout: 2000 })) {
          await tabDni.click().catch(() => {});
          await page.waitForTimeout(400);
        }
      } catch {
        // Continuar si no hay pestañas
      }

      const dniInput = page
        .getByRole('textbox', { name: 'DNI' })
        .or(
          page.locator(
            '#txtDni, input[name="txtDni"], #dni, input[placeholder*="DNI"], #txtNumDoc',
          ),
        )
        .first();
      const passInput = page
        .getByRole('textbox', { name: 'Contraseña' })
        .or(
          page.locator(
            '#txtContrasena, input[name="txtContrasena"], #clave, input[placeholder*="Contraseña"], input[type="password"]',
          ),
        )
        .first();
      const loginButton = page
        .getByRole('button', { name: 'Iniciar sesión' })
        .or(
          page.locator(
            '#btnAceptar, button[type="submit"], input[type="submit"], #btnEntrar, button:has-text("Iniciar sesión"), button:has-text("Entrar")',
          ),
        )
        .first();

      await dniInput.waitFor({ state: 'visible', timeout: 20000 });
      await dniInput.click().catch(() => {});
      await dniInput.fill(docIdentidad);
      await passInput.click().catch(() => {});
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    } else {
      this.logger.log(
        `Iniciando sesión en SUNAT con modalidad RUC: ${credenciales.ruc}, Usuario: ${credenciales.usuario}`,
      );
      // Seleccionar pestaña "Con RUC"
      try {
        const tabRuc = page
          .getByRole('button', { name: 'RUC' })
          .or(
            page.locator(
              '#aRuc, #btnPorRuc, button:has-text("Con RUC"), a:has-text("Con RUC"), #aOpcion1',
            ),
          )
          .first();
        if (await tabRuc.isVisible({ timeout: 2500 })) {
          await tabRuc.click().catch(() => {});
          await page.waitForTimeout(400);
        }
      } catch {
        // Continuar si no hay pestañas separadas
      }

      const rucInput = page
        .getByRole('textbox', { name: 'RUC' })
        .or(
          page.locator(
            '#txtRuc, input[name="txtRuc"], #ruc, input[placeholder*="RUC"]',
          ),
        )
        .first();
      const userInput = page
        .getByRole('textbox', { name: 'Usuario' })
        .or(
          page.locator(
            '#txtUsuario, input[name="txtUsuario"], #usuario, input[placeholder*="Usuario"]',
          ),
        )
        .first();
      const passInput = page
        .getByRole('textbox', { name: 'Contraseña' })
        .or(
          page.locator(
            '#txtContrasena, input[name="txtContrasena"], #clave, input[placeholder*="Contraseña"], input[type="password"]',
          ),
        )
        .first();
      const loginButton = page
        .getByRole('button', { name: 'Iniciar sesión' })
        .or(
          page.locator(
            '#btnAceptar, button[type="submit"], input[type="submit"], #btnEntrar, button:has-text("Iniciar sesión"), button:has-text("Entrar")',
          ),
        )
        .first();

      await rucInput.waitFor({ state: 'visible', timeout: 20000 });
      await rucInput.click().catch(() => {});
      await rucInput.fill(credenciales.ruc || '');
      await userInput.click().catch(() => {});
      await userInput.fill(credenciales.usuario || '');
      await passInput.click().catch(() => {});
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    }

    // Validar si apareció error de login
    try {
      const errorMsgLocator = page.locator(
        '.alert-danger, #divError, .ui-messages-error, #errorMsg',
      );
      if (await errorMsgLocator.first().isVisible({ timeout: 4000 })) {
        const errorText = await errorMsgLocator.first().textContent();
        throw new Error(
          errorText?.trim() ||
            'Credenciales SOL inválidas o acceso rechazado por SUNAT',
        );
      }
    } catch (e: any) {
      if (
        e.message?.includes('Credenciales SOL') ||
        e.message?.includes('rechazado')
      ) {
        throw e;
      }
    }

    // Esperar a que la sesión esté cargada
    await page
      .waitForLoadState('networkidle', { timeout: 25000 })
      .catch(() => {});
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
          await btn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      } catch {
        // Continuar si no existe
      }
    }
  }

  /**
   * Navega por el árbol de menús hasta el formulario de Emisión de Boleta o Factura en SEE-SOL.
   */
  private async navegarAEmision(
    page: Page,
    tipoComprobante: 'BOLETA' | 'FACTURA' = 'BOLETA',
  ): Promise<void> {
    const esFactura = tipoComprobante === 'FACTURA';
    this.logger.debug(
      `Navegando a Emisión de ${esFactura ? 'Factura' : 'Boleta'} Electrónica en SEE-SOL...`,
    );

    // 1. Clic en pestaña o sección "Empresas"
    try {
      const opcionEmpresas = page
        .getByRole('heading', { name: 'Empresas' })
        .or(page.getByText('Empresas'))
        .first();
      if (await opcionEmpresas.isVisible({ timeout: 5000 })) {
        await opcionEmpresas.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}

    // 2. Clic en "Comprobantes de pago"
    try {
      const menuComprobantes = page
        .getByRole('listitem')
        .filter({ hasText: 'Comprobantes de pago' })
        .or(page.getByText('Comprobantes de pago'))
        .first();
      if (await menuComprobantes.isVisible({ timeout: 4000 })) {
        await menuComprobantes.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}

    // 3. Clic en "SEE - SOL"
    try {
      const seeSol = page.getByText('SEE - SOL').first();
      if (await seeSol.isVisible({ timeout: 4000 })) {
        await seeSol.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}

    // 4. Tipo de Comprobante específico (Boleta o Factura)
    if (esFactura) {
      const menuFactura = page.getByText('Factura Electrónica').first();
      if (await menuFactura.isVisible({ timeout: 4000 })) {
        await menuFactura.click().catch(() => {});
        await page.waitForTimeout(500);
      }
      const emitirFactura = page
        .getByRole('link', { name: 'Emitir Factura' })
        .or(page.getByText('Emitir Factura'))
        .first();
      await emitirFactura.waitFor({ state: 'visible', timeout: 20000 });
      await emitirFactura.click();
    } else {
      const menuBoleta = page.getByText('Boleta de Venta Electrónica').first();
      if (await menuBoleta.isVisible({ timeout: 4000 })) {
        await menuBoleta.click().catch(() => {});
        await page.waitForTimeout(500);
      }
      const emitirBoleta = page
        .getByRole('link', { name: 'Emitir Boleta de Venta' })
        .or(page.getByText('Emitir Boleta de Venta'))
        .first();
      await emitirBoleta.waitFor({ state: 'visible', timeout: 20000 });
      await emitirBoleta.click();
    }

    await page
      .waitForLoadState('networkidle', { timeout: 20000 })
      .catch(() => {});
  }

  /**
   * Mapea el tipo de documento del receptor con la opción exacta en el combo Dojo de SUNAT SOL.
   * Basado en el recorrido exhaustivo del menú grabado en la sesión en vivo:
   * - DOC. NACIONAL DE IDENTIDAD
   * - REG. UNICO DE CONTRIBUYENTES
   * - CARNÉ DE EXTRANJERÍA
   * - PASAPORTE
   * - CARNE DE IDENTIDAD
   * - DOC.IDENTIF.PERS.NAT.NO DOM.
   * - TAX IDENTIFICATION NUMBER
   * - IDENTIFICATION NUMBER
   * - PERMISO TEMP.PERMANENCIA - PT
   * - SALVOCONDUCTO
   * - CARNE PERMISO TEMP.PERMAN -CP
   * - DOC.TRIB.NO.DOM.SIN.RUC
   */
  private obtenerNombreOpcionTipoDoc(tipoDoc: string, numDoc?: string): string {
    if (!numDoc || tipoDoc === '-' || tipoDoc === '0') {
      return 'DOC.TRIB.NO.DOM.SIN.RUC';
    }
    const t = tipoDoc.toUpperCase();
    if (t === '1' || t === 'DNI') return 'DOC. NACIONAL DE IDENTIDAD';
    if (t === '6' || t === 'RUC') return 'REG. UNICO DE CONTRIBUYENTES';
    if (t === '4' || t === 'CE' || t === 'CARNET_EXTRANJERIA')
      return 'CARNÉ DE EXTRANJERÍA';
    if (t === '7' || t === 'PASAPORTE') return 'PASAPORTE';
    if (t === 'A' || t.includes('IDENTIDAD')) return 'CARNE DE IDENTIDAD';
    if (t === 'B' || t.includes('NO_DOM') || t.includes('NO DOM'))
      return 'DOC.IDENTIF.PERS.NAT.NO DOM.';
    if (t === 'C' || t.includes('TAX') || t.includes('TIN'))
      return 'TAX IDENTIFICATION NUMBER';
    if (t === 'D' || t === 'IN' || t.includes('IDENTIFICATION NUMBER'))
      return 'IDENTIFICATION NUMBER';
    if (t === 'E' || t.includes('PTP') || t.includes('PERMANENCIA'))
      return 'PERMISO TEMP.PERMANENCIA - PT';
    if (t === 'F' || t.includes('SALVOCONDUCTO')) return 'SALVOCONDUCTO';
    if (t === 'G' || t.includes('CPP') || t.includes('CP'))
      return 'CARNE PERMISO TEMP.PERMAN -CP';

    return 'DOC. NACIONAL DE IDENTIDAD';
  }

  /**
   * Paso 1: Configurar receptor (DNI / Sin doc / RUC / otros) y moneda.
   */
  private async llenarPasoReceptor(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug('Llenando datos del receptor...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    const tipoDoc = params.receptor.tipoDoc;
    const numDoc = params.receptor.numeroDoc?.trim();

    // 1. Selector de Tipo de Documento en portal SOL (Dojo / iframeApplication)
    const comboTipoDoc = frameOrPage
      .locator('[id="inicio.tipoDocumento"]')
      .first();
    const flechaCombo = frameOrPage.locator('.dijitReset.dijitRight').first();

    const nombreOpcion = this.obtenerNombreOpcionTipoDoc(tipoDoc, numDoc);

    if (await comboTipoDoc.isVisible({ timeout: 4000 }).catch(() => false)) {
      await comboTipoDoc.click().catch(() => {});
      await page.waitForTimeout(300);

      const opt = frameOrPage
        .getByRole('option', { name: nombreOpcion })
        .first();
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await opt.click();
      } else if (
        await flechaCombo.isVisible({ timeout: 1500 }).catch(() => false)
      ) {
        await flechaCombo.click().catch(() => {});
        await page.waitForTimeout(300);
        await frameOrPage
          .getByRole('option', { name: nombreOpcion })
          .first()
          .click()
          .catch(() => {});
      }
      await page.waitForTimeout(300);
    } else {
      // Fallback selector legacy por radio button
      if (tipoDoc === '1' && numDoc) {
        const rdoDni = frameOrPage
          .locator(
            'input[value="1"], #rdoDni, input[name*="tipoDoc"][value="1"]',
          )
          .first();
        if (await rdoDni.isVisible({ timeout: 1500 }).catch(() => false)) {
          await rdoDni.check();
        }
      } else if (tipoDoc === '6' && numDoc) {
        const rdoRuc = frameOrPage
          .locator(
            'input[value="6"], #rdoRuc, input[name*="tipoDoc"][value="6"]',
          )
          .first();
        if (await rdoRuc.isVisible({ timeout: 1500 }).catch(() => false)) {
          await rdoRuc.check();
        }
      } else {
        const rdoSinDoc = frameOrPage
          .locator(
            'input[value="0"], #rdoSinDoc, input[name*="tipoDoc"][value="0"]',
          )
          .or(frameOrPage.getByText('Sin Documento'))
          .first();
        if (await rdoSinDoc.isVisible({ timeout: 1500 }).catch(() => false)) {
          await rdoSinDoc.check();
        }
      }
    }

    // 2. Número de documento
    if (numDoc) {
      const inputNumDoc = frameOrPage
        .locator(
          '[id="inicio.numeroDocumento"], #txtNumDoc, #numDoc, input[name*="numDoc"]',
        )
        .first();
      if (await inputNumDoc.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inputNumDoc.click();
        await inputNumDoc.fill(numDoc);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(800);
      }
    }

    // 3. Moneda (si aplica)
    const selectMoneda = frameOrPage
      .locator('select[name*="moneda"], #cmbMoneda')
      .first();
    if (await selectMoneda.isVisible({ timeout: 1500 }).catch(() => false)) {
      await selectMoneda.selectOption({ label: 'SOLES' }).catch(() => {});
    }

    // 4. Continuar al siguiente paso: en SUNAT SOL se pulsa Continuar para validar DNI/RUC y avanzar a la pantalla de ítems
    for (let c = 0; c < 2; c++) {
      // Si ya llegamos a la pantalla de ítems (Adicionar visible), NO volver a presionar Continuar
      const btnAdicionarYaVisible = frameOrPage
        .getByRole('button', { name: 'Adicionar' })
        .filter({ visible: true })
        .or(
          frameOrPage
            .locator(
              'button:not([id*="docrel"]):has-text("Adicionar"), a:has-text("Adicionar"), span:has-text("Adicionar")',
            )
            .filter({ visible: true }),
        );

      if (
        await btnAdicionarYaVisible
          .first()
          .isVisible({ timeout: 1200 })
          .catch(() => false)
      ) {
        this.logger.debug(
          'Pantalla de ítems ya visible (botón Adicionar detectado). Deteniendo Continuar de receptor.',
        );
        break;
      }

      const btnContinuar = frameOrPage
        .getByRole('button', { name: 'Continuar' })
        .or(
          frameOrPage.locator(
            'button:has-text("Continuar"), input[value="Continuar"], #btnContinuar',
          ),
        )
        .filter({ visible: true })
        .first();

      if (await btnContinuar.isVisible({ timeout: 4000 }).catch(() => false)) {
        this.logger.debug(`Presionando Continuar (paso receptor ${c + 1})...`);
        await btnContinuar.click().catch(() => {});
        await page.waitForTimeout(1500);

        // Si aparece diálogo modal de confirmación o alerta (Dojo / SUNAT)
        const btnAceptarAviso = frameOrPage
          .getByRole('button', { name: 'Aceptar' })
          .or(frameOrPage.locator('#dlgBtnAceptar'))
          .filter({ visible: true })
          .first();
        if (
          await btnAceptarAviso.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await btnAceptarAviso.click().catch(() => {});
          await page.waitForTimeout(600);
        }
      }
    }

    await page
      .waitForLoadState('networkidle', { timeout: 15000 })
      .catch(() => {});
  }

  /**
   * Paso 2: Adición de ítems en el formulario de SUNAT SOL.
   * Utiliza los datos reales de la venta/boleta (código, descripción, cantidad, precio).
   */
  private async llenarPasoItems(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug(
      `Adicionando ${params.items.length} ítems en SUNAT SOL con datos de venta...`,
    );
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    // Iterar y agregar cada ítem a la tabla ANTES de pulsar cualquier Continuar
    for (const [index, item] of params.items.entries()) {
      this.logger.debug(
        `Insertando ítem ${index + 1}/${params.items.length}: ${item.descripcion} (S/ ${item.precioUnitario})...`,
      );

      // 1. Clic en "Adicionar" sobre la tabla de ítems
      const btnAdicionar = frameOrPage
        .getByRole('button', { name: 'Adicionar' })
        .filter({ visible: true })
        .or(
          frameOrPage
            .locator(
              'button:not([id*="docrel"]):has-text("Adicionar"), a:has-text("Adicionar"), span:has-text("Adicionar"), #detalle\\.botonAddItem, #item\\.botonAddItem',
            )
            .filter({ visible: true }),
        )
        .first();

      await btnAdicionar.waitFor({ state: 'visible', timeout: 25000 });
      await btnAdicionar.click();
      await page.waitForTimeout(800);

      // 2. Código de barras del ítem (código de usuario)
      const codigoAEnviar = item.codigo?.trim() || String(index + 1);
      const inputCodigo = frameOrPage
        .locator(
          '[id="item.codigoItem"], #txtCodigo, input[name*="codigoItem"]',
        )
        .first();
      if (await inputCodigo.isVisible({ timeout: 4000 }).catch(() => false)) {
        await inputCodigo.click();
        await inputCodigo.fill(codigoAEnviar);
        await page.waitForTimeout(300);
      }

      // 3. Descripción del ítem (producto)
      const inputDesc = frameOrPage
        .locator('[id="item.descripcion"]')
        .or(
          frameOrPage.locator(
            'textarea[name*="descripcion"], #txtDescripcion, #descripcion, textarea',
          ),
        )
        .filter({ visible: true })
        .first();

      await inputDesc.waitFor({ state: 'visible', timeout: 8000 });
      await inputDesc.click();
      await inputDesc.fill(item.descripcion.slice(0, 250));
      await page.waitForTimeout(300);

      // Verificación de escritura: si el valor quedó en blanco por lag de Dojo, reintentar con type
      const descActual = await inputDesc.inputValue().catch(() => '');
      if (!descActual || descActual.trim() === '') {
        this.logger.debug(
          `Reintentando llenado de descripción: ${item.descripcion}`,
        );
        await inputDesc.focus();
        await page.keyboard.type(item.descripcion.slice(0, 250), { delay: 25 });
        await page.waitForTimeout(300);
      }

      // 4. Cantidad
      const inputCantidad = frameOrPage
        .locator('[id="item.cantidad"], #txtCantidad, input[name*="cantidad"]')
        .first();
      if (await inputCantidad.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputCantidad.click();
        await inputCantidad.fill(item.cantidad.toString());
        await page.waitForTimeout(200);
      }

      // 5. Tipo: Servicio (si aplica, solo si es un radio button real)
      if (item.tipo === 'SERVICIO') {
        const rdoServicio = frameOrPage
          .getByRole('radio', { name: /servicio/i })
          .or(
            frameOrPage.locator(
              'input[type="radio"][value="S"], input[type="radio"][name*="tipo"][value="S"]',
            ),
          )
          .first();
        if (await rdoServicio.isVisible({ timeout: 1000 }).catch(() => false)) {
          await rdoServicio.check().catch(() => {});
        }
      }

      // 6. Precio Unitario / Valor Unitario
      const inputPrecio = frameOrPage
        .locator(
          '[id="item.precioUnitario"], [id="item.valorUnitario"], #txtValorUnitario, #txtPrecioUnitario, input[name*="precio"], input[name*="valorUnitario"]',
        )
        .first();
      if (await inputPrecio.isVisible({ timeout: 3000 }).catch(() => false)) {
        await inputPrecio.click();
        await inputPrecio.fill(item.precioUnitario.toFixed(2));
        await page.waitForTimeout(300);
      }

      // 7. Botón Aceptar para guardar el ítem en la tabla
      const btnAceptarItem = frameOrPage
        .getByRole('button', { name: 'Aceptar' })
        .or(
          frameOrPage.locator(
            'button:has-text("Aceptar"), input[value="Aceptar"], #btnAceptarItem, #dlgBtnAceptar',
          ),
        )
        .filter({ visible: true })
        .first();
      await btnAceptarItem.click();
      await page.waitForTimeout(800);

      // 8. Diálogo modal intermedio de confirmación / afectación si aparece
      const dialogAfectacion = frameOrPage
        .locator('#dlgBtnAceptar')
        .or(frameOrPage.locator('div').filter({ hasText: /^●Aceptar$/ }))
        .filter({ visible: true })
        .first();
      if (
        await dialogAfectacion.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await dialogAfectacion.click().catch(() => {});
        await page.waitForTimeout(400);

        const radioOption = frameOrPage.getByRole('radio').first();
        if (await radioOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isChecked = await radioOption.isChecked().catch(() => false);
          if (!isChecked) {
            await radioOption.check().catch(() => {});
            await page.waitForTimeout(300);
          }
          const btnAceptarDialogo = frameOrPage
            .getByRole('button', { name: 'Aceptar' })
            .filter({ visible: true })
            .first();
          if (
            await btnAceptarDialogo
              .isVisible({ timeout: 1500 })
              .catch(() => false)
          ) {
            await btnAceptarDialogo.click().catch(() => {});
            await page.waitForTimeout(400);
          }
        }
      }

      // 9. Si el modal de Nuevo Item sigue abierto (requería confirmar precio o segundo Aceptar)
      const modalAunVisible = frameOrPage
        .locator('[id="item.precioUnitario"], [id="item.descripcion"]')
        .filter({ visible: true })
        .first();
      if (
        await modalAunVisible.isVisible({ timeout: 1500 }).catch(() => false)
      ) {
        if (await inputPrecio.isVisible({ timeout: 1000 }).catch(() => false)) {
          await inputPrecio.click();
          await inputPrecio.fill(item.precioUnitario.toFixed(2));
          await page.waitForTimeout(300);
        }
        const btnReintentarAceptar = frameOrPage
          .getByRole('button', { name: 'Aceptar' })
          .filter({ visible: true })
          .first();
        if (
          await btnReintentarAceptar
            .isVisible({ timeout: 1500 })
            .catch(() => false)
        ) {
          await btnReintentarAceptar.click().catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }

    // 9. Avanzar hacia Observaciones y Preliminar (SUNAT SOL requiere Continuar dos veces)
    for (let c = 0; c < 2; c++) {
      const btnContinuar = frameOrPage
        .getByRole('button', { name: 'Continuar' })
        .or(
          frameOrPage.locator(
            'button:has-text("Continuar"), input[value="Continuar"], #btnContinuar',
          ),
        )
        .filter({ visible: true })
        .first();

      if (await btnContinuar.isVisible({ timeout: 3500 }).catch(() => false)) {
        this.logger.debug(
          `Presionando Continuar tras ítems (paso ${c + 1})...`,
        );
        await btnContinuar.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    await page
      .waitForLoadState('networkidle', { timeout: 15000 })
      .catch(() => {});
  }

  /**
   * Paso 3: Observaciones o documentos de referencia (si aún no se avanzó al Preliminar).
   */
  private async llenarPasoObservaciones(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug('Configurando observaciones y paso previo...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    // Si ya está visible el botón Emitir (pantalla preliminar), no es necesario pulsar Continuar
    const btnEmitir = frameOrPage
      .getByRole('button', { name: 'Emitir' })
      .filter({ visible: true })
      .first();
    if (await btnEmitir.isVisible({ timeout: 1500 }).catch(() => false)) {
      return;
    }

    if (params.observaciones) {
      const txtObs = frameOrPage
        .locator('#txtObservaciones, textarea[name*="observacion"]')
        .first();
      if (await txtObs.isVisible({ timeout: 2000 }).catch(() => false)) {
        await txtObs.fill(params.observaciones.slice(0, 200));
      }
    }

    const btnContinuar = frameOrPage
      .getByRole('button', { name: 'Continuar' })
      .or(
        frameOrPage.locator(
          'button:has-text("Continuar"), input[value="Continuar"], #btnContinuar',
        ),
      )
      .filter({ visible: true })
      .first();
    if (await btnContinuar.isVisible({ timeout: 4000 }).catch(() => false)) {
      await btnContinuar.click();
      await page
        .waitForLoadState('networkidle', { timeout: 15000 })
        .catch(() => {});
    }
  }

  /**
   * Paso 4: Confirmación en pantalla preliminar y emisión final.
   */
  private async confirmarYEmitirBoleta(page: Page): Promise<{
    numeroComprobante: string;
    serie: string;
    correlativo: number;
    pdfBuffer?: Buffer;
  }> {
    this.logger.debug('Confirmando emisión en preliminar de comprobante...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    // 1. Botón "Emitir"
    const btnEmitir = frameOrPage
      .getByRole('button', { name: 'Emitir' })
      .or(
        frameOrPage.locator(
          'button:has-text("Emitir"), input[value="Emitir"], #btnEmitir',
        ),
      )
      .first();
    await btnEmitir.waitFor({ state: 'visible', timeout: 20000 });
    await btnEmitir.click();

    // 2. Diálogo de confirmación: "¿Está seguro de emitir...?" -> Clic en "Aceptar"
    await page.waitForTimeout(1000);
    const downloadPromise = page
      .waitForEvent('download', { timeout: 10000 })
      .catch(() => null);

    let btnConfirmarAceptar = frameOrPage
      .getByRole('button', { name: 'Aceptar' })
      .or(
        frameOrPage.locator(
          'button:has-text("Aceptar"), button:has-text("Sí"), button:has-text("Si"), #btnAceptar',
        ),
      )
      .filter({ visible: true })
      .first();

    if (
      !(await btnConfirmarAceptar
        .isVisible({ timeout: 2500 })
        .catch(() => false))
    ) {
      btnConfirmarAceptar = page
        .getByRole('button', { name: 'Aceptar' })
        .or(
          page.locator(
            'button:has-text("Aceptar"), button:has-text("Sí"), button:has-text("Si"), #btnAceptar',
          ),
        )
        .filter({ visible: true })
        .first();
    }

    if (
      await btnConfirmarAceptar.isVisible({ timeout: 4000 }).catch(() => false)
    ) {
      await btnConfirmarAceptar.click();
    }

    // 3. Esperar posible descarga automática disparada por el modal
    let downloadedPdfBuffer: Buffer | undefined;
    const download = await downloadPromise;
    if (download) {
      try {
        const downloadPath = await download.path();
        if (downloadPath) {
          const fs = await import('fs/promises');
          downloadedPdfBuffer = await fs.readFile(downloadPath);
        }
      } catch (err: any) {
        this.logger.debug(
          `No se pudo leer archivo de descarga directa: ${err.message}`,
        );
      }
    }

    // 4. Si aparece el botón explícito "Descargar PDF", intentar usarlo si aún no tenemos el PDF
    if (!downloadedPdfBuffer) {
      let btnDescargarPdf = frameOrPage
        .getByRole('button', { name: 'Descargar PDF' })
        .or(
          frameOrPage.locator(
            'button:has-text("Descargar PDF"), a:has-text("Descargar PDF")',
          ),
        )
        .filter({ visible: true })
        .first();

      if (
        !(await btnDescargarPdf.isVisible({ timeout: 2500 }).catch(() => false))
      ) {
        btnDescargarPdf = page
          .getByRole('button', { name: 'Descargar PDF' })
          .or(
            page.locator(
              'button:has-text("Descargar PDF"), a:has-text("Descargar PDF")',
            ),
          )
          .filter({ visible: true })
          .first();
      }

      if (
        await btnDescargarPdf.isVisible({ timeout: 4000 }).catch(() => false)
      ) {
        const manualDownloadPromise = page
          .waitForEvent('download', { timeout: 8000 })
          .catch(() => null);
        await btnDescargarPdf.click().catch(() => {});
        const manualDownload = await manualDownloadPromise;
        if (manualDownload) {
          const manualPath = await manualDownload.path();
          if (manualPath) {
            const fs = await import('fs/promises');
            downloadedPdfBuffer = await fs.readFile(manualPath);
          }
        }
      }
    }

    await page
      .waitForLoadState('networkidle', { timeout: 20000 })
      .catch(() => {});

    // 5. Extraer número de comprobante emitido (ej. "EB01-00000452", "B001-452", "E001-123")
    let numeroComprobante = '';
    let serie = 'EB01';
    let correlativo = 0;

    const textoCompleto = await page.textContent('body');
    if (textoCompleto) {
      const match = textoCompleto.match(
        /(EB\d{2}|B\d{3}|E\d{3}|F\d{3})\s*[-–]\s*(\d+)/i,
      );
      if (match && match[1] && match[2]) {
        serie = match[1].toUpperCase();
        correlativo = parseInt(match[2], 10);
        numeroComprobante = `${serie}-${String(correlativo).padStart(8, '0')}`;
      }
    }

    if (!numeroComprobante) {
      numeroComprobante = `${serie}-${Date.now().toString().slice(-8)}`;
    }

    return {
      numeroComprobante,
      serie,
      correlativo,
      pdfBuffer: downloadedPdfBuffer,
    };
  }

  /**
   * Descarga el PDF del comprobante emitido o lo genera vía print/pdf del frame.
   */
  private async obtenerPdfComprobante(
    page: Page,
    numeroComprobante: string,
  ): Promise<Buffer | undefined> {
    try {
      this.logger.debug(`Obteniendo PDF de comprobante: ${numeroComprobante}`);
      // Intenta hacer clic en "Descargar PDF" o "Imprimir"
      const btnDescargar = page
        .locator(
          'button:has-text("Descargar"), a:has-text("Descargar PDF"), button:has-text("Imprimir")',
        )
        .first();

      if (await btnDescargar.isVisible({ timeout: 3000 }).catch(() => false)) {
        const downloadPromise = page
          .waitForEvent('download', { timeout: 8000 })
          .catch(() => null);
        await btnDescargar.click().catch(() => {});
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
      this.logger.warn(
        `No se pudo generar PDF directo de SUNAT SOL: ${err.message}`,
      );
      return undefined;
    }
  }

  /**
   * Retorna el frame de trabajo correspondiente a 'iframeApplication' de SUNAT SOL.
   */
  private async obtenerFrameTrabajo(page: Page): Promise<Frame | Page | any> {
    // 1. Intentar el iframe oficial de SEE-SOL SUNAT identificado en las sesiones reales
    const frameApp = page.frame({ name: 'iframeApplication' });
    if (frameApp) {
      return frameApp;
    }

    // 2. Esperar si aún está cargando el elemento iframe
    try {
      const frameEl = await page
        .waitForSelector('iframe[name="iframeApplication"]', { timeout: 4000 })
        .catch(() => null);
      if (frameEl) {
        const content = await frameEl.contentFrame();
        if (content) return content;
      }
    } catch {}

    // 3. Buscar en todos los frames por nombre o URL conocida
    for (const frame of page.frames()) {
      const name = frame.name();
      const url = frame.url();
      if (
        name === 'iframeApplication' ||
        url.includes('iframeApplication') ||
        url.includes('ol-ti-itemision') ||
        url.includes('ebp') ||
        url.includes('itemision')
      ) {
        return frame;
      }
    }

    return page;
  }
}
