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

  /** Mutex para garantizar que nunca corran 2 navegadores Playwright simultáneamente en entornos limitados de RAM (ej. Render 512MB) */
  private colaEjecucion: Promise<unknown> = Promise.resolve();

  private async ejecutarConBloqueo<T>(fn: () => Promise<T>): Promise<T> {
    const ticket = (async () => {
      try {
        await this.colaEjecucion;
      } catch {
        // Ignorar error de la ejecución anterior en cola
      }
      return await fn();
    })();

    this.colaEjecucion = ticket.catch(() => {});
    return await ticket;
  }

  /**
   * Configura interceptación de red para abortar recursos no esenciales
   * (fuentes, audio/video, trackers) ahorrando memoria RAM y acelerando la navegación.
   */
  private async configurarRutasOptimizadas(page: Page): Promise<void> {
    try {
      await page.route('**/*', (route) => {
        const req = route.request();
        const resourceType = req.resourceType();
        const url = req.url().toLowerCase();

        // 1. Bloquear multimedia y fuentes que consumen buffers de GPU y memoria innecesaria
        if (resourceType === 'media' || resourceType === 'font') {
          return route.abort().catch(() => {});
        }

        // 2. Bloquear rastreadores y analíticas externas que SUNAT a veces carga
        if (
          url.includes('google-analytics') ||
          url.includes('googletagmanager') ||
          url.includes('doubleclick') ||
          url.includes('facebook') ||
          url.includes('hotjar') ||
          url.includes('/banner')
        ) {
          return route.abort().catch(() => {});
        }

        // 3. Opcional: bloqueo de imágenes si se activa por variable de entorno
        if (
          process.env.SUNAT_SOL_BLOCK_IMAGES === 'true' &&
          resourceType === 'image'
        ) {
          return route.abort().catch(() => {});
        }

        return route.continue().catch(() => {});
      });
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : String(err);
      this.logger.debug(
        `No se pudo inicializar interceptor de rutas: ${errText}`,
      );
    }
  }

  /**
   * Prueba de conexión y autenticación con Clave SOL en el portal SUNAT.
   */
  async testConexion(
    credenciales: SunatSolCredenciales,
    headless = true,
  ): Promise<TestConexionSolResult> {
    return this.ejecutarConBloqueo(async () => {
      const startTime = Date.now();
      let browser: Browser | null = null;
      let context: BrowserContext | null = null;
      let page: Page | null = null;

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

        page = await context.newPage();
        await this.configurarRutasOptimizadas(page);
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
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        this.logger.error(
          `Error al conectar con SUNAT SOL: ${errorMsg}`,
          errorStack,
        );
        return {
          exito: false,
          ruc: credenciales.ruc,
          dni: credenciales.dni,
          usuario: credenciales.usuario,
          mensaje: `Fallo de autenticación en SUNAT SOL: ${errorMsg}`,
        };
      } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        page = null;
        context = null;
        browser = null;
        if (typeof global.gc === 'function') {
          try {
            global.gc();
          } catch (gcErr: unknown) {
            const msg = gcErr instanceof Error ? gcErr.message : String(gcErr);
            this.logger.debug(`Error al invocar GC: ${msg}`);
          }
        }
      }
    });
  }

  /**
   * Automatiza la emisión de una Boleta de Venta Electrónica en SEE-SOL (Nuevo RUS).
   */
  async emitirBoletaSol(
    params: EmitirBoletaSolParams,
  ): Promise<ResultadoBoletaSol> {
    return this.ejecutarConBloqueo(async () => {
      const startTime = Date.now();
      const timeout = params.timeoutMs || 90000;
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
        await this.configurarRutasOptimizadas(page);

        // Auto-aceptar diálogos nativos del navegador de SUNAT (ej. confirmación de emisión sin documento)
        page.on('dialog', async (dialog) => {
          this.logger.log(
            `[SUNAT Dialog detectado]: "${dialog.message()}" (${dialog.type()}) -> Aceptando automáticamente`,
          );
          await dialog.accept().catch(() => {});
        });

        params.onProgreso?.({
          paso: 1,
          totalPasos: 7,
          etapa: 'INICIO',
          titulo: 'Conectando con SUNAT',
          descripcion: 'Estableciendo conexión segura con el portal SOL...',
          porcentaje: 10,
        });

        // 1. Autenticación SOL
        params.onProgreso?.({
          paso: 2,
          totalPasos: 7,
          etapa: 'LOGIN',
          titulo: 'Autenticando Credenciales SOL',
          descripcion: 'Validando acceso con RUC/DNI y clave en el sistema...',
          porcentaje: 25,
        });
        await this.ejecutarLogin(page, params.credenciales);
        await this.cerrarModalesAviso(page);

        // 2. Navegación a Emisión de Boleta o Factura Electrónica
        params.onProgreso?.({
          paso: 3,
          totalPasos: 7,
          etapa: 'NAVEGACION',
          titulo: 'Accediendo a SEE - SOL',
          descripcion: 'Cargando el formulario oficial de comprobantes...',
          porcentaje: 40,
        });
        await this.navegarAEmision(page, params.tipoComprobante || 'BOLETA');
        await this.cerrarModalesAviso(page);

        // 3. Paso 1: Datos del Receptor y Moneda
        params.onProgreso?.({
          paso: 4,
          totalPasos: 7,
          etapa: 'RECEPTOR',
          titulo: 'Registrando Datos del Cliente',
          descripcion: 'Configurando receptor, tipo de documento y moneda...',
          porcentaje: 55,
        });
        await this.llenarPasoReceptor(page, params);

        // 4. Paso 2: Adición de Ítems (Bienes o Servicios)
        params.onProgreso?.({
          paso: 5,
          totalPasos: 7,
          etapa: 'ITEMS',
          titulo: 'Adicionando Productos y Precios',
          descripcion: `Registrando ${params.items.length} ítem(s), cantidades y valor unitario...`,
          porcentaje: 75,
        });
        await this.llenarPasoItems(page, params);

        // 5. Paso 3: Observaciones y Adicionales
        await this.llenarPasoObservaciones(page, params);

        // 6. Paso 4: Preliminar y Confirmación de Emisión
        params.onProgreso?.({
          paso: 6,
          totalPasos: 7,
          etapa: 'PRELIMINAR',
          titulo: 'Verificando Comprobante Preliminar',
          descripcion:
            'Validando montos tributarios y confirmando la emisión...',
          porcentaje: 90,
        });
        const resultadoEmision = await this.confirmarYEmitirBoleta(page);

        // 7. Descarga o generación de PDF
        const pdfBuffer =
          resultadoEmision.pdfBuffer ||
          (await this.obtenerPdfComprobante(
            page,
            resultadoEmision.numeroComprobante,
          ));

        params.onProgreso?.({
          paso: 7,
          totalPasos: 7,
          etapa: 'EMITIDO',
          titulo: 'Comprobante Emitido con Éxito',
          descripcion: `Comprobante ${resultadoEmision.numeroComprobante} generado y aceptado por SUNAT`,
          porcentaje: 100,
        });

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
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        this.logger.error(
          `Error en emisión de Boleta SOL: ${errorMsg}`,
          errorStack,
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
          mensajeRespuesta: `Error al emitir en SUNAT SOL: ${errorMsg}`,
          screenshotBase64,
          duracionMs: Date.now() - startTime,
        };
      } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        page = null;
        context = null;
        browser = null;
        if (typeof global.gc === 'function') {
          try {
            global.gc();
          } catch (gcErr: unknown) {
            const msg = gcErr instanceof Error ? gcErr.message : String(gcErr);
            this.logger.debug(`Error al invocar GC: ${msg}`);
          }
        }
      }
    });
  }

  /**
   * Inicializa la instancia del navegador con flags ultra optimizados para bajo consumo de memoria RAM.
   */
  private async lanzarNavegador(headless: boolean): Promise<Browser> {
    // Si se proporciona endpoint remoto (ej. Browserless.io o contenedor dedicado), conectarse vía WebSocket
    const wsUrl =
      process.env.PLAYWRIGHT_WS_ENDPOINT || process.env.BROWSERLESS_URL;
    if (wsUrl) {
      this.logger.log(
        `[Playwright] Conectando a instancia remota de Chromium vía WebSocket: ${wsUrl}`,
      );
      return await chromium.connect(wsUrl);
    }

    const slowMo = process.env.SUNAT_SOL_SLOWMO
      ? parseInt(process.env.SUNAT_SOL_SLOWMO, 10)
      : 0;

    if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
    }

    let executablePath: string | undefined = undefined;
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    } else {
      // 1. Intentar localizar chrome-headless-shell en node_modules (ocupa significativamente menos RAM)
      try {
        const localBrowsersDir = path.join(
          process.cwd(),
          'node_modules',
          'playwright-core',
          '.local-browsers',
        );
        if (fs.existsSync(localBrowsersDir)) {
          const findExecutable = (
            dir: string,
          ): { shell: string | null; standard: string | null } => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const result: { shell: string | null; standard: string | null } = {
              shell: null,
              standard: null,
            };
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                const sub = findExecutable(fullPath);
                if (sub.shell) result.shell = sub.shell;
                if (sub.standard) result.standard = sub.standard;
              } else if (entry.name === 'chrome-headless-shell') {
                result.shell = fullPath;
              } else if (
                entry.name === 'chrome' ||
                entry.name === 'chrome.exe' ||
                entry.name === 'chromium'
              ) {
                result.standard = fullPath;
              }
            }
            return result;
          };

          const found = findExecutable(localBrowsersDir);
          if (found.shell && headless) {
            executablePath = found.shell;
            this.logger.log(
              `[Playwright] Usando ejecutable ultra-ligero chrome-headless-shell: ${executablePath}`,
            );
          } else if (found.standard) {
            executablePath = found.standard;
            this.logger.log(
              `[Playwright] Usando ejecutable de Chromium en node_modules: ${executablePath}`,
            );
          }
        }
      } catch (e: unknown) {
        const errText = e instanceof Error ? e.message : String(e);
        this.logger.debug(
          `Error al buscar Chromium en node_modules: ${errText}`,
        );
      }

      if (!executablePath) {
        try {
          const defaultPath = chromium.executablePath();
          if (fs.existsSync(defaultPath)) {
            executablePath = defaultPath;
          }
        } catch {
          // Ignorar si defaultPath no está disponible en este entorno
        }
      }
    }

    const lowMemoryArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer',
      // CRÍTICO para Render (512MB RAM):
      // Evita que los iframes de SUNAT (iframeApplication) creen procesos de renderizado separados (ahorra 80MB-120MB de RAM)
      '--disable-features=site-per-process,AudioServiceOutOfProcess,IsolateOrigins',
      // Limitar a máximo 1 proceso de renderizado
      '--renderer-process-limit=1',
      // Limitar heap interno de JavaScript de Chromium a 128MB
      '--js-flags=--max-old-space-size=128',
      // Desactivar utilidades y componentes en segundo plano
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--mute-audio',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
    ];

    return await chromium.launch({
      headless,
      slowMo,
      executablePath,
      args: headless ? lowMemoryArgs : ['--start-maximized'],
    });
  }

  /**
   * Ejecuta el login con DNI o RUC + usuario y clave SOL en el portal de SUNAT.
   * Utiliza comprobación reactiva inmediata del estado en lugar de esperas estáticas.
   */
  private async ejecutarLogin(
    page: Page,
    credenciales: SunatSolCredenciales,
  ): Promise<void> {
    this.logger.debug(`Navegando a login SOL: ${this.SUNAT_LOGIN_URL}`);
    try {
      await page.goto(this.SUNAT_LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch {
      await page.goto(this.SUNAT_LOGIN_FALLBACK, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
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

      try {
        const tabDni = page
          .getByRole('button', { name: 'DNI' })
          .or(
            page.locator(
              '#aDni, #btnPorDni, button:has-text("Con DNI"), a:has-text("Con DNI"), #aOpcion2',
            ),
          )
          .first();
        if (await tabDni.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tabDni.click().catch(() => {});
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

      await dniInput.waitFor({ state: 'visible', timeout: 15000 });
      await dniInput.fill(docIdentidad);
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    } else {
      this.logger.log(
        `Iniciando sesión en SUNAT con modalidad RUC: ${credenciales.ruc}, Usuario: ${credenciales.usuario}`,
      );
      // Seleccionar pestaña "Con RUC" si existe
      try {
        const tabRuc = page
          .getByRole('button', { name: 'RUC' })
          .or(
            page.locator(
              '#aRuc, #btnPorRuc, button:has-text("Con RUC"), a:has-text("Con RUC"), #aOpcion1',
            ),
          )
          .first();
        if (await tabRuc.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tabRuc.click().catch(() => {});
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

      await rucInput.waitFor({ state: 'visible', timeout: 15000 });
      await rucInput.fill(credenciales.ruc || '');
      await userInput.fill(credenciales.usuario || '');
      await passInput.fill(credenciales.clave);
      await loginButton.click();
    }

    // Comprobación reactiva: detectar inmediatamente si hubo error o si ya ingresó al portal
    const errorMsgLocator = page.locator(
      '.alert-danger, #divError, .ui-messages-error, #errorMsg',
    );

    const inicioEspera = Date.now();
    const maxEsperaLogin = 20000;
    while (Date.now() - inicioEspera < maxEsperaLogin) {
      // 1. Error visible inmediato
      if (
        await errorMsgLocator
          .first()
          .isVisible({ timeout: 100 })
          .catch(() => false)
      ) {
        const errorText = await errorMsgLocator.first().textContent();
        throw new Error(
          errorText?.trim() ||
            'Credenciales SOL inválidas o acceso rechazado por SUNAT',
        );
      }

      // 2. URL redirigida al portal SOL (AutenticaMenuInternet, e-menu, etc.)
      const currentUrl = page.url();
      const yaSalioDeLogin =
        !currentUrl.includes('oauth2/loginMenuSol') &&
        (currentUrl.includes('e-menu.sunat.gob.pe') ||
          currentUrl.includes('AutenticaMenuInternet') ||
          currentUrl.includes('cl-ti-itmenu') ||
          currentUrl.includes('menu'));

      if (yaSalioDeLogin) {
        this.logger.debug(
          `Sesión SOL verificada por URL en ${Date.now() - inicioEspera}ms`,
        );
        break;
      }

      // 3. Menú o elementos del portal ya renderizados
      const portalMenuVisible = page
        .locator(
          'text="Empresas", text="Comprobantes", #divOpciones, #menuInternet',
        )
        .first();
      if (
        await portalMenuVisible.isVisible({ timeout: 100 }).catch(() => false)
      ) {
        this.logger.debug(
          `Sesión SOL verificada por menú en ${Date.now() - inicioEspera}ms`,
        );
        break;
      }

      await page.waitForTimeout(60);
    }
  }

  /**
   * Cierra ventanas emergentes, comunicados o encuestas de SUNAT reactivamente.
   */
  private async cerrarModalesAviso(page: Page): Promise<void> {
    const modalSelector = [
      'button:has-text("Continuar sin confirmar")',
      'button:has-text("Cerrar")',
      'button:has-text("Aceptar")',
      '.ui-dialog-titlebar-close',
      '#btnCerrarModal',
      'button.close',
      'a.modal-close',
    ].join(', ');

    try {
      const modalBtn = page
        .locator(modalSelector)
        .filter({ visible: true })
        .first();
      if (await modalBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        this.logger.debug('Modal de aviso detectado, cerrando...');
        await modalBtn.click().catch(() => {});
      }
    } catch {
      // Continuar si no existe
    }
  }

  /**
   * Navega por el árbol de menús hasta el formulario de Emisión de Boleta o Factura en SEE-SOL.
   * En lugar de networkidle estático, verifica la carga activa del iframe de emisión.
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
      if (
        await opcionEmpresas.isVisible({ timeout: 3500 }).catch(() => false)
      ) {
        await opcionEmpresas.click().catch(() => {});
      }
    } catch {
      // Ignorar si Empresas no está visible
    }

    // 2. Clic en "Comprobantes de pago"
    try {
      const menuComprobantes = page
        .getByRole('listitem')
        .filter({ hasText: 'Comprobantes de pago' })
        .or(page.getByText('Comprobantes de pago'))
        .first();
      if (
        await menuComprobantes.isVisible({ timeout: 2500 }).catch(() => false)
      ) {
        await menuComprobantes.click().catch(() => {});
      }
    } catch {
      // Ignorar si Comprobantes de pago no está en el DOM
    }

    // 3. Clic en "SEE - SOL"
    try {
      const seeSol = page.getByText('SEE - SOL').first();
      if (await seeSol.isVisible({ timeout: 2500 }).catch(() => false)) {
        await seeSol.click().catch(() => {});
      }
    } catch {
      // Ignorar si SEE - SOL no está visible
    }

    // 4. Tipo de Comprobante específico (Boleta o Factura)
    if (esFactura) {
      const menuFactura = page.getByText('Factura Electrónica').first();
      if (await menuFactura.isVisible({ timeout: 2500 }).catch(() => false)) {
        await menuFactura.click().catch(() => {});
      }
      const emitirFactura = page
        .getByRole('link', { name: 'Emitir Factura' })
        .or(page.getByText('Emitir Factura'))
        .first();
      await emitirFactura.waitFor({ state: 'visible', timeout: 15000 });
      await emitirFactura.click();
    } else {
      const menuBoleta = page.getByText('Boleta de Venta Electrónica').first();
      if (await menuBoleta.isVisible({ timeout: 2500 }).catch(() => false)) {
        await menuBoleta.click().catch(() => {});
      }
      const emitirBoleta = page
        .getByRole('link', { name: 'Emitir Boleta de Venta' })
        .or(page.getByText('Emitir Boleta de Venta'))
        .first();
      await emitirBoleta.waitFor({ state: 'visible', timeout: 15000 });
      await emitirBoleta.click();
    }

    // Esperar reactivamente a que el iframe de trabajo esté montado e interactivo
    await this.esperarFrameTrabajoListo(page, 20000);
  }

  /**
   * Mapea el tipo de documento del receptor con la opción exacta en el combo Dojo de SUNAT SOL.
   * Si es emisión sin documento (Nuevo RUS / clientes varios / sin datos), retorna 'SIN DOCUMENTO'.
   */
  private obtenerNombreOpcionTipoDoc(
    tipoDoc?: string,
    numDoc?: string,
  ): string {
    const numLimpio = (numDoc || '').trim();
    const t = (tipoDoc || '').trim().toUpperCase();

    const esSinDoc =
      !numLimpio ||
      numLimpio === '0' ||
      numLimpio === '-' ||
      numLimpio === '00000000' ||
      !t ||
      t === '0' ||
      t === 'SIN_DOCUMENTO' ||
      t === 'SIN DOCUMENTO' ||
      t === 'NINGUNO' ||
      t === '-' ||
      t === 'VARIOS';

    if (esSinDoc) {
      return 'SIN DOCUMENTO';
    }

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
   * Paso 1: Configurar receptor (DNI / RUC / Sin documento / varios) y moneda.
   * Si no se especifica cliente o se manda vacío, se emite boleta sin datos (< S/ 700).
   */
  private async llenarPasoReceptor(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug('Llenando datos del receptor...');
    const frameOrPage = await this.obtenerFrameTrabajo(page);

    const tipoDoc = params.receptor?.tipoDoc;
    const rawNumDoc = params.receptor?.numeroDoc?.trim();
    const esSinDoc =
      !rawNumDoc ||
      rawNumDoc === '0' ||
      rawNumDoc === '-' ||
      rawNumDoc === '00000000' ||
      !tipoDoc ||
      tipoDoc === '0' ||
      tipoDoc === 'SIN_DOCUMENTO' ||
      tipoDoc === 'SIN DOCUMENTO' ||
      tipoDoc === 'NINGUNO' ||
      tipoDoc === '-' ||
      tipoDoc === 'VARIOS';

    const numDoc = esSinDoc ? undefined : rawNumDoc;
    const nombreOpcion = this.obtenerNombreOpcionTipoDoc(tipoDoc, numDoc);

    if (esSinDoc) {
      this.logger.log(
        'Configurando emisión de Boleta SIN DOCUMENTO / SIN DATOS (Régimen RUS / Clientes Varios < S/ 700)...',
      );

      // A) Comprobar si existe selector por Radio Button (legacy o alternativo)
      const rdoSinDoc = frameOrPage
        .locator(
          'input[value="0"], #rdoSinDoc, input[name*="tipoDoc"][value="0"], input[id*="SinDoc"]',
        )
        .or(frameOrPage.getByText('Sin Documento', { exact: false }))
        .first();
      if (await rdoSinDoc.isVisible({ timeout: 800 }).catch(() => false)) {
        await rdoSinDoc.check().catch(() => {});
      }

      // B) Combo Dojo / Select de Tipo de Documento:
      const comboTipoDoc = frameOrPage
        .locator('[id="inicio.tipoDocumento"]')
        .first();
      const flechaCombo = frameOrPage.locator('.dijitReset.dijitRight').first();

      let opcionSeleccionada = false;

      // Intentar primero con la API de Dojo directamente para mayor rapidez y precisión
      try {
        opcionSeleccionada = await frameOrPage.evaluate(() => {
          interface DojoItem {
            name?: string;
            label?: string;
            descripcion?: string;
            id?: string | number;
            value?: string | number;
          }
          interface DojoWidget {
            store?: { data?: DojoItem[] };
            set: (prop: string, val: unknown) => void;
            get: (prop: string) => unknown;
            onChange?: (val: unknown) => void;
          }
          interface WindowWithDojo extends Window {
            dijit?: {
              byId: (id: string) => DojoWidget | undefined;
            };
          }
          const win = window as unknown as WindowWithDojo;
          if (win.dijit) {
            const widget = win.dijit.byId('inicio.tipoDocumento');
            if (widget) {
              if (widget.store && widget.store.data) {
                const item = widget.store.data.find((d: DojoItem) =>
                  /sin documento|sin doc|doc\.trib|varios|ninguno/i.test(
                    String(d.name || d.label || d.descripcion || d.id || ''),
                  ),
                );
                if (item) {
                  widget.set(
                    'value',
                    item.id !== undefined ? item.id : item.value,
                  );
                  widget.set(
                    'displayedValue',
                    item.name || item.label || 'SIN DOCUMENTO',
                  );
                  if (widget.onChange) widget.onChange(widget.get('value'));
                  return true;
                }
              }
              widget.set('displayedValue', 'SIN DOCUMENTO');
            }
          }
          return false;
        });
      } catch {
        // Ignorar fallo al interactuar con widget Dojo
      }

      if (
        !opcionSeleccionada &&
        (await comboTipoDoc.isVisible({ timeout: 1500 }).catch(() => false))
      ) {
        try {
          await comboTipoDoc.click().catch(() => {});

          const optSinDoc = frameOrPage
            .locator(
              '.dijitMenuItem, [role="option"], tr.dijitMenuItem, div.dijitMenuItem',
            )
            .filter({ hasText: /sin documento|sin doc|varios|doc\.trib/i })
            .first();

          if (await optSinDoc.isVisible({ timeout: 1000 }).catch(() => false)) {
            await optSinDoc.click().catch(() => {});
            opcionSeleccionada = true;
          } else if (
            await flechaCombo.isVisible({ timeout: 800 }).catch(() => false)
          ) {
            await flechaCombo.click().catch(() => {});
            const optSinDoc2 = frameOrPage
              .locator(
                '.dijitMenuItem, [role="option"], tr.dijitMenuItem, div.dijitMenuItem',
              )
              .filter({ hasText: /sin documento|sin doc|varios|doc\.trib/i })
              .first();
            if (
              await optSinDoc2.isVisible({ timeout: 800 }).catch(() => false)
            ) {
              await optSinDoc2.click().catch(() => {});
              opcionSeleccionada = true;
            }
          }
        } catch {
          // Ignorar fallo al desplegar opciones de combo
        }

        // Fallback: escribir directamente "SIN DOCUMENTO" en el combo
        if (!opcionSeleccionada) {
          try {
            await comboTipoDoc.click().catch(() => {});
            await page.keyboard.press('Control+A').catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await comboTipoDoc.fill('SIN DOCUMENTO').catch(() => {});
            await page.keyboard.press('Enter').catch(() => {});
          } catch {
            // Ignorar fallo al escribir en combo
          }
        }
      }

      // Fallback selector HTML nativo <select> si aplica
      const selectTipoDoc = frameOrPage
        .locator('select[name*="tipoDocumento"], select[id*="tipoDocumento"]')
        .first();
      if (await selectTipoDoc.isVisible({ timeout: 800 }).catch(() => false)) {
        await selectTipoDoc
          .selectOption({ label: 'SIN DOCUMENTO' })
          .catch(async () => {
            await selectTipoDoc.selectOption({ value: '0' }).catch(() => {});
          });
      }

      // C) Campo número de documento: DEBE estar completamente vacío
      const inputNumDoc = frameOrPage
        .locator(
          '[id="inicio.numeroDocumento"], #txtNumDoc, #numDoc, input[name*="numDoc"]',
        )
        .first();
      if (await inputNumDoc.isVisible({ timeout: 1000 }).catch(() => false)) {
        await inputNumDoc.fill('').catch(() => {});
      }
      try {
        await frameOrPage.evaluate(() => {
          interface DojoWidget {
            set: (prop: string, val: unknown) => void;
          }
          interface WindowWithDojo extends Window {
            dijit?: {
              byId: (id: string) => DojoWidget | undefined;
            };
          }
          const win = window as unknown as WindowWithDojo;
          if (win.dijit) {
            win.dijit.byId('inicio.numeroDocumento')?.set('value', '');
          }
          const el = document.getElementById(
            'inicio.numeroDocumento',
          ) as HTMLInputElement | null;
          if (el) el.value = '';
        });
      } catch {
        // Ignorar fallo al limpiar input de documento
      }
    } else {
      // 1. Selector de Tipo de Documento en portal SOL (Dojo / iframeApplication)
      const comboTipoDoc = frameOrPage
        .locator('[id="inicio.tipoDocumento"]')
        .first();
      const flechaCombo = frameOrPage.locator('.dijitReset.dijitRight').first();

      if (await comboTipoDoc.isVisible({ timeout: 2500 }).catch(() => false)) {
        await comboTipoDoc.click().catch(() => {});

        const opt = frameOrPage
          .getByRole('option', { name: nombreOpcion })
          .or(
            frameOrPage
              .locator('.dijitMenuItem, [role="option"]')
              .filter({ hasText: nombreOpcion }),
          )
          .first();
        if (await opt.isVisible({ timeout: 1200 }).catch(() => false)) {
          await opt.click();
        } else if (
          await flechaCombo.isVisible({ timeout: 800 }).catch(() => false)
        ) {
          await flechaCombo.click().catch(() => {});
          await frameOrPage
            .getByRole('option', { name: nombreOpcion })
            .or(
              frameOrPage
                .locator('.dijitMenuItem, [role="option"]')
                .filter({ hasText: nombreOpcion }),
            )
            .first()
            .click()
            .catch(() => {});
        }
      } else {
        // Fallback selector legacy por radio button
        if (tipoDoc === '1' && numDoc) {
          const rdoDni = frameOrPage
            .locator(
              'input[value="1"], #rdoDni, input[name*="tipoDoc"][value="1"]',
            )
            .first();
          if (await rdoDni.isVisible({ timeout: 1000 }).catch(() => false)) {
            await rdoDni.check();
          }
        } else if (tipoDoc === '6' && numDoc) {
          const rdoRuc = frameOrPage
            .locator(
              'input[value="6"], #rdoRuc, input[name*="tipoDoc"][value="6"]',
            )
            .first();
          if (await rdoRuc.isVisible({ timeout: 1000 }).catch(() => false)) {
            await rdoRuc.check();
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
        if (await inputNumDoc.isVisible({ timeout: 2000 }).catch(() => false)) {
          await inputNumDoc.click();
          await inputNumDoc.fill(numDoc);
          await page.keyboard.press('Tab');
        }
      }
    }

    // 3. Moneda (si aplica)
    const selectMoneda = frameOrPage
      .locator('select[name*="moneda"], #cmbMoneda')
      .first();
    if (await selectMoneda.isVisible({ timeout: 800 }).catch(() => false)) {
      await selectMoneda.selectOption({ label: 'SOLES' }).catch(() => {});
    }

    // 4. Continuar al siguiente paso reactivamente
    const esItemsVisible = async (): Promise<boolean> => {
      const btn = frameOrPage
        .getByRole('button', { name: 'Adicionar' })
        .or(
          frameOrPage.locator(
            'button:not([id*="docrel"]):has-text("Adicionar"), a:has-text("Adicionar"), span:has-text("Adicionar")',
          ),
        )
        .filter({ visible: true })
        .first();
      return await btn.isVisible({ timeout: 150 }).catch(() => false);
    };

    const modalUnionSelector = [
      '#dlgBtnAceptar',
      'button:has-text("Aceptar")',
      'input[value="Aceptar"]',
      'button:has-text("Sí")',
      'button:has-text("Si")',
      'input[value="Sí"]',
      'input[value="Si"]',
      '.dijitDialog button:has-text("Aceptar")',
      '.dijitDialog button:has-text("Sí")',
      '.dijitDialog button:has-text("Si")',
      '.dijitDialog button:has-text("Continuar")',
    ].join(', ');

    for (let c = 0; c < 3; c++) {
      if (await esItemsVisible()) {
        this.logger.debug(
          'Pantalla de ítems ya visible. Deteniendo Continuar de receptor.',
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

      if (await btnContinuar.isVisible({ timeout: 2500 }).catch(() => false)) {
        this.logger.debug(`Presionando Continuar (paso receptor ${c + 1})...`);
        await btnContinuar.click().catch(() => {});

        // Esperar reactivamente a que aparezca la pantalla de ítems o algún diálogo modal de confirmación
        const inicioEspera = Date.now();
        while (Date.now() - inicioEspera < 5000) {
          if (await esItemsVisible()) {
            break;
          }

          // Aceptar cualquier modal intermedio
          const modalInFrame = frameOrPage
            .locator(modalUnionSelector)
            .filter({ visible: true })
            .first();
          if (
            await modalInFrame.isVisible({ timeout: 100 }).catch(() => false)
          ) {
            this.logger.log('Aceptando modal de confirmación en frame');
            await modalInFrame.click().catch(() => {});
          } else {
            const modalInPage = page
              .locator(modalUnionSelector)
              .filter({ visible: true })
              .first();
            if (
              await modalInPage.isVisible({ timeout: 100 }).catch(() => false)
            ) {
              this.logger.log('Aceptando modal de confirmación en página');
              await modalInPage.click().catch(() => {});
            }
          }

          if (await esItemsVisible()) {
            break;
          }
          await page.waitForTimeout(60);
        }
      }
    }
  }

  /**
   * Paso 2: Adición de ítems en el formulario de SUNAT SOL.
   * Utiliza verificación reactiva de visibilidad de componentes para máxima velocidad.
   */
  private async llenarPasoItems(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug(
      `Adicionando ${params.items.length} ítems en SUNAT SOL con datos de venta...`,
    );
    const frameOrPage = await this.obtenerFrameTrabajo(page);

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

      await btnAdicionar.waitFor({ state: 'visible', timeout: 20000 });
      await btnAdicionar.click();

      // Esperar a que el modal "Nuevo Item" esté completamente visible
      const dialogNuevoItem = frameOrPage
        .locator('.dijitDialog, [role="dialog"], #modalItem')
        .filter({ visible: true })
        .first();
      await dialogNuevoItem.waitFor({ state: 'visible', timeout: 12000 });

      // =========================================================================
      // PASO A: SELECCIONAR BIEN O SERVICIO
      // =========================================================================
      const esServicio = item.tipo === 'SERVICIO';
      this.logger.debug(
        `[Ítem ${index + 1}] Seleccionando tipo: ${esServicio ? 'SERVICIO' : 'BIEN'}...`,
      );

      const radioTipo = dialogNuevoItem
        .getByRole('radio', { name: esServicio ? /servicio/i : /bien/i })
        .or(
          dialogNuevoItem.locator(
            esServicio
              ? 'input[type="radio"][value="S"], input[type="radio"][value*="servicio" i]'
              : 'input[type="radio"][value="B"], input[type="radio"][value*="bien" i]',
          ),
        )
        .or(
          dialogNuevoItem.locator(
            esServicio
              ? 'input[type="radio"]:nth-of-type(2)'
              : 'input[type="radio"]:nth-of-type(1)',
          ),
        )
        .first();

      if (await radioTipo.isVisible({ timeout: 800 }).catch(() => false)) {
        await radioTipo.check().catch(() => {});
      }

      // Clic por etiqueta visible
      const labelTipo = dialogNuevoItem
        .locator('label, span, td')
        .filter({ hasText: esServicio ? /^Servicio$/i : /^Bien$/i })
        .first();
      if (await labelTipo.isVisible({ timeout: 300 }).catch(() => false)) {
        await labelTipo.click().catch(() => {});
      }

      // Sincronización nativa DOM y Dojo para Bien / Servicio
      const fnSeleccionarTipo = (isServ: boolean) => {
        const dlgs = document.querySelectorAll(
          '.dijitDialog, [role="dialog"], #modalItem',
        );
        for (const dlg of Array.from(dlgs)) {
          if (window.getComputedStyle(dlg).display === 'none') continue;
          const radios = Array.from(
            dlg.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
          );
          for (const r of radios) {
            const val = (r.value || '').toUpperCase();
            const id = (r.id || '').toLowerCase();
            const label =
              r.closest('label') ||
              document.querySelector(`label[for="${r.id}"]`);
            const labelText = (
              label?.textContent ||
              r.parentElement?.textContent ||
              ''
            )
              .trim()
              .toLowerCase();
            const matches = isServ
              ? val === 'S' ||
                id.includes('servicio') ||
                labelText.includes('servicio')
              : val === 'B' ||
                id.includes('bien') ||
                labelText.includes('bien');
            if (matches) {
              r.checked = true;
              r.click();
              r.dispatchEvent(new Event('change', { bubbles: true }));
              interface WinDojo extends Window {
                dijit?: {
                  byNode: (n: Node) =>
                    | {
                        set: (k: string, v: unknown) => void;
                        onChange?: (v: unknown) => void;
                      }
                    | undefined;
                  byId: (id: string) =>
                    | {
                        set: (k: string, v: unknown) => void;
                        onChange?: (v: unknown) => void;
                      }
                    | undefined;
                };
              }
              const win = window as unknown as WinDojo;
              if (win.dijit) {
                const w =
                  win.dijit.byNode(r) ||
                  (r.id ? win.dijit.byId(r.id) : undefined);
                if (w) {
                  try {
                    w.set('checked', true);
                    if (w.onChange) w.onChange(true);
                  } catch {
                    // Ignorar si el widget Dojo no soporta onChange
                  }
                }
              }
              return true;
            }
          }
          // Si no coincidió por id/label, por posición: radios[0] = Bien, radios[1] = Servicio
          if (radios.length >= 2) {
            const target = isServ ? radios[1] : radios[0];
            target.checked = true;
            target.click();
            target.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };

      await frameOrPage.evaluate(fnSeleccionarTipo, esServicio).catch(() => {});
      if (frameOrPage !== page) {
        await page.evaluate(fnSeleccionarTipo, esServicio).catch(() => {});
      }
      await page.waitForTimeout(150);

      // =========================================================================
      // PASO B: INGRESAR CANTIDAD
      // =========================================================================
      const cantStr = item.cantidad ? String(item.cantidad) : '1';
      this.logger.debug(
        `[Ítem ${index + 1}] Ingresando cantidad: ${cantStr}...`,
      );

      let inputCantidad = dialogNuevoItem
        .locator('tr, div')
        .filter({ hasText: /cantidad/i })
        .locator('input:not([type="hidden"])')
        .first();

      if (
        !(await inputCantidad.isVisible({ timeout: 400 }).catch(() => false))
      ) {
        inputCantidad = frameOrPage
          .locator(
            '[id="item.cantidad"], #txtCantidad, input[name*="cantidad"]',
          )
          .first();
      }

      if (await inputCantidad.isVisible({ timeout: 1200 }).catch(() => false)) {
        await inputCantidad.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.type(cantStr, { delay: 20 }).catch(() => {});
        await page.keyboard.press('Tab').catch(() => {});

        // Sincronizar ÚNICAMENTE inputCantidad en su widget Dojo correspondiente
        await inputCantidad
          .evaluate((inp: HTMLInputElement, c: string) => {
            inp.value = c;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            inp.dispatchEvent(new Event('blur', { bubbles: true }));
            interface WinDojo extends Window {
              dijit?: {
                byNode: (n: Node) =>
                  | {
                      set: (k: string, v: unknown) => void;
                      onChange?: (v: unknown) => void;
                    }
                  | undefined;
                byId: (id: string) =>
                  | {
                      set: (k: string, v: unknown) => void;
                      onChange?: (v: unknown) => void;
                    }
                  | undefined;
              };
            }
            const win = window as unknown as WinDojo;
            if (win.dijit) {
              const w =
                win.dijit.byNode(inp) ||
                (inp.id ? win.dijit.byId(inp.id) : undefined);
              if (w) {
                try {
                  w.set('value', Number(c));
                  if (w.onChange) w.onChange(Number(c));
                } catch {}
              }
            }
          }, cantStr)
          .catch(() => {});
      }

      // =========================================================================
      // PASO C: UNIDAD DE MEDIDA
      // =========================================================================
      this.logger.debug(
        `[Ítem ${index + 1}] Verificando / seleccionando Unidad de Medida (UNIDAD)...`,
      );
      const selectUnidad = dialogNuevoItem
        .locator('tr, div')
        .filter({ hasText: /unidad de medida/i })
        .locator('select, input.dijitInputInner, [role="combobox"]')
        .first();

      if (await selectUnidad.isVisible({ timeout: 400 }).catch(() => false)) {
        const tagName = await selectUnidad
          .evaluate((el) => el.tagName.toLowerCase())
          .catch(() => '');
        if (tagName === 'select') {
          await selectUnidad
            .selectOption({ label: 'UNIDAD' })
            .catch(async () => {
              await selectUnidad.selectOption({ value: 'NIU' }).catch(() => {});
            });
        }
      }

      // =========================================================================
      // PASO D: CÓDIGO DE PRODUCTO
      // =========================================================================
      const codigoAEnviar = item.codigo?.trim() || String(index + 1);
      this.logger.debug(
        `[Ítem ${index + 1}] Ingresando código de producto: ${codigoAEnviar}...`,
      );

      // Asegurar selección de radio "Código de producto de usuario"
      const rdoCodUsuario = dialogNuevoItem
        .getByRole('radio', { name: /usuario/i })
        .or(
          dialogNuevoItem.locator(
            'input[type="radio"][value*="usuario" i], input[type="radio"][id*="usuario" i]',
          ),
        )
        .first();
      if (await rdoCodUsuario.isVisible({ timeout: 350 }).catch(() => false)) {
        await rdoCodUsuario.check().catch(() => {});
      }

      let inputCodigo = dialogNuevoItem
        .locator('tr, div')
        .filter({ hasText: /^c[oó]digo/i })
        .locator('input:not([type="hidden"]):not([type="radio"])')
        .first();

      if (!(await inputCodigo.isVisible({ timeout: 350 }).catch(() => false))) {
        inputCodigo = frameOrPage
          .locator(
            '[id="item.codigoItem"], #txtCodigo, input[name*="codigoItem"]',
          )
          .first();
      }

      if (await inputCodigo.isVisible({ timeout: 1000 }).catch(() => false)) {
        await inputCodigo.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await inputCodigo.fill(codigoAEnviar).catch(() => {});
        await page.keyboard.press('Tab').catch(() => {});
      }

      // =========================================================================
      // PASO E: DESCRIPCIÓN
      // =========================================================================
      this.logger.debug(
        `[Ítem ${index + 1}] Ingresando descripción: ${item.descripcion}...`,
      );
      const inputDesc = dialogNuevoItem
        .locator('[id="item.descripcion"]')
        .or(
          dialogNuevoItem.locator(
            'textarea[name*="descripcion"], #txtDescripcion, #descripcion, textarea',
          ),
        )
        .first();

      if (await inputDesc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await inputDesc.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await inputDesc.fill(item.descripcion.slice(0, 250)).catch(() => {});
        const descActual = await inputDesc.inputValue().catch(() => '');
        if (!descActual || descActual.trim() === '') {
          await page.keyboard.type(item.descripcion.slice(0, 250), {
            delay: 15,
          });
        }
        await page.keyboard.press('Tab').catch(() => {});
      }

      // =========================================================================
      // PASO F: VALOR UNITARIO
      // =========================================================================
      const precioNum =
        item.precioUnitario &&
        !isNaN(Number(item.precioUnitario)) &&
        Number(item.precioUnitario) > 0
          ? Number(item.precioUnitario)
          : 0;
      const precioStr = precioNum.toFixed(2);
      this.logger.log(
        `[Ítem ${index + 1}] Ingresando Valor Unitario: ${precioStr}...`,
      );

      // Localizar la fila específica de "Valor Unitario" (descartando Descuento e Importe Total)
      const filaValorUnitario = dialogNuevoItem
        .locator('tr')
        .filter({ hasText: /valor\s*unitario/i })
        .filter({ hasNotText: /descuento|importe\s*total/i })
        .first();

      let inputPrecio = filaValorUnitario
        .locator('input:not([type="hidden"])')
        .filter({ visible: true })
        .first();

      if (!(await inputPrecio.isVisible({ timeout: 400 }).catch(() => false))) {
        inputPrecio = dialogNuevoItem
          .locator(
            '[id="item.valorUnitario"], [id="item.precioUnitario"], [id="item.montoValorUnitario"], input[name*="valorUnitario"], input[name*="precioUnitario"]',
          )
          .filter({ visible: true })
          .first();
      }

      // Escritura y reemplazo limpio con teclado
      if (await inputPrecio.isVisible({ timeout: 1500 }).catch(() => false)) {
        await inputPrecio.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.type(precioStr, { delay: 25 }).catch(() => {});
        await page.keyboard.press('Tab').catch(() => {});

        // Sincronizar ÚNICAMENTE este input de Valor Unitario y su widget Dojo asociado
        await inputPrecio
          .evaluate(
            (inp: HTMLInputElement, args: { pStr: string; pNum: number }) => {
              const { pStr, pNum } = args;
              inp.focus();
              inp.value = pStr;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
              inp.dispatchEvent(new Event('blur', { bubbles: true }));

              interface DojoWidget {
                set: (prop: string, val: unknown) => void;
                validate?: () => boolean;
                onChange?: (val: unknown) => void;
                _setValueAttr?: (val: unknown) => void;
                _setDisplayedValueAttr?: (val: string) => void;
              }
              interface WindowWithDojo extends Window {
                dijit?: {
                  byId: (id: string) => DojoWidget | undefined;
                  byNode: (node: Node) => DojoWidget | undefined;
                };
              }
              const win = window as unknown as WindowWithDojo;
              if (win.dijit) {
                const w =
                  win.dijit.byNode(inp) ||
                  (inp.id ? win.dijit.byId(inp.id) : undefined);
                if (w) {
                  try {
                    w.set('value', pNum);
                    w.set('displayedValue', pStr);
                    if (w._setValueAttr) w._setValueAttr(pNum);
                    if (w._setDisplayedValueAttr)
                      w._setDisplayedValueAttr(pStr);
                    if (w.validate) w.validate();
                    if (w.onChange) w.onChange(pNum);
                  } catch {}
                }
              }
            },
            { pStr: precioStr, pNum: precioNum },
          )
          .catch(() => {});
      }

      // Invocar funciones globales de cálculo de SUNAT SOL si existen
      await frameOrPage
        .evaluate(() => {
          const win = window as unknown as Record<string, unknown>;
          const fns = [
            'calculaTotalItem',
            'calcularTotalItem',
            'calcularImporte',
            'calcularImporteTotal',
          ];
          for (const fn of fns) {
            const f = win[fn];
            if (typeof f === 'function') {
              try {
                (f as () => void)();
              } catch {}
            }
          }
        })
        .catch(() => {});

      // Verificación de escritura: si el valor sigue vacío o en 0.00, reintentar sobre el mismo input
      const precioLeido = await inputPrecio.inputValue().catch(() => '');
      if (
        precioNum > 0 &&
        (!precioLeido ||
          precioLeido.trim() === '' ||
          precioLeido === '0.00' ||
          precioLeido === '0')
      ) {
        this.logger.debug(
          `Reintentando llenado de Valor Unitario con type directo: ${precioStr}`,
        );
        await inputPrecio.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.type(precioStr, { delay: 25 }).catch(() => {});
        await page.keyboard.press('Tab').catch(() => {});
      }

      // =========================================================================
      // PASO G: ACEPTAR (GUARDAR ÍTEM)
      // =========================================================================
      let btnAceptarItem = dialogNuevoItem
        .locator(
          'button:has-text("Aceptar"), input[value="Aceptar"], span.dijitButtonText:has-text("Aceptar"), span:has-text("Aceptar"), [role="button"]:has-text("Aceptar"), #btnAceptarItem, #dlgBtnAceptar, #btnAceptar',
        )
        .filter({ visible: true })
        .first();

      if (
        !(await btnAceptarItem.isVisible({ timeout: 1000 }).catch(() => false))
      ) {
        btnAceptarItem = frameOrPage
          .getByRole('button', { name: 'Aceptar' })
          .or(
            frameOrPage.locator(
              'button:has-text("Aceptar"), input[value="Aceptar"], span.dijitButtonText:has-text("Aceptar"), span:has-text("Aceptar"), #btnAceptarItem, #dlgBtnAceptar',
            ),
          )
          .filter({ visible: true })
          .first();
      }

      this.logger.log(`Presionando botón Aceptar de ítem ${index + 1}...`);
      await btnAceptarItem.click({ force: true }).catch(() => {});

      // Clic nativo DOM sobre el botón Aceptar en el modal
      const clicAceptarNativo = () => {
        const dlgs = document.querySelectorAll(
          '.dijitDialog, [role="dialog"], #modalItem',
        );
        for (const dlg of Array.from(dlgs)) {
          const style = window.getComputedStyle(dlg);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            const btns = Array.from(
              dlg.querySelectorAll(
                'button, input[type="button"], span.dijitButton, span.dijitButtonNode, span.dijitButtonText, [role="button"], a',
              ),
            );
            for (const b of btns) {
              const t = (
                b.textContent ||
                (b as HTMLInputElement).value ||
                ''
              ).trim();
              if (/^Aceptar$/i.test(t)) {
                (b as HTMLElement).click();
                return true;
              }
            }
          }
        }
        return false;
      };

      await frameOrPage.evaluate(clicAceptarNativo).catch(() => {});
      if (frameOrPage !== page) {
        await page.evaluate(clicAceptarNativo).catch(() => {});
      }

      // Esperar reactivamente a que se procese el ítem y se cierre el modal
      const inicioEsperaItem = Date.now();
      while (Date.now() - inicioEsperaItem < 7000) {
        // ¿Apareció diálogo modal de confirmación / afectación tributaria?
        const dialogAfectacion = frameOrPage
          .locator('#dlgBtnAceptar, div:has-text("●Aceptar")')
          .filter({ visible: true })
          .first();
        if (
          await dialogAfectacion.isVisible({ timeout: 100 }).catch(() => false)
        ) {
          await dialogAfectacion.click().catch(() => {});
          const radioOption = frameOrPage.getByRole('radio').first();
          if (
            await radioOption.isVisible({ timeout: 600 }).catch(() => false)
          ) {
            const isChecked = await radioOption.isChecked().catch(() => false);
            if (!isChecked) await radioOption.check().catch(() => {});
            const btnAceptarDialogo = frameOrPage
              .getByRole('button', { name: 'Aceptar' })
              .filter({ visible: true })
              .first();
            if (
              await btnAceptarDialogo
                .isVisible({ timeout: 600 })
                .catch(() => false)
            ) {
              await btnAceptarDialogo.click().catch(() => {});
            }
          }
        }

        // Si el formulario de ítem ya no está visible, el ítem fue guardado con éxito
        const modalItemAunVisible = await dialogNuevoItem
          .isVisible({ timeout: 100 })
          .catch(() => false);
        if (!modalItemAunVisible) {
          this.logger.log(
            `Ítem ${index + 1} guardado correctamente en la tabla.`,
          );
          break;
        }

        // Reintento: si transcurrieron 1.2s y el modal sigue visible, re-hacer clic en Aceptar
        if (Date.now() - inicioEsperaItem > 1200) {
          await btnAceptarItem.click({ force: true }).catch(() => {});
          await frameOrPage.evaluate(clicAceptarNativo).catch(() => {});
          if (frameOrPage !== page) {
            await page.evaluate(clicAceptarNativo).catch(() => {});
          }
        }

        await page.waitForTimeout(70);
      }
    }

    // =========================================================================
    // PASO H: "Y POR ÚLTIMO CONTINUAR" (AVANZAR TRAS CARGAR ÍTEMS)
    // =========================================================================
    this.logger.log(
      'Todos los ítems agregados con éxito. Presionando botón Continuar para avanzar...',
    );

    for (let c = 0; c < 5; c++) {
      const btnEmitir = frameOrPage
        .getByRole('button', { name: 'Emitir' })
        .or(frameOrPage.locator('button:has-text("Emitir"), #btnEmitir'))
        .filter({ visible: true })
        .first();
      if (await btnEmitir.isVisible({ timeout: 200 }).catch(() => false)) {
        this.logger.debug('Pantalla preliminar (Emitir) ya visible.');
        break;
      }

      const txtObs = frameOrPage
        .locator('#txtObservaciones, textarea[name*="observacion"]')
        .first();
      if (await txtObs.isVisible({ timeout: 200 }).catch(() => false)) {
        this.logger.debug('Pantalla de observaciones ya visible.');
        break;
      }

      const btnContinuar = frameOrPage
        .getByRole('button', { name: /continuar/i })
        .or(
          frameOrPage.locator(
            'button:has-text("Continuar"), input[value*="Continuar" i], span.dijitButtonText:has-text("Continuar"), span:has-text("Continuar"), a:has-text("Continuar"), [role="button"]:has-text("Continuar"), #btnContinuar, #botonContinuar, [id*="Continuar" i]',
          ),
        )
        .filter({ visible: true })
        .first();

      const btnVisible = await btnContinuar
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      if (btnVisible) {
        this.logger.log(
          `Presionando Continuar tras ítems (intento ${c + 1})...`,
        );
        await btnContinuar.click({ force: true }).catch(() => {});
      }

      // Clic DOM nativo como respaldo de Continuar
      const fnClicContinuar = () => {
        const els = Array.from(
          document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], span.dijitButtonText, span.dijitButtonNode, [role="button"], a',
          ),
        );
        for (const el of els) {
          const t = (
            el.textContent ||
            (el as HTMLInputElement).value ||
            ''
          ).trim();
          if (/^continuar$/i.test(t)) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      };

      await frameOrPage.evaluate(fnClicContinuar).catch(() => {});
      if (frameOrPage !== page) {
        await page.evaluate(fnClicContinuar).catch(() => {});
      }

      // Esperar reactivamente a que la vista avance
      const inicioEsperaCont = Date.now();
      let avanzo = false;
      while (Date.now() - inicioEsperaCont < 3000) {
        if (
          (await btnEmitir.isVisible({ timeout: 100 }).catch(() => false)) ||
          (await txtObs.isVisible({ timeout: 100 }).catch(() => false))
        ) {
          avanzo = true;
          break;
        }
        await page.waitForTimeout(70);
      }

      if (avanzo) {
        this.logger.log('Transición exitosa tras presionar Continuar.');
        break;
      }
    }
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

    const btnEmitir = frameOrPage
      .getByRole('button', { name: 'Emitir' })
      .filter({ visible: true })
      .first();
    if (await btnEmitir.isVisible({ timeout: 800 }).catch(() => false)) {
      return;
    }

    if (params.observaciones) {
      const txtObs = frameOrPage
        .locator('#txtObservaciones, textarea[name*="observacion"]')
        .first();
      if (await txtObs.isVisible({ timeout: 1000 }).catch(() => false)) {
        await txtObs.fill(params.observaciones.slice(0, 200));
      }
    }

    const btnContinuar = frameOrPage
      .getByRole('button', { name: /continuar/i })
      .or(
        frameOrPage.locator(
          'button:has-text("Continuar"), input[value*="Continuar" i], span.dijitButtonText:has-text("Continuar"), span:has-text("Continuar"), a:has-text("Continuar"), [role="button"]:has-text("Continuar"), #btnContinuar, #botonContinuar, [id*="Continuar" i]',
        ),
      )
      .filter({ visible: true })
      .first();

    if (await btnContinuar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btnContinuar.click({ force: true }).catch(() => {});
    }

    // Respaldo DOM nativo
    await frameOrPage
      .evaluate(() => {
        const els = Array.from(
          document.querySelectorAll(
            'button, input[type="button"], input[type="submit"], span.dijitButtonText, a, [role="button"]',
          ),
        );
        for (const el of els) {
          const t = (
            el.textContent ||
            (el as HTMLInputElement).value ||
            ''
          ).trim();
          if (/^continuar$/i.test(t)) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      })
      .catch(() => {});

    await btnEmitir
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
  }

  /**
   * Paso 4: Confirmación en pantalla preliminar y emisión final.
   * Monitorea reactivamente la aparición del número de comprobante para retornar de inmediato.
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
    const downloadPromise = page
      .waitForEvent('download', { timeout: 8000 })
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
        .isVisible({ timeout: 1500 })
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
          const fsPromises = await import('fs/promises');
          downloadedPdfBuffer = await fsPromises.readFile(downloadPath);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.debug(
          `No se pudo leer archivo de descarga directa: ${msg}`,
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
        !(await btnDescargarPdf.isVisible({ timeout: 1500 }).catch(() => false))
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
        await btnDescargarPdf.isVisible({ timeout: 2500 }).catch(() => false)
      ) {
        const manualDownloadPromise = page
          .waitForEvent('download', { timeout: 5000 })
          .catch(() => null);
        await btnDescargarPdf.click().catch(() => {});
        const manualDownload = await manualDownloadPromise;
        if (manualDownload) {
          const manualPath = await manualDownload.path();
          if (manualPath) {
            const fsPromises = await import('fs/promises');
            downloadedPdfBuffer = await fsPromises.readFile(manualPath);
          }
        }
      }
    }

    // 5. Monitoreo reactivo del número de comprobante emitido (ej. "EB01-00000452")
    let numeroComprobante = '';
    let serie = 'EB01';
    let correlativo = 0;
    const regexComprobante = /(EB\d{2}|B\d{3}|E\d{3}|F\d{3})\s*[-–]\s*(\d+)/i;

    const inicioEsperaComprobante = Date.now();
    while (Date.now() - inicioEsperaComprobante < 20000) {
      const textoCompleto =
        ((await page.textContent('body').catch(() => '')) || '') +
        ' ' +
        ((await frameOrPage.textContent('body').catch(() => '')) || '');

      const match = textoCompleto.match(regexComprobante);
      if (match && match[1] && match[2]) {
        serie = match[1].toUpperCase();
        correlativo = parseInt(match[2], 10);
        numeroComprobante = `${serie}-${String(correlativo).padStart(8, '0')}`;
        this.logger.log(
          `Comprobante detectado reactivamente: ${numeroComprobante} en ${Date.now() - inicioEsperaComprobante}ms`,
        );
        break;
      }

      await page.waitForTimeout(80);
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
      const btnDescargar = page
        .locator(
          'button:has-text("Descargar"), a:has-text("Descargar PDF"), button:has-text("Imprimir")',
        )
        .first();

      if (await btnDescargar.isVisible({ timeout: 2000 }).catch(() => false)) {
        const downloadPromise = page
          .waitForEvent('download', { timeout: 6000 })
          .catch(() => null);
        await btnDescargar.click().catch(() => {});
        const download = await downloadPromise;
        if (download) {
          const path = await download.path();
          if (path) {
            const fsPromises = await import('fs/promises');
            return await fsPromises.readFile(path);
          }
        }
      }

      // Fallback: renderizar página / comprobante a PDF
      return await page.pdf({ format: 'A4', printBackground: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo generar PDF directo de SUNAT SOL: ${msg}`);
      return undefined;
    }
  }

  /**
   * Espera reactivamente a que el iframe de trabajo 'iframeApplication' esté adjunto,
   * cargado y con elementos interactivos del formulario listos para operar.
   */
  private async esperarFrameTrabajoListo(
    page: Page,
    timeoutMs = 20000,
  ): Promise<Frame | Page> {
    const inicio = Date.now();
    this.logger.debug(
      'Esperando reactivamente a que el frame de trabajo esté listo...',
    );

    while (Date.now() - inicio < timeoutMs) {
      const frame = await this.obtenerFrameTrabajo(page);
      if (frame && frame !== page) {
        try {
          const elementoListo = frame
            .locator(
              '[id="inicio.tipoDocumento"], button:has-text("Continuar"), input[value="0"], #rdoSinDoc, select[name*="tipoDocumento"], #btnContinuar',
            )
            .first();
          if (
            await elementoListo.isVisible({ timeout: 150 }).catch(() => false)
          ) {
            this.logger.debug(
              `Frame de trabajo listo y verificado en ${Date.now() - inicio}ms`,
            );
            return frame;
          }
        } catch {
          // El frame puede estar navegando o montándose
        }
      }

      await page.waitForTimeout(60);
    }

    return await this.obtenerFrameTrabajo(page);
  }

  /**
   * Retorna el frame de trabajo correspondiente a 'iframeApplication' de SUNAT SOL.
   */
  private async obtenerFrameTrabajo(page: Page): Promise<Frame | Page> {
    // 1. Intentar el iframe oficial de SEE-SOL SUNAT identificado en las sesiones reales
    const frameApp = page.frame({ name: 'iframeApplication' });
    if (frameApp) {
      return frameApp;
    }

    // 2. Esperar si aún está cargando el elemento iframe
    try {
      const frameEl = await page
        .waitForSelector('iframe[name="iframeApplication"]', { timeout: 2500 })
        .catch(() => null);
      if (frameEl) {
        const content = await frameEl.contentFrame();
        if (content) return content;
      }
    } catch {
      // Ignorar timeout de selector iframe
    }

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
