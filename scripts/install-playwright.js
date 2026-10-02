// scripts/install-playwright.js
const { execSync } = require('child_process');

// Forzar instalación dentro de node_modules/playwright-core/.local-browsers
// para que persista en el contenedor de Render / PaaS después del build
process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

console.log('[Playwright] Instalando Chromium en node_modules (PLAYWRIGHT_BROWSERS_PATH=0)...');

try {
  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
  });
  console.log('[Playwright] Chromium instalado exitosamente.');
} catch (error) {
  console.error('[Playwright] Error al instalar Chromium:', error.message);
  process.exit(1);
}
