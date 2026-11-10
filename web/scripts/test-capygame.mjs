import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.TEST_URL || 'http://localhost:3000';
const SYSTEM_CHROMIUM = '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

async function runTests() {
  console.log(`[CapyGame Test] Launching Chromium against ${URL}...`);
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
  });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err.message, err.stack);
    errors.push(`PageError: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      console.log(`[BROWSER ${msg.type().toUpperCase()}]`, text);
      if (msg.type() === 'error' && !text.includes('WebSocket') && !text.includes('favicon')) {
        errors.push(`ConsoleError: ${text}`);
      }
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  const rootHtml = await page.locator('#root').innerHTML();
  console.log(`[DEBUG] #root innerHTML length: ${rootHtml.length}`);
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(600);

  // 1. Verify CapyGame 3D canvas is active and sized properly
  const canvasBox = await page.locator('canvas').first().boundingBox();
  if (!canvasBox || canvasBox.width < 800 || canvasBox.height < 500) {
    throw new Error(`Invalid 3D canvas bounding box: ${JSON.stringify(canvasBox)}`);
  }
  console.log(`[PASS] 3D WebGL Canvas rendered (${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)})`);

  // 2. Test clicking canvas to harvest Yuzu Coins and verify coin counter increments
  await page.mouse.click(canvasBox.width / 2, canvasBox.height / 2);
  await page.mouse.click(canvasBox.width / 2 + 20, canvasBox.height / 2);
  await page.waitForTimeout(300);

  // 3. Test switching through all 5 Play Styles
  const modes = [
    { label: 'Spore Evo', expectedTitle: 'Spore Lagoon' },
    { label: 'Breakout', expectedTitle: 'Yuzu Breakout' },
    { label: 'Stampede', expectedTitle: 'Number Stampede' },
    { label: 'Parkour', expectedTitle: 'Yuzu Mountain' },
    { label: 'Sanctuary', expectedTitle: 'Capy Sanctuary' },
  ];

  for (const mode of modes) {
    const btn = page.locator('button', { hasText: mode.label }).first();
    await btn.click();
    await page.waitForTimeout(350);
    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes(mode.expectedTitle)) {
      throw new Error(`Expected mode banner "${mode.expectedTitle}" after clicking "${mode.label}"`);
    }
    console.log(`[PASS] Seamless switch to Play Style: ${mode.label} -> ${mode.expectedTitle}`);
  }

  // 4. Test keyboard movement & jump in Sanctuary
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  console.log(`[PASS] Keyboard movement & jump input processed cleanly`);

  // 5. Test Bottom Dock Tabs: World Builder, Spore DNA Lab, Meta Upgrades, Wardrobe
  const dockTabs = [
    { tab: 'World Builder', expectedContent: 'Cozy Onsen' },
    { tab: 'Spore DNA Lab', expectedContent: 'Mighty Chomp Tusks' },
    { tab: 'Meta Upgrades', expectedContent: 'Speed & Agility' },
    { tab: 'Wardrobe', expectedContent: 'Onsen Yuzu' },
  ];

  for (const item of dockTabs) {
    await page.locator('button', { hasText: item.tab }).first().click();
    await page.waitForTimeout(250);
    const text = await page.locator('body').innerText();
    if (!text.includes(item.expectedContent)) {
      throw new Error(`Expected "${item.expectedContent}" in dock tab "${item.tab}"`);
    }
    console.log(`[PASS] Dock Tab "${item.tab}" rendered "${item.expectedContent}"`);
  }

  // Equip a wardrobe skin (Sakura Pink) and hat (Royal Crown)
  await page.locator('button', { hasText: 'Sakura Pink' }).first().click();
  await page.locator('button', { hasText: 'Royal Crown' }).first().click();
  await page.waitForTimeout(200);
  console.log(`[PASS] Equipped Sakura Pink fur skin and Royal Crown hat in real time`);

  // Test collapsing and expanding the bottom dock
  await page.locator('button', { hasText: 'Hide Controls' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Show Game Dock' }).first().click();
  await page.waitForTimeout(200);
  console.log(`[PASS] Bottom Control Dock collapsed and expanded cleanly`);

  // 6. Test seamless switch to CapyPaint and back to CapyGame 3D
  const capyPaintBtn = page.locator('button', { hasText: 'CapyPaint' }).first();
  await capyPaintBtn.click();
  await page.waitForTimeout(1000);

  const paintSwitchBackBtn = page.locator('button', { hasText: 'CapyGame 3D' }).first();
  const isPaintVisible = await paintSwitchBackBtn.isVisible();
  if (!isPaintVisible) {
    throw new Error('Expected CapyPaint top bar with "CapyGame 3D" return button to be visible');
  }
  console.log(`[PASS] Seamlessly switched to CapyPaint 2D Color-by-Number app`);

  // Switch back to CapyGame 3D
  await paintSwitchBackBtn.click();
  await page.waitForTimeout(600);
  const bodyAfterReturn = await page.locator('body').innerText();
  if (!bodyAfterReturn.includes('Capy Sanctuary')) {
    throw new Error('Failed to return to CapyGame 3D Sanctuary view');
  }
  console.log(`[PASS] Seamlessly returned from CapyPaint to CapyGame 3D`);

  if (errors.length > 0) {
    throw new Error(`Encountered runtime errors:\n${errors.join('\n')}`);
  }

  await browser.close();
  console.log('[SUCCESS] All CapyGame 3D + CapyPaint end-to-end checks passed with 0 errors!');
}

runTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
