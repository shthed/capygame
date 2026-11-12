// test-pwa-offline.mjs - Automated Playwright Test for CapyGame 3D PWA & Offline Support
import { chromium } from 'playwright';
import fs from 'fs';

const SYSTEM_CHROMIUM =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

async function runPwaOfflineTest() {
  console.log('[PWA Test] Starting CapyGame 3D PWA & Offline Verification...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    console.log('1. Fetching and validating manifest.webmanifest...');
    const manifestResponse = await page.goto('http://localhost:3000/manifest.webmanifest');
    if (!manifestResponse || manifestResponse.status() !== 200) {
      throw new Error(`Failed to load manifest.webmanifest (status: ${manifestResponse?.status()})`);
    }
    const manifestJson = JSON.parse(await manifestResponse.text());
    if (manifestJson.name !== 'CapyGame 3D' || manifestJson.short_name !== 'CapyGame') {
      throw new Error(`Unexpected manifest name/short_name: ${manifestJson.name} / ${manifestJson.short_name}`);
    }
    if (manifestJson.display !== 'standalone') {
      throw new Error(`Unexpected manifest display: ${manifestJson.display}`);
    }
    if (!manifestJson.icons || manifestJson.icons.length < 3) {
      throw new Error(`Expected at least 3 icons in manifest, found ${manifestJson.icons?.length}`);
    }
    console.log('   Manifest validation passed.');

    console.log('2. Navigating to http://localhost:3000/ and waiting for Service Worker...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.getByTestId('unified-top-bar').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('capygame-canvas-container').waitFor({ state: 'visible', timeout: 15000 });

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg && reg.active);
    });
    if (!swRegistered) {
      throw new Error('Service Worker did not become ready/active.');
    }
    console.log('   Service Worker registered and active.');

    console.log('3. Inspecting Cache Storage...');
    const cacheDetails = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const hasCapyCache = cacheNames.includes('capy-cache-v1');
      if (!hasCapyCache) return { hasCapyCache: false, count: 0 };
      const cache = await caches.open('capy-cache-v1');
      const requests = await cache.keys();
      return {
        hasCapyCache: true,
        count: requests.length,
      };
    });
    if (!cacheDetails.hasCapyCache || cacheDetails.count === 0) {
      throw new Error('Expected capy-cache-v1 to contain cached assets.');
    }
    console.log(`   Cache Storage populated (${cacheDetails.count} entries).`);

    console.log('4. Disconnecting network and reloading completely offline...');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.getByTestId('unified-top-bar').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByTestId('capygame-canvas-container').waitFor({ state: 'visible', timeout: 15000 });
    console.log('   CapyGame 3D HUD and WebGL canvas loaded offline via Service Worker.');

    await context.setOffline(false);
    if (consoleErrors.length > 0) {
      console.warn('Console errors recorded:', consoleErrors);
    }
    console.log('[PWA Test] PASSED.');
  } finally {
    await browser.close();
  }
}

runPwaOfflineTest().catch((err) => {
  console.error('[PWA Test] FAILED:', err);
  process.exit(1);
});
