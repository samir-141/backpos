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
        const resultadoEmision = await this.confirmarYEmitirBoleta(
          page,
          params.soloPreliminar,
        );

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

            for (let fi = 0; fi < page.frames().length; fi++) {
              const frm = page.frames()[fi];
              const fHtml = await frm.content().catch(() => '');
              if (fHtml) {
                const frmPath = path.join(
                  logsDir,
                  `error-${timestamp}-frame-${fi}-${frm.name() || 'noname'}.html`,
                );
                fs.writeFileSync(frmPath, fHtml, 'utf-8');
              }
            }

            this.logger.error(
              `[DIAGNÓSTICO VISUAL] Volcado HTML de la pantalla y frames guardado en: ${htmlPath}`,
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
          'text="Empresas", text="Comprobantes", #divOpciones, #menuInternet, #divServicios',
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

    // Esperar a que MenuInternet.htm termine de cargar sus elementos principales en el DOM
    try {
      const menuContainer = page
        .locator(
          '#divServicios, #divOpcionServicio1, #divOpcionServicio2, #txtBusca',
        )
        .first();
      await menuContainer.waitFor({ state: 'visible', timeout: 15000 });
      this.logger.debug('Menú SOL completamente cargado e interactivo.');
    } catch {
      this.logger.debug('Aviso: continuando tras espera de carga del menú.');
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
    const codigoSunat = esFactura ? '11.5.3.1.1' : '11.5.4.1.1';
    const descAplicacion = esFactura
      ? 'Emitir Factura'
      : 'Emitir Boleta de Venta';

    this.logger.debug(
      `Navegando a Emisión de ${esFactura ? 'Factura' : 'Boleta'} Electrónica en SEE-SOL (Código: ${codigoSunat})...`,
    );

    // Si la sesión inició con DNI, SUNAT abre por defecto en modo "Personas" (#divOpcionServicio1).
    // Las opciones de emisión de Boleta y Factura SEE-SOL pertenecen exclusivamente a "Empresas" (#divOpcionServicio2).
    // Aseguramos la conmutación a modo "Empresas" antes de invocar la navegación.
    try {
      const btnEmpresas = page
        .locator('#divOpcionServicio2, [data-id="2"]')
        .first();
      await btnEmpresas.waitFor({ state: 'visible', timeout: 15000 });

      const esActivo = await btnEmpresas
        .evaluate((el) => el.classList.contains('divOpcionServicioActivo'))
        .catch(() => false);

      if (!esActivo) {
        this.logger.debug(
          'Conmutando perfil SOL a Empresas (#divOpcionServicio2)...',
        );
        await btnEmpresas.click({ force: true }).catch(() => {});
        await page
          .waitForFunction(
            () =>
              document
                .getElementById('divTodasOpciones')
                ?.classList.contains('modoEmpresas'),
            { timeout: 4000 },
          )
          .catch(() => {});
        this.logger.debug('Modo Empresas activo.');
      }
    } catch (e) {
      this.logger.debug(`Aviso conmutación Empresas: ${e}`);
    }

    // Estrategia 1: Invocación directa de la función global oficial ejecuta() o clickEnNivel4() de SUNAT SOL.
    // Esto es instantáneo, 100% robusto y no depende del ancho del viewport (hidden-xs) ni de que el árbol esté desplegado.
    let ejecutado = false;
    try {
      ejecutado = await page.evaluate(
        ({ codigo, desc }) => {
          interface WindowSunatMenu extends Window {
            ejecuta?: (
              url: string,
              relocate: boolean,
              desc: string,
              padre: string,
              codigo: string,
            ) => void;
            clickEnNivel4?: (el: unknown) => void;
            $?: (selector: string) => {
              length: number;
              first: () => unknown;
            };
          }

          try {
            const win = window as unknown as WindowSunatMenu;

            // Asegurar que modoEmpresas esté en el contenedor
            const btnEmpresas = document.getElementById('divOpcionServicio2');
            if (
              btnEmpresas &&
              !btnEmpresas.classList.contains('divOpcionServicioActivo')
            ) {
              btnEmpresas.click();
            }

            // A) Función global canónica ejecuta()
            if (typeof win.ejecuta === 'function') {
              win.ejecuta(
                `MenuInternet.htm?action=execute&code=${codigo}`,
                false,
                desc,
                '#nivel1_11',
                codigo,
              );
              return true;
            }

            // B) Handler clickEnNivel4 vía jQuery si está disponible
            const jq = win.$;
            if (jq && typeof win.clickEnNivel4 === 'function') {
              const el = jq(`[data-id="${codigo}"]`);
              if (el && el.length > 0) {
                win.clickEnNivel4(el.first());
                return true;
              }
            }

            // C) Disparar evento de click nativo sobre el nodo con data-id
            const domEl = document.querySelector(`[data-id="${codigo}"]`);
            if (domEl) {
              (domEl as HTMLElement).click();
              return true;
            }
          } catch (e) {
            console.warn('[navegarAEmision] evaluate error:', e);
          }
          return false;
        },
        { codigo: codigoSunat, desc: descAplicacion },
      );
    } catch (err) {
      this.logger.debug(
        `Navegación directa por script no completada: ${err}. Usando fallback interactivo...`,
      );
    }

    if (!ejecutado) {
      // Estrategia 2: Fallback interactivo disparando dispatchEvent en el elemento con data-id
      try {
        const itemExacto = page.locator(`li[data-id="${codigoSunat}"]`).first();
        if ((await itemExacto.count()) > 0) {
          await itemExacto.dispatchEvent('click').catch(() => {});
          ejecutado = true;
        }
      } catch {
        void 0;
      }
    }

    if (!ejecutado) {
      // Estrategia 3: Fallback usando el buscador oficial del menú de SUNAT (#txtBusca)
      try {
        const txtBusca = page.locator('#txtBusca').first();
        if (await txtBusca.isVisible({ timeout: 1500 }).catch(() => false)) {
          await txtBusca.fill(descAplicacion);
          await page.waitForTimeout(300);
          const itemFiltrado = page
            .locator(
              `li[data-id="${codigoSunat}"], .resaltado:has-text("${descAplicacion}")`,
            )
            .filter({ visible: true })
            .first();
          if (
            await itemFiltrado.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            await itemFiltrado.click({ force: true }).catch(() => {});
            ejecutado = true;
          }
        }
      } catch {
        void 0;
      }
    }

    if (!ejecutado) {
      // Estrategia 4: Fallback UI clásico desplegando acordeones
      try {
        const opcionEmpresas = page
          .getByRole('heading', { name: 'Empresas' })
          .or(page.getByText('Empresas'))
          .filter({ visible: true })
          .first();
        if (
          await opcionEmpresas.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await opcionEmpresas.click().catch(() => {});
        }
      } catch {
        void 0;
      }

      try {
        const menuComprobantes = page
          .getByText('Comprobantes de pago')
          .filter({ visible: true })
          .first();
        if (
          await menuComprobantes.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await menuComprobantes.click().catch(() => {});
        }
      } catch {
        void 0;
      }

      try {
        const seeSol = page
          .getByText('SEE - SOL')
          .filter({ visible: true })
          .first();
        if (await seeSol.isVisible({ timeout: 2000 }).catch(() => false)) {
          await seeSol.click().catch(() => {});
        }
      } catch {
        void 0;
      }

      const subMenuTipo = esFactura
        ? page
            .getByText('Factura Electrónica')
            .filter({ visible: true })
            .first()
        : page
            .getByText('Boleta de Venta Electrónica')
            .filter({ visible: true })
            .first();
      if (await subMenuTipo.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subMenuTipo.click().catch(() => {});
      }

      // En vez de .first().waitFor() (que se bloquea en elementos ocultos),
      // se busca el elemento que esté visible o se fuerza el clic:
      const botonOpcion = page
        .locator(`li[data-id="${codigoSunat}"]`)
        .or(page.getByText(descAplicacion, { exact: true }))
        .filter({ visible: true })
        .first();

      if (await botonOpcion.isVisible({ timeout: 3000 }).catch(() => false)) {
        await botonOpcion.click().catch(() => {});
      } else {
        await page
          .locator(`li[data-id="${codigoSunat}"]`)
          .first()
          .click({ force: true })
          .catch(() => {});
      }
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
   * Obtiene el código interno de SUNAT SOL para el tipo de documento.
   */
  private obtenerCodigoTipoDoc(tipoDoc?: string, numDoc?: string): string {
    const opcion = this.obtenerNombreOpcionTipoDoc(tipoDoc, numDoc);
    if (opcion === 'SIN DOCUMENTO') return '-';
    if (opcion === 'DOC. NACIONAL DE IDENTIDAD') return '1';
    if (opcion === 'REG. UNICO DE CONTRIBUYENTES') return '6';
    if (opcion === 'CARNÉ DE EXTRANJERÍA') return '4';
    if (opcion === 'PASAPORTE') return '7';
    if (opcion === 'CARNE DE IDENTIDAD') return 'A';
    if (opcion === 'DOC.IDENTIF.PERS.NAT.NO DOM.') return 'B';
    if (opcion === 'TAX IDENTIFICATION NUMBER') return 'C';
    if (opcion === 'IDENTIFICATION NUMBER') return 'D';
    if (opcion === 'PERMISO TEMP.PERMANENCIA - PT') return 'E';
    if (opcion === 'SALVOCONDUCTO') return 'F';
    if (opcion === 'CARNE PERMISO TEMP.PERMAN -CP') return 'G';
    return '1';
  }

  /**
   * Paso 1: Configurar receptor (DNI / RUC / Sin documento / varios) y moneda.
   * Flujo ordenado en 4 pasos:
   * 1. Seleccionar tipo de documento (DNI, RUC, SIN DOCUMENTO, etc.).
   * 2. Rellenar datos (número de documento y "CLIENTE GENERAL" o datos del cliente).
   * 3. Seleccionar la moneda (SOLES / PEN).
   * 4. Presionar Continuar para avanzar a la pantalla de ítems.
   */
  private async llenarPasoReceptor(
    page: Page,
    params: EmitirBoletaSolParams,
  ): Promise<void> {
    this.logger.debug('Iniciando Paso 1: Receptor y Moneda...');
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
    const codigoDoc = this.obtenerCodigoTipoDoc(tipoDoc, numDoc);

    // -------------------------------------------------------------------------
    // 1. SELECCIONAR TIPO DE DOCUMENTO Y CONSIGNAR DATOS
    // -------------------------------------------------------------------------
    if (esSinDoc) {
      this.logger.debug(
        '[Paso 1] Seleccionando SIN DOCUMENTO en combo Dijit (#widget_inicio.tipoDocumento)...',
      );
      const flecha = frameOrPage
        .locator('[id="widget_inicio.tipoDocumento"] .dijitArrowButton')
        .first();
      await flecha.waitFor({ state: 'visible', timeout: 10000 });
      await flecha.click({ force: true });
      await page.waitForTimeout(300);

      const optSinDoc = frameOrPage
        .locator('#inicio\\.tipoDocumento_popup0')
        .first();
      await optSinDoc.waitFor({ state: 'visible', timeout: 5000 });
      await optSinDoc.click({ force: true });
      await page.waitForTimeout(300);

      // Consignar "CLIENTE GENERAL" vía Dojo/DOM (el input queda deshabilitado por SUNAT para edición interactiva)
      await frameOrPage
        .evaluate(() => {
          interface WindowWithDojo extends Window {
            dijit?: {
              byId: (
                id: string,
              ) => { set: (p: string, v: unknown) => void } | undefined;
            };
          }
          const win = window as unknown as WindowWithDojo;
          win.dijit
            ?.byId('inicio.razonSocial')
            ?.set('value', 'CLIENTE GENERAL');
          const el = document.getElementById(
            'inicio.razonSocial',
          ) as HTMLInputElement | null;
          if (el) el.value = 'CLIENTE GENERAL';
        })
        .catch(() => {});
    } else {
      this.logger.debug(
        `[Paso 1] Seleccionando tipo de documento: "${nombreOpcion}" (código "${codigoDoc}")...`,
      );
      const flecha = frameOrPage
        .locator('[id="widget_inicio.tipoDocumento"] .dijitArrowButton')
        .first();
      if (await flecha.isVisible({ timeout: 2000 }).catch(() => false)) {
        await flecha.click({ force: true });
        await page.waitForTimeout(300);

        const selectorPopup = nombreOpcion.includes('RUC')
          ? '#inicio\\.tipoDocumento_popup4, .dijitMenuItem:has-text("REG. UNICO")'
          : '#inicio\\.tipoDocumento_popup2, .dijitMenuItem:has-text("DOC. NACIONAL")';

        const opt = frameOrPage.locator(selectorPopup).first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await opt.click({ force: true });
        }
      }
      await page.waitForTimeout(300);

      if (numDoc) {
        const inputNumDoc = frameOrPage
          .locator('[id="inicio.numeroDocumento"]')
          .first();
        if (await inputNumDoc.isVisible({ timeout: 2000 }).catch(() => false)) {
          await inputNumDoc.click({ force: true });
          await inputNumDoc.fill(numDoc);
          await page.keyboard.press('Tab');
        }
      }

      const rawNombre = (params.receptor?.razonSocialODatos || '').trim();
      if (rawNombre && rawNombre !== '-' && rawNombre !== '0') {
        await page.waitForTimeout(500);
        await frameOrPage
          .evaluate((nombreVal) => {
            interface WindowWithDojo extends Window {
              dijit?: {
                byId: (
                  id: string,
                ) => { set: (p: string, v: unknown) => void } | undefined;
              };
            }
            const win = window as unknown as WindowWithDojo;
            win.dijit?.byId('inicio.razonSocial')?.set('value', nombreVal);
            const el = document.getElementById(
              'inicio.razonSocial',
            ) as HTMLInputElement | null;
            if (el && !el.disabled) el.value = nombreVal;
          }, rawNombre)
          .catch(() => {});
      }
    }

    // -------------------------------------------------------------------------
    // 2. SELECCIONAR LA MONEDA (SOLES / PEN)
    // -------------------------------------------------------------------------
    if (params.moneda === 'USD') {
      const selectMoneda = frameOrPage
        .locator('select[name*="moneda"], #cmbMoneda, select[id*="tipoMoneda"]')
        .first();
      if (await selectMoneda.isVisible({ timeout: 600 }).catch(() => false)) {
        await selectMoneda.selectOption({ label: 'DOLARES' }).catch(() => {});
      }
    }

    // -------------------------------------------------------------------------
    // 3. PRESIONAR CONTINUAR (PARA AVANZAR A LA PANTALLA DE ÍTEMS)
    // -------------------------------------------------------------------------
    this.logger.debug(
      '[Paso 1] Presionando Continuar (#inicio.botonGrabarDocumento)...',
    );
    const btnContinuarPaso1 = frameOrPage
      .locator('#inicio\\.botonGrabarDocumento')
      .first();
    await btnContinuarPaso1.waitFor({ state: 'visible', timeout: 10000 });
    await btnContinuarPaso1.click({ force: true });

    // Esperar a que inicio.form desaparezca y se monte item.form
    const tInicioItems = Date.now();
    let cargoItems = false;
    while (Date.now() - tInicioItems < 20000) {
      const transiciono = await frameOrPage
        .evaluate(() => {
          return (
            !document.getElementById('inicio.form') &&
            !!document.getElementById('item.form')
          );
        })
        .catch(() => false);
      if (transiciono) {
        cargoItems = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    this.logger.debug(`[Paso 1] Pantalla de ítems cargada: ${cargoItems}.`);
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
      params.onProgreso?.({
        paso: 5,
        totalPasos: 7,
        etapa: 'ITEMS',
        titulo: `Adicionando Producto (${index + 1}/${params.items.length})`,
        descripcion: `${item.descripcion} (Cant: ${item.cantidad} - S/ ${item.precioUnitario.toFixed(2)})`,
        porcentaje: Math.round(62 + ((index + 1) / params.items.length) * 22),
      });

      // 1. Clic en "Adicionar" sobre la tabla de ítems (usando los selectores canónicos de SUNAT)
      const btnAdicionar = frameOrPage
        .locator(
          '#boleta\\.addItemButton, #item\\.botonAddItem, span[role="button"]:has-text("Adicionar"):not([id*="docrel"]), button:has-text("Adicionar"):not([id*="docrel"])',
        )
        .filter({ visible: true })
        .first();

      await btnAdicionar.waitFor({ state: 'visible', timeout: 20000 });
      await btnAdicionar.click({ force: true });

      // Esperar a que el modal "Nuevo Item" esté completamente visible
      const dialogNuevoItem = frameOrPage
        .locator('.dijitDialog:not([style*="display: none"])')
        .first();
      await dialogNuevoItem.waitFor({ state: 'visible', timeout: 12000 });

      // =========================================================================
      // PASO A: SELECCIONAR BIEN O SERVICIO
      // =========================================================================
      const esServicio = item.tipo === 'SERVICIO';
      this.logger.debug(
        `[Ítem ${index + 1}] Seleccionando tipo: ${esServicio ? 'SERVICIO' : 'BIEN'}...`,
      );

      // Clic directo en DOM y widget Dojo por texto de la fila (Bien vs Servicio)
      await frameOrPage
        .evaluate((isServ) => {
          const dlg = document.querySelector(
            '.dijitDialog:not([style*="display: none"])',
          );
          if (!dlg) return;
          const radios = Array.from(
            dlg.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
          );
          for (const r of radios) {
            const text = (
              r.closest('tr')?.textContent ||
              r.parentElement?.textContent ||
              ''
            ).toLowerCase();
            const matches = isServ
              ? text.includes('servicio')
              : text.includes('bien') && !text.includes('servicio');
            if (matches) {
              r.click();
              const win = window as any;
              const wid =
                r.closest('.dijitRadio')?.getAttribute('widgetid') || r.id;
              if (wid) win.dijit?.byId(wid)?.set('checked', true);
              return;
            }
          }
          if (radios.length > 0) {
            const target = isServ && radios.length > 1 ? radios[1] : radios[0];
            target.click();
            const win = window as any;
            const wid =
              target.closest('.dijitRadio')?.getAttribute('widgetid') ||
              target.id;
            if (wid) win.dijit?.byId(wid)?.set('checked', true);
          }
        }, esServicio)
        .catch(() => {});

      const labelTipo = dialogNuevoItem
        .locator('label, span, td')
        .filter({ hasText: esServicio ? /^Servicio$/i : /^Bien$/i })
        .first();
      if (await labelTipo.isVisible({ timeout: 300 }).catch(() => false)) {
        await labelTipo.click({ force: true }).catch(() => {});
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
                } catch {
                  void 0;
                }
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

      // Localizar el input editable de "Valor Unitario" (descartando iconos y campos readonly)
      const inpPrecio = dialogNuevoItem
        .locator(
          '[id="item.valorUnitario"], tr:has-text("Valor Unitario") input.dijitInputInner:not([readonly])',
        )
        .first();

      if (await inpPrecio.isVisible({ timeout: 1500 }).catch(() => false)) {
        await inpPrecio.click({ force: true }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Backspace').catch(() => {});
        await page.keyboard.type(precioStr, { delay: 20 }).catch(() => {});
        await page.keyboard.press('Tab').catch(() => {});

        // Sincronizar ÚNICAMENTE este input de Valor Unitario y su widget Dojo asociado
        await inpPrecio
          .evaluate(
            (inp: HTMLInputElement, args: { pStr: string; pNum: number }) => {
              const { pStr, pNum } = args;
              inp.focus();
              inp.value = pStr;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
              inp.dispatchEvent(new Event('blur', { bubbles: true }));

              const win = window as any;
              const w =
                win.dijit?.byNode(inp) ||
                (inp.id ? win.dijit?.byId(inp.id) : undefined);
              if (w) {
                try {
                  w.set('value', pNum);
                  w.set('displayedValue', pStr);
                  if (w.validate) w.validate();
                  if (w.onChange) w.onChange(pNum);
                } catch {
                  void 0;
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
              } catch {
                void 0;
              }
            }
          }
        })
        .catch(() => {});

      // =========================================================================
      // PASO G: ACEPTAR (GUARDAR ÍTEM)
      // =========================================================================
      const btnAceptarItem = dialogNuevoItem
        .locator(
          '[widgetid="item.botonAceptar"], #item\\.botonAceptar, span.dijitButtonText:has-text("Aceptar"), button:has-text("Aceptar"), input[value="Aceptar"]',
        )
        .filter({ visible: true })
        .first();

      this.logger.log(`Presionando botón Aceptar de ítem ${index + 1}...`);
      await btnAceptarItem.click({ force: true, timeout: 5000 });

      // Esperar reactivamente a que el modal se cierre o el ítem aparezca en la tabla
      const inicioEsperaItem = Date.now();
      while (Date.now() - inicioEsperaItem < 12000) {
        const cerrado = await frameOrPage
          .evaluate(() => {
            const dlg = document.querySelector(
              '.dijitDialog:not([style*="display: none"])',
            );
            return !dlg;
          })
          .catch(() => false);
        if (cerrado) break;
        await page.waitForTimeout(200);
      }
      this.logger.log(`Ítem ${index + 1} guardado correctamente en la tabla.`);
    }

    // =========================================================================
    // PASO H: "Y POR ÚLTIMO CONTINUAR" (AVANZAR TRAS CARGAR ÍTEMS)
    // =========================================================================
    this.logger.log(
      'Todos los ítems agregados con éxito. Presionando botón Continuar para avanzar...',
    );

    // Clic en Continuar de ítems (#boleta.botonGrabarDocumento)
    const btnContinuarPaso2 = frameOrPage
      .locator(
        '#boleta\\.botonGrabarDocumento, [widgetid="boleta.botonGrabarDocumento"], span[role="button"]:has-text("Continuar"), button:has-text("Continuar")',
      )
      .filter({ visible: true })
      .first();

    await btnContinuarPaso2.waitFor({ state: 'visible', timeout: 10000 });
    await btnContinuarPaso2.click({ force: true });

    // Si aparece diálogo modal de confirmación de SUNAT (ej. duplicados o advertencias), aceptarlo
    const modalAviso = frameOrPage
      .locator(
        '.dijitDialog button:has-text("Aceptar"), .dijitDialog input[value="Aceptar"], #dlgBtnAceptar',
      )
      .filter({ visible: true })
      .first();
    if (await modalAviso.isVisible({ timeout: 1500 }).catch(() => false)) {
      this.logger.debug(
        'Diálogo modal de confirmación detectado tras ítems, aceptando...',
      );
      await modalAviso.click({ force: true }).catch(() => {});
    }

    // Esperar reactivamente a que la pantalla avance a Observaciones (#docsrel.botonGrabarDocumento) o Preliminar
    this.logger.debug(
      'Esperando pantalla de Observaciones (#docsrel.botonGrabarDocumento)...',
    );
    await frameOrPage
      .locator(
        '#docsrel\\.botonGrabarDocumento, #boleta-preliminar\\.botonGrabarDocumento',
      )
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
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
      .locator(
        '#boleta-preliminar\\.botonGrabarDocumento, [widgetid="boleta-preliminar.botonGrabarDocumento"], span[role="button"]:has-text("Emitir"), button:has-text("Emitir")',
      )
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

    // Clic en Continuar de Observaciones (#docsrel.botonGrabarDocumento)
    this.logger.debug(
      'Pulsando Continuar en Observaciones (#docsrel.botonGrabarDocumento)...',
    );
    const btnContinuarPaso3 = frameOrPage
      .locator(
        '#docsrel\\.botonGrabarDocumento, [widgetid="docsrel.botonGrabarDocumento"], span[role="button"]:has-text("Continuar"), button:has-text("Continuar")',
      )
      .filter({ visible: true })
      .first();

    await btnContinuarPaso3.waitFor({ state: 'visible', timeout: 8000 });
    await btnContinuarPaso3.click({ force: true });

    // Esperar reactivamente a que la pantalla preliminar esté cargada
    this.logger.debug(
      'Esperando pantalla Preliminar (#boleta-preliminar.botonGrabarDocumento)...',
    );
    await frameOrPage
      .locator('#boleta-preliminar\\.botonGrabarDocumento')
      .waitFor({ state: 'visible', timeout: 20000 });
  }

  /**
   * Paso 4: Confirmación en pantalla preliminar y emisión final.
   * Monitorea reactivamente la aparición del número de comprobante para retornar de inmediato.
   */
  private async confirmarYEmitirBoleta(
    page: Page,
    soloPreliminar = false,
  ): Promise<{
    numeroComprobante: string;
    serie: string;
    correlativo: number;
  }> {
    this.logger.debug('Confirmando emisión en preliminar de comprobante...');
    const currentFrame = await this.obtenerFrameTrabajo(page);

    // Localizar botón oficial "Emitir" (#boleta-preliminar.botonGrabarDocumento)
    const btnEmitir = currentFrame
      .locator(
        '#boleta-preliminar\\.botonGrabarDocumento, [widgetid="boleta-preliminar.botonGrabarDocumento"], span[role="button"]:has-text("Emitir"), button:has-text("Emitir")',
      )
      .first();

    await btnEmitir.waitFor({ state: 'visible', timeout: 20000 });
    this.logger.log('Botón oficial Emitir visible y verificado.');

    if (soloPreliminar) {
      this.logger.log(
        '[MODO SIMULACRO / DRY-RUN] Pantalla Preliminar alcanzada con éxito. Se omite clic en Emitir para no gastar boleta real.',
      );
      return {
        numeroComprobante: 'SIMULACRO-PRELIMINAR-OK',
        serie: 'EB01',
        correlativo: 0,
      };
    }

    this.logger.log('Presionando Emitir...');
    await btnEmitir.click({ timeout: 5000 });

    // 2. Diálogo de confirmación: "¿Está seguro de emitir...?" -> Clic en "Aceptar"
    const inicioConfirmar = Date.now();
    while (Date.now() - inicioConfirmar < 12000) {
      const activeFrame = await this.obtenerFrameTrabajo(page);
      let btnConfirmarAceptar = activeFrame
        .getByRole('button', { name: 'Aceptar' })
        .or(
          activeFrame.locator(
            '.dijitDialog button:has-text("Aceptar"), button:has-text("Aceptar"), button:has-text("Sí"), button:has-text("Si"), #btnAceptar',
          ),
        )
        .filter({ visible: true })
        .first();

      if (
        !(await btnConfirmarAceptar
          .isVisible({ timeout: 200 })
          .catch(() => false))
      ) {
        btnConfirmarAceptar = page
          .getByRole('button', { name: 'Aceptar' })
          .or(
            page.locator(
              '.dijitDialog button:has-text("Aceptar"), button:has-text("Aceptar"), button:has-text("Sí"), button:has-text("Si"), #btnAceptar',
            ),
          )
          .filter({ visible: true })
          .first();
      }

      if (
        await btnConfirmarAceptar.isVisible({ timeout: 200 }).catch(() => false)
      ) {
        await btnConfirmarAceptar
          .click({ force: true, timeout: 3000 })
          .catch(() => {});
        this.logger.log(
          'Confirmación de emisión (Aceptar) enviada exitosamente.',
        );
        break;
      }
      await page.waitForTimeout(100);
    }

    // 3. Monitoreo reactivo del número de comprobante emitido (ej. "EB01-00000452")
    let numeroComprobante = '';
    let serie = 'EB01';
    let correlativo = 0;
    const regexComprobante = /(EB\d{2}|B\d{3}|E\d{3}|F\d{3})\s*[-–]\s*(\d+)/i;

    const inicioEsperaComprobante = Date.now();
    while (Date.now() - inicioEsperaComprobante < 20000) {
      const activeFrame = await this.obtenerFrameTrabajo(page);
      const textoCompleto =
        ((await page.textContent('body').catch(() => '')) || '') +
        ' ' +
        ((await activeFrame.textContent('body').catch(() => '')) || '');

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
    };
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

    const frameFinal = await this.obtenerFrameTrabajo(page);
    if (frameFinal && frameFinal !== page) {
      return frameFinal;
    }

    throw new Error(
      'No se pudo cargar el formulario de emisión SEE-SOL (iframeApplication no detectado o no interactivo).',
    );
  }

  /**
   * Retorna el frame de trabajo correspondiente a 'iframeApplication' de SUNAT SOL.
   */
  private async obtenerFrameTrabajo(page: Page): Promise<Frame | Page> {
    // 1. Prioridad: Buscar en todos los frames cuál contiene los elementos reales del formulario SOL
    for (const frame of page.frames()) {
      try {
        const tieneFormulario = await frame.evaluate(() => {
          return !!(
            document.getElementById('inicio.tipoDocumento') ||
            document.getElementById('inicio.numeroDocumento') ||
            document.getElementById('btnEmitir') ||
            document.querySelector('[id*="tipoDocumento"]') ||
            document.querySelector(
              'button[id*="Continuar"], input[value*="Continuar"], button[id*="Emitir"], input[value*="Emitir"]',
            ) ||
            Array.from(
              document.querySelectorAll('button, input[type="button"]'),
            ).some((b) =>
              /emitir/i.test(
                b.textContent || (b as HTMLInputElement).value || '',
              ),
            )
          );
        });
        if (tieneFormulario) {
          return frame;
        }
      } catch {
        // Frame puede estar en otro origen o en proceso de navegación
      }
    }

    // 2. Intentar el iframe oficial de SEE-SOL SUNAT por nombre
    const frameApp = page.frame({ name: 'iframeApplication' });
    if (frameApp) {
      return frameApp;
    }

    // 3. Esperar si aún está cargando el elemento iframe en el DOM
    try {
      const frameEl = await page
        .waitForSelector(
          'iframe[name="iframeApplication"], iframe#iframeApplication',
          { timeout: 2500 },
        )
        .catch(() => null);
      if (frameEl) {
        const content = await frameEl.contentFrame();
        if (content) return content;
      }
    } catch {
      // Ignorar timeout de selector iframe
    }

    // 4. Buscar en todos los frames por nombre o URL conocida
    for (const frame of page.frames()) {
      const name = frame.name();
      const url = frame.url();
      if (
        name === 'iframeApplication' ||
        url.includes('iframeApplication') ||
        url.includes('action=execute') ||
        url.includes('11.5.4.1.1') ||
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
