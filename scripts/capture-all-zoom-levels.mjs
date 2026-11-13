import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/';
const ARTIFACT_DIR = '/.aistudio/artifacts/brain/7fd0fadd-f1e9-41ec-a660-12aa38d624d0';

const GALLERY_DIRS = [
  path.resolve('docs/gallery'),
];

const ZOOM_GALLERY_DIRS = [
  path.resolve('docs/gallery/zoom_levels'),
];

const ALL_SCALE_BANDS = [
  'multiverse',
  'big_bang',
  'universe',
  'observable',
  'cosmic_web',
  'filament',
  'supercluster',
  'cluster',
  'galaxy',
  'spiral_arms',
  'nebulas',
  'stellar_systems',
  'planetary_system',
  'planet',
  'atmosphere',
  'land_masses',
  'ecosystems',
  'capybara_forest',
  'leaf_fur_micro',
  'biological_cells',
  'dna_molecules',
  'atomic_orbitals',
  'atomic_nucleus',
  'quarks_gluons',
  'single_electron',
  'single_photon',
  'planck_quantum_foam',
];

function ensureCleanDirs() {
  for (const dir of GALLERY_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const dir of ZOOM_GALLERY_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch {
    // Ignore outside AI Studio
  }
}

function saveToZoomGalleries(buffer, filename) {
  for (const dir of ZOOM_GALLERY_DIRS) {
    fs.writeFileSync(path.join(dir, filename), buffer);
  }
  try {
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
  } catch {
    // Ignore outside AI Studio
  }
}

function saveToGalleries(buffer, filename) {
  for (const dir of GALLERY_DIRS) {
    fs.writeFileSync(path.join(dir, filename), buffer);
  }
  try {
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
  } catch {
    // Ignore outside AI Studio
  }
}

async function captureCdpPng(cdp) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  return Buffer.from(data, 'base64');
}

