import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000/';
const SYSTEM_CHROMIUM =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const OUT_DIRS = [
  path.resolve('docs/gallery'),
];

function saveToAllDirs(filename, buffer) {
  for (const dir of OUT_DIRS) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
    } catch (err) {
      console.warn(`Could not write to ${dir}:`, err.message);
    }
  }
  console.log(`[CAPTURED] ${filename} (${Math.round(buffer.length / 1024)} KB)`);
}

async function captureCdpPng(cdp) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  return Buffer.from(data, 'base64');
}

async function captureGallery() {
  const url = BASE_URL;
  console.log(`[Gallery Capture] Launching Chromium against ${url}...`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
  await page.getByTestId('unified-top-bar').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(200);

  // 1. Capture Single-Line Top Bar + Scale Scrubber Dropdown at Grand-Design Spiral Galaxies
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.jumpToScaleBand('galaxies', true);
    mgr.tick(0.05, 0.06);
  });
  await page.getByTestId('toggle-scale-atlas-btn').click({ force: true });
  await page.waitForTimeout(140);
  saveToAllDirs('capygame_dna_lab.png', await captureCdpPng(cdp));
  await page.getByTestId('close-scale-atlas-btn').click({ force: true });

  // 2. Capture Capy Sanctuary Hub with Dachshund Capy-Snake
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.stats.unlockedModes = ['sanctuary', 'spore', 'breakout', 'runner', 'fallguys'];
    mgr.resumeSurfacePlayFromForest(true);
    mgr.switchMode('sanctuary', false);
    for (let k = 0; k < 4; k++) {
      const f = mgr.spawnPhysicsFruit(
        mgr.heroLocalPos.x,
        0.24,
        mgr.heroLocalPos.z,
        0,
        0,
        0,
        0.24,
        mgr.activeHeadOrangeIndex,
        false,
        0
      );
      f.pickupDelay = 0;
      mgr.tick(0.04);
    }
    mgr.heroLocalPos.set(3.2, 0, 8.6);
    mgr.heroYaw = Math.PI * 0.92;
    mgr.resetDachshundTrail();
    for (let s = 0; s < 10; s++) mgr.tick(0.05);
    mgr.tick(0.05, 0.06);
  });
  await page.waitForTimeout(160);
  saveToAllDirs('capygame_sanctuary.png', await captureCdpPng(cdp));

  // 3. Capture Contiguous Grand Promenade Causeway Overland Walk + Rapier3D Physics Telemetry Popover
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setCosmicStage('playing');
    mgr.switchMode('sanctuary', false);
    // Position Hero directly on the SE Grand Promenade Causeway walking overland toward Yuzu Mountain (+75, +75)
    mgr.heroLocalPos.set(34.0, 0.2, 34.0);
    mgr.heroYaw = Math.PI * 0.25;
    mgr.resetDachshundTrail();
    for (let s = 0; s < 14; s++) {
      mgr.moveInput.x = Math.SQRT1_2;
      mgr.moveInput.z = Math.SQRT1_2;
      mgr.tick(0.04);
    }
    mgr.moveInput.x = 0;
    mgr.moveInput.z = 0;
    mgr.tick(0.05, 0.06);
  });
  await page.getByTestId('toggle-infographic-btn').click({ force: true });
  await page.waitForTimeout(160);
  saveToAllDirs('capygame_contiguous_promenade.png', await captureCdpPng(cdp));
  await page.getByTestId('close-infographic-btn').click({ force: true });

  // 4. Capture All 4 Outer Contiguous Districts (Spore Lagoon, Yuzu Breakout, Number Stampede, Yuzu Mountain)
  const outerDistricts = [
    { id: 'spore', file: 'capygame_spore.png' },
    { id: 'breakout', file: 'capygame_breakout.png' },
    { id: 'runner', file: 'capygame_runner.png' },
    { id: 'fallguys', file: 'capygame_fallguys.png' },
  ];
  for (const d of outerDistricts) {
    await page.evaluate((modeId) => {
      const mgr = window.__capyManager;
      if (!mgr) return;
      mgr.stats.unlockedModes = ['sanctuary', 'spore', 'breakout', 'runner', 'fallguys'];
      mgr.setCosmicStage('playing');
      mgr.switchMode(modeId, false);
      for (let s = 0; s < 10; s++) mgr.tick(0.05);
      mgr.tick(0.05, 0.06);
    }, d.id);
    await page.waitForTimeout(140);
    saveToAllDirs(d.file, await captureCdpPng(cdp));
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 1500))]);
  console.log('[SUCCESS] All 7 CapyGame contiguous world + physics telemetry showcase screenshots captured!');
  process.exit(0);
}

captureGallery().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
