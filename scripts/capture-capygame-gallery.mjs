import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = process.env.TEST_URL || 'http://localhost:3000';
const SYSTEM_CHROMIUM =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const OUT_DIRS = [
  path.resolve('docs/gallery'),
  path.resolve('public/gallery'),
  path.resolve('web/public/gallery'),
  '/.aistudio/artifacts/brain/7fd0fadd-f1e9-41ec-a660-12aa38d624d0',
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

async function captureGallery() {
  console.log(`[Gallery Capture] Launching Chromium against ${URL}...`);
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

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(600);

  // Equip Royal Crown & Golden Sun fur coat in Wardrobe
  await page.locator('button', { hasText: 'Wardrobe' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Royal Crown' }).first().click();
  await page.locator('button', { hasText: 'Golden Sun' }).first().click();
  await page.waitForTimeout(200);

  // Build a Cozy Onsen in World Builder
  await page.locator('button', { hasText: 'World Builder' }).first().click();
  await page.waitForTimeout(200);
  const buildBtn = page.locator('button', { hasText: '75 🍊' }).first();
  if (await buildBtn.isVisible()) {
    await buildBtn.click();
    await page.waitForTimeout(200);
  }

  // Unlock Aqua Flippers in Spore DNA Lab & capture DNA Lab screenshot
  await page.locator('button', { hasText: 'Spore DNA Lab' }).first().click();
  await page.waitForTimeout(250);
  const flipBtn = page.locator('button', { hasText: '25 🧬' }).first();
  if (await flipBtn.isVisible()) {
    await flipBtn.click();
    await page.waitForTimeout(250);
  }
  saveToAllDirs('capygame_dna_lab.png', await page.screenshot({ type: 'png' }));

  // Switch back to Play Styles tab & capture Capy Sanctuary Hub
  await page.locator('button', { hasText: 'Play Styles' }).first().click();
  await page.waitForTimeout(400);
  saveToAllDirs('capygame_sanctuary.png', await page.screenshot({ type: 'png' }));

  // Capture Spore Lagoon Evolution
  await page.locator('button', { hasText: 'Spore Evo' }).first().click();
  await page.waitForTimeout(550);
  saveToAllDirs('capygame_spore.png', await page.screenshot({ type: 'png' }));

  // Capture Yuzu Breakout
  await page.locator('button', { hasText: 'Breakout' }).first().click();
  await page.waitForTimeout(550);
  saveToAllDirs('capygame_breakout.png', await page.screenshot({ type: 'png' }));

  // Capture Number Stampede Runner
  await page.locator('button', { hasText: 'Stampede' }).first().click();
  await page.waitForTimeout(650);
  saveToAllDirs('capygame_runner.png', await page.screenshot({ type: 'png' }));

  // Capture Yuzu Mountain Fall Guys Parkour
  await page.locator('button', { hasText: 'Parkour' }).first().click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(550);
  await page.keyboard.up('KeyW');
  saveToAllDirs('capygame_fallguys.png', await page.screenshot({ type: 'png' }));

  await browser.close();
  console.log('[SUCCESS] All 6 CapyGame 3D showcase screenshots captured!');
}

captureGallery().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