(async () => {
  ensureCleanDirs();
  console.log('Launching Playwright to capture all 25 zoom levels + 5 playable sectors...');
  const browser = await chromium.launch({
    headless: true,
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
  const shaderErrors = [];
  page.on('pageerror', (err) => shaderErrors.push(`PageError: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Shader Error') || text.includes('WebGLProgram')) {
      shaderErrors.push(text);
    }
  });
  const cdp = await context.newCDPSession(page);

  const url = BASE_URL.includes('?') ? `${BASE_URL}&app=game` : `${BASE_URL}?app=game`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByTestId('unified-top-bar').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(160);

  // 1. Capture every single one of the 25 logarithmic zoom levels (+28 Big Bang -> +0.8 Forest -> -35 Planck)
  const capturedManifest = [];
  for (let i = 0; i < ALL_SCALE_BANDS.length; i++) {
    const bandId = ALL_SCALE_BANDS[i];
    const meta = await page.evaluate((id) => {
      const mgr = window.__capyManager;
      if (!mgr || !mgr.seamlessUniverse) return null;
      const spec = mgr.seamlessUniverse.getBandById(id);
      if (id === 'single_electron') {
        mgr.quantumFocusMode = 'electron';
      } else if (id === 'single_photon') {
        mgr.quantumFocusMode = 'photon';
      } else {
        mgr.quantumFocusMode = 'auto';
      }
      mgr.cosmicOrbitYaw = id === 'capybara_forest' ? 0.36 : 0.44;
      mgr.cosmicOrbitPitch = id === 'capybara_forest' ? 0.28 : 0.32;
      mgr.setSeamlessLogScale(spec.logMeters, true);
      mgr.tick(0.05);
      mgr.tick(0.05, 0.06);
      return mgr.getUniverseScaleTelemetry();
    }, bandId);

    await page.waitForTimeout(55);
    const idxStr = String(i + 1).padStart(2, '0');
    const expVal = meta?.logScaleMeters ?? 0;
    const expSlug = expVal >= 0 ? `pos${expVal}` : `neg${Math.abs(expVal)}`;
    const filename = `zoom_${idxStr}_${bandId}_10e_${expSlug}m.png`;
    const png = await captureCdpPng(cdp);
    saveToZoomGalleries(png, filename);

    capturedManifest.push({
      index: i + 1,
      bandId,
      filename,
      scientificLabel: meta?.scientificLabel || '',
      scaleFormatted: meta?.scaleFormatted || '',
      bandTitle: meta?.bandTitle || bandId,
      bandSubtitle: meta?.bandSubtitle || '',
    });
    console.log(`Captured [${idxStr}/${ALL_SCALE_BANDS.length}] ${filename} (${meta?.scientificLabel} — ${meta?.bandTitle})`);
  }

  // 1B. Capture Exact Bug-Audit Scales (10^+13.7m / 326 AU & 10^+17.1m / 14.07 ly) + Unlockable Optics Showcases
  const auditShots = [
    { log: 13.7, file: 'audit_10e_pos13_7m_326au.png', yaw: 0.44, pitch: 0.32, hubble: false },
    { log: 17.1, file: 'audit_10e_pos17_1m_14ly.png', yaw: 0.42, pitch: 0.28, hubble: false },
    { log: 17.45, file: 'audit_nebula_hubble_sho.png', yaw: 0.48, pitch: 0.26, hubble: true },
  ];
  for (const shot of auditShots) {
    await page.evaluate((s) => {
      const mgr = window.__capyManager;
      if (!mgr) return;
      mgr.setAllFeaturesUnlocked(false);
      mgr.setShowObjectMarkers(false);
      mgr.setRealityScaleGamma(1.0);
      mgr.setAstrophysicsPalette(s.hubble ? 'hubble' : 'natural');
      mgr.cosmicOrbitYaw = s.yaw;
      mgr.cosmicOrbitPitch = s.pitch;
      mgr.setSeamlessLogScale(s.log, true);
      mgr.tick(0.05);
      mgr.tick(0.05, 0.06);
    }, shot);
    await page.waitForTimeout(60);
    saveToGalleries(await captureCdpPng(cdp), shot.file);
    console.log(`Captured audit comparison: ${shot.file}`);
  }

  // Capture 1:1 Solar System with Unlockable Object Finder Markers ON
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setAstrophysicsPalette('natural');
    mgr.setAllFeaturesUnlocked(true);
    mgr.setRealityScaleGamma(1.0);
    mgr.setShowObjectMarkers(true);
    mgr.cosmicOrbitYaw = 0.52;
    mgr.cosmicOrbitPitch = 0.38;
    const spec = mgr.seamlessUniverse.getBandById('stellar_systems');
    mgr.setSeamlessLogScale(spec.logMeters, true);
    mgr.tick(0.09);
    mgr.tick(0.05, 0.06);
  });
  await page.waitForTimeout(100);
  saveToGalleries(await captureCdpPng(cdp), 'optics_solar_1to1_markers.png');
  console.log('Captured 1:1 Object Finder Markers showcase: optics_solar_1to1_markers.png');

  // Capture Solar System with Reality Rescaler (gamma = 0.30) + Cosmic Optics Popover Open
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setAllFeaturesUnlocked(true);
    mgr.setShowObjectMarkers(true);
    mgr.setRealityScaleGamma(0.30);
    mgr.cosmicOrbitYaw = 0.58;
    mgr.cosmicOrbitPitch = 0.36;
    const spec = mgr.seamlessUniverse.getBandById('stellar_systems');
    mgr.setSeamlessLogScale(spec.logMeters, true);
    mgr.tick(0.09);
    mgr.tick(0.05, 0.06);
  });
  await page.getByTestId('toggle-optics-panel-btn').click({ force: true });
  await page.waitForTimeout(110);
  saveToGalleries(await captureCdpPng(cdp), 'optics_solar_rescaled_atlas.png');
  await page.getByTestId('close-optics-panel-btn').click({ force: true });
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setRealityScaleGamma(1.0);
    mgr.setShowObjectMarkers(false);
    mgr.setAllFeaturesUnlocked(false);
  });
  console.log('Captured Reality Rescaler showcase: optics_solar_rescaled_atlas.png');

  // 1C. Capture Unified Stellar System Architecture (Rocky Planets, 3D Main Asteroid Belt, Gas Giants & Orbit Controls)
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.selectedGalaxyIndex = 0;
    mgr.selectStarSystem(0);
    mgr.cosmicOrbitYaw = 0.65;
    mgr.cosmicOrbitPitch = 0.42;
    mgr.cosmicZoomMultiplier = 1.05;
    mgr.setOrbitTimeScale('1_orbit_min');
    mgr.tick(0.08);
    mgr.tick(0.05, 0.06);
  });
  await page.waitForTimeout(140);
  saveToGalleries(await captureCdpPng(cdp), 'cosmic_star_system_unified.png');
  saveToZoomGalleries(await captureCdpPng(cdp), 'zoom_cosmic_star_system_unified.png');
  console.log('Captured unified stellar system: cosmic_star_system_unified.png');

  // Fast-Forward Orbital Timescale (1 Orbit/sec Keplerian whirl)
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setOrbitTimeScale('1_orbit_s');
    for (let s = 0; s < 12; s++) mgr.tick(0.05);
    mgr.tick(0.05, 0.06);
  });
  await page.waitForTimeout(100);
  saveToGalleries(await captureCdpPng(cdp), 'cosmic_fastforward_orbits.png');
  saveToZoomGalleries(await captureCdpPng(cdp), 'zoom_cosmic_fastforward_orbits.png');
  console.log('Captured fast-forward orbits: cosmic_fastforward_orbits.png');

  // Ringed Gas Giant View (Azure Ringworld Kronos)
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.selectPlanet(3);
    mgr.cosmicOrbitYaw = 0.52;
    mgr.cosmicOrbitPitch = 0.28;
    mgr.tick(0.05);
    mgr.tick(0.05, 0.06);
  });
  await page.waitForTimeout(120);
  saveToGalleries(await captureCdpPng(cdp), 'cosmic_gas_giant_rings.png');
  saveToZoomGalleries(await captureCdpPng(cdp), 'zoom_cosmic_gas_giant_rings.png');
  console.log('Captured ringed gas giant: cosmic_gas_giant_rings.png');

  // 2. Capture Active Surface Gameplay across all 5 Sectors + Compact Single-Line Top Bar Dropdown Showcase
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
  saveToGalleries(await captureCdpPng(cdp), 'capygame_sanctuary.png');
  console.log('Captured gameplay showcase: capygame_sanctuary.png');

  // Capture Contiguous Grand Promenade Causeway Overland Walk + Rapier3D Physics Telemetry Popover
  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.setCosmicStage('playing');
    mgr.switchMode('sanctuary', false);
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
  saveToGalleries(await captureCdpPng(cdp), 'capygame_contiguous_promenade.png');
  await page.getByTestId('close-infographic-btn').click({ force: true });
  console.log('Captured contiguous promenade + physics telemetry: capygame_contiguous_promenade.png');

  const outerModes = [
    { id: 'spore', file: 'capygame_spore.png' },
    { id: 'breakout', file: 'capygame_breakout.png' },
    { id: 'runner', file: 'capygame_runner.png' },
    { id: 'fallguys', file: 'capygame_fallguys.png' },
  ];
  for (const m of outerModes) {
    await page.evaluate((modeId) => {
      const mgr = window.__capyManager;
      if (!mgr) return;
      mgr.stats.unlockedModes = ['sanctuary', 'spore', 'breakout', 'runner', 'fallguys'];
      mgr.setCosmicStage('playing');
      mgr.switchMode(modeId, false);
      for (let s = 0; s < 8; s++) mgr.tick(0.05);
      mgr.tick(0.05, 0.06);
    }, m.id);
    await page.waitForTimeout(130);
    saveToGalleries(await captureCdpPng(cdp), m.file);
    console.log(`Captured gameplay showcase: ${m.file}`);
  }

  await page.evaluate(() => {
    const mgr = window.__capyManager;
    if (!mgr) return;
    mgr.jumpToScaleBand('galaxy', true);
    mgr.tick(0.05, 0.06);
  });
  await page.getByTestId('toggle-scale-atlas-btn').click({ force: true });
  await page.waitForTimeout(120);
  saveToGalleries(await captureCdpPng(cdp), 'capygame_dna_lab.png');
  console.log('Captured top-bar Scale Atlas dropdown showcase: capygame_dna_lab.png');

  for (const dir of ZOOM_GALLERY_DIRS) {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(capturedManifest, null, 2));
  }

  if (shaderErrors.length > 0) {
    console.error('WebGL Shader / Runtime Errors detected:', shaderErrors);
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 1000))]);
    process.exit(1);
  }

  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 1500))]);
  console.log('All 25 zoom-level screenshots + Optics & gameplay showcases saved cleanly (0 shader errors).');
  process.exit(0);
})();
