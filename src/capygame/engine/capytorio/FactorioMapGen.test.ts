import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  CAPYTORIO_MAP_PRESETS,
  DEFAULT_CAPYTORIO_MAP_GEN_CONFIG,
  FACTORIO_RESOURCE_IDS,
  computeCrc32,
  createCapytorioMapPreset,
  decodeFactorioMapExchangeString,
  encodeFactorioMapExchangeString,
  sanitizeCapytorioMapGenConfig,
  type CapytorioMapGenConfig,
} from './FactorioMapExchangeCodec';
import {
  getActiveCapytorioMapGen,
  getCapytorioMapGenRevision,
  getFactorioMapGenDiagnostics,
  getOrBakeCapytorioClipmapChunkRGBA,
  resetActiveCapytorioMapGenToDefault,
  sampleCapytorioBaseResource,
  sampleCapytorioTerrainDetail,
  sampleCapytorioTreeAt,
  sampleCapytorioTreeDetail,
  setActiveCapytorioMapGen,
} from './CapytorioTerrainGen';
import {
  CAPYTORIO_CLIPMAP_RINGS,
  CAPYTORIO_CLOUD_LOWER_Y,
  CAPYTORIO_CLOUD_UPPER_Y,
  CAPYTORIO_PLANET_GLOBE_ACTIVATE_M,
  createCapytorioAltitudeLodState,
  evaluateCapytorioAltitudeLod,
  evaluateClipmapRingAlpha,
  getCapytorioMachineProxyColorHex,
  getCapytorioMachineProxyHeight,
} from './CapytorioOrbitalLodMath';
import {
  CAPYTORIO_MAX_VIEW_RADIUS_TILES,
  computeCapytorioVisibleTileRadius,
  createCapytorioAdaptiveLodState,
  stepCapytorioAdaptiveLod,
} from './CapytorioAdaptiveLod';
import { sanitizeCapytorioStateShallow } from './CapytorioStateGuard';
import {
  CapytorioFactoryEngine,
  sanitizeCapytorioState,
} from '../CapytorioFactoryEngine';
import { CAPYTORIO_RECIPES, CAPYTORIO_FUEL_BURN_SECONDS } from '../CapytorioData';
import { Capytorio3DRenderer } from '../CapytorioMeshBuilder';

function buildSyntheticFactorio11ExchangeString(seed: number): string {
  const chunks: Buffer[] = [];
  const pushU8 = (v: number) => chunks.push(Buffer.from([v & 0xff]));
  const pushBool = (v: boolean) => pushU8(v ? 1 : 0);
  const pushU16 = (v: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v, 0);
    chunks.push(b);
  };
  const pushI16 = (v: number) => {
    const b = Buffer.alloc(2);
    b.writeInt16LE(v, 0);
    chunks.push(b);
  };
  const pushU32 = (v: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0, 0);
    chunks.push(b);
  };
  const pushF32 = (v: number) => {
    const b = Buffer.alloc(4);
    b.writeFloatLE(v, 0);
    chunks.push(b);
  };
  const pushF64 = (v: number) => {
    const b = Buffer.alloc(8);
    b.writeDoubleLE(v, 0);
    chunks.push(b);
  };
  const pushStr = (s: string) => {
    const sb = Buffer.from(s, 'utf8');
    pushU8(sb.length);
    chunks.push(sb);
  };

  // Version 1.1.110.0 + version_extra
  pushU16(1);
  pushU16(1);
  pushU16(110);
  pushU16(0);
  pushU8(0);

  // terrain_segmentation, water
  pushF32(1.5);
  pushF32(2.0);

  // autoplace_controls (1 entry: iron-ore)
  pushU8(1);
  pushStr('iron-ore');
  pushF32(0.5);
  pushF32(2.5);
  pushF32(3.0);

  // autoplace_settings (0)
  pushU8(0);
  // default_enable_all_autoplace_controls
  pushBool(true);
  // seed, width, height
  pushU32(seed);
  pushU32(0);
  pushU32(0);
  // area_to_generate_at_start (2 delta pos + 4 extra bytes)
  pushI16(0);
  pushI16(0);
  pushI16(0);
  pushI16(0);
  chunks.push(Buffer.from([0, 0, 1, 0x80]));
  // starting_area, peaceful_mode
  pushF32(1.5);
  pushBool(false);
  // starting_points (0)
  pushU8(0);
  // property_expression_names (2 entries: legacy 1.1 keys)
  pushU8(2);
  pushStr('elevation');
  pushStr('0_17-island');
  pushStr('control-setting:moisture:bias');
  pushStr('-0.25');
  // cliff_settings (1.1)
  pushStr('cliff');
  pushF32(10);
  pushF32(40);
  pushF32(1);

  // map_settings (1.1): 12 pollution + 8 steering + 4 evolution + 13 expansion + 13 unit_group + 33 path_finder = 83 optional booleans (all false)
  for (let i = 0; i < 83; i++) pushBool(false);
  // bare: max_failed_behavior_count (u32) + difficulty_settings (u8, u8, f64, u8)
  pushU32(3);
  pushU8(0);
  pushU8(0);
  pushF64(1.0);
  pushU8(0);

  const body = Buffer.concat(chunks);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32LE(computeCrc32(body), 0);
  const compressed = zlib.deflateSync(Buffer.concat([body, crcBuf]));
  return `>>>${compressed.toString('base64')}<<<`;
}

test('FactorioMapExchangeCodec: round-trips custom v2.0 exchange strings, imports v1.1 & numeric seeds, and rejects corrupted strings', async () => {
  const custom = createCapytorioMapPreset('desert_frontier', 13379001);
  custom.preset = 'custom';
  custom.mapType = 'island';
  custom.waterScale = 1.4;
  custom.waterCoverage = 0.85;
  custom.startingArea = 1.75;
  custom.moistureScale = 1.2;
  custom.moistureBias = -0.32;
  custom.auxScale = 0.9;
  custom.auxBias = 0.28;
  custom.treesFrequency = 0.75;
  custom.treesSize = 0.5;
  custom.resources.iron_ore = { frequency: 0.5, size: 2.0, richness: 2.5 };
  custom.resources.crude_oil = { frequency: 1.5, size: 1.75, richness: 3.0 };
  custom.resources.uranium_ore = { frequency: 1.0, size: 0, richness: 1.5 };

  const encoded = await encodeFactorioMapExchangeString(custom);
  assert.ok(encoded.startsWith('>>>') && encoded.endsWith('<<<'), 'Valid Factorio wrapper');

  const decoded = await decodeFactorioMapExchangeString(encoded);
  assert.equal(decoded.ok, true, `Expected clean decode, got error: ${decoded.error}`);
  assert.ok(decoded.config);
  assert.match(decoded.sourceVersion ?? '', /^Factorio 2\.0\./);

  const cfg = decoded.config!;
  assert.equal(cfg.seed, 13379001);
  assert.equal(cfg.mapType, 'island');
  assert.ok(Math.abs(cfg.waterScale - 1.4) < 1e-3);
  assert.ok(Math.abs(cfg.waterCoverage - 0.85) < 1e-3);
  assert.ok(Math.abs(cfg.startingArea - 1.75) < 1e-3);
  assert.ok(Math.abs(cfg.moistureBias - -0.32) < 1e-3);
  assert.ok(Math.abs(cfg.auxBias - 0.28) < 1e-3);
  assert.ok(Math.abs(cfg.treesSize - 0.5) < 1e-3);
  assert.ok(Math.abs(cfg.resources.iron_ore.richness - 2.5) < 1e-3);
  assert.ok(Math.abs(cfg.resources.crude_oil.richness - 3.0) < 1e-3);
  assert.equal(cfg.resources.uranium_ore.size, 0, 'Disabled resource size=0 preserved');

  // Factorio 1.1 exchange string import + migration
  const str11 = buildSyntheticFactorio11ExchangeString(777555);
  const res11 = await decodeFactorioMapExchangeString(str11);
  assert.equal(res11.ok, true, `Factorio 1.1 decode failed: ${res11.error}`);
  assert.equal(res11.sourceVersion, 'Factorio 1.1.110');
  assert.equal(res11.config?.seed, 777555);
  assert.equal(res11.config?.mapType, 'island');
  assert.ok(Math.abs((res11.config?.waterScale ?? 0) - 1.5) < 1e-3);
  assert.ok(Math.abs((res11.config?.waterCoverage ?? 0) - 2.0) < 1e-3);
  assert.ok(Math.abs((res11.config?.moistureBias ?? 0) - -0.25) < 1e-3);
  assert.ok(Math.abs((res11.config?.resources.iron_ore.richness ?? 0) - 3.0) < 1e-3);

  // Numeric seed shorthand
  const numRes = await decodeFactorioMapExchangeString('987654321');
  assert.equal(numRes.ok, true);
  assert.equal(numRes.sourceVersion, 'Numeric Seed');
  assert.equal(numRes.config?.seed, 987654321);

  // Error cases: empty, bad wrapper, invalid Base64, tampered CRC
  assert.equal((await decodeFactorioMapExchangeString('')).ok, false);
  assert.equal((await decodeFactorioMapExchangeString('not-a-map-string')).ok, false);
  assert.equal((await decodeFactorioMapExchangeString('>>>!!!invalid!!!<<<')).ok, false);

  const tamperedBody = encoded.slice(3, -3);
  const mid = Math.floor(tamperedBody.length / 2);
  const flippedChar = tamperedBody[mid] === 'A' ? 'B' : 'A';
  const corrupted = `>>>${tamperedBody.slice(0, mid)}${flippedChar}${tamperedBody.slice(mid + 1)}<<<`;
  const corruptRes = await decodeFactorioMapExchangeString(corrupted);
  assert.equal(corruptRes.ok, false, 'Corrupted exchange string must fail cleanly');
});

test('CapytorioTerrainGen (factorio-mapgen): deterministic Nauvis tiles, Island & Desert presets, trees, water exclusion, and all 6 Factorio resources', () => {
  try {
    assert.equal(CAPYTORIO_MAP_PRESETS.length, 5);

    // 1. Default Nauvis determinism + genuine Factorio tile prototypes + all 6 resources + trees
    resetActiveCapytorioMapGenToDefault();
    const diag = getFactorioMapGenDiagnostics();
    assert.ok(diag.tileCount >= 21, `Expected all 21 Nauvis tile prototypes, got ${diag.tileCount}`);

    const foundResources = new Set<string>();
    const foundTreeStyles = new Set<number>();
    let waterTiles = 0;
    let treeTiles = 0;
    // Scan genuine Nauvis starting + mid-frontier ring (crude-oil & uranium spawn outside starting area ~180..480 tiles)
    for (let gx = -128; gx <= 128; gx += 2) {
      for (let gz = -128; gz <= 128; gz += 2) {
        const t = sampleCapytorioTerrainDetail(gx, gz);
        const r = sampleCapytorioBaseResource(gx, gz);
        if (t.isWater) {
          waterTiles++;
          assert.equal(r, null, `No resource may spawn on water tile (${gx},${gz})`);
          assert.equal(sampleCapytorioTreeAt(gx, gz), false, `No tree on water tile (${gx},${gz})`);
        }
        if (r) foundResources.add(r.resource);
        const td = sampleCapytorioTreeDetail(gx, gz);
        if (td.hasTree) {
          treeTiles++;
          foundTreeStyles.add(td.style);
          assert.ok(td.offsetX >= -0.5 && td.offsetX <= 0.5);
          assert.ok(td.offsetZ >= -0.5 && td.offsetZ <= 0.5);
        }
      }
    }
    // Verify outer frontier spawns genuine crude-oil & uranium-ore (exact Nauvis spot-noise radius)
    for (let gx = -480; gx <= 480 && (foundResources.size < 6); gx += 3) {
      for (let gz = -480; gz <= 480 && (foundResources.size < 6); gz += 3) {
        if (Math.abs(gx) < 280 && Math.abs(gz) < 280) continue;
        const r = sampleCapytorioBaseResource(gx, gz);
        if (r) foundResources.add(r.resource);
      }
    }
    // Crude oil wells are 1x1 tiles, so scan one outer frontier strip at step 1 if stride-3 stepped over them
    if (!foundResources.has('crude_oil')) {
      for (let gx = -480; gx <= 480 && !foundResources.has('crude_oil'); gx++) {
        for (let gz = -480; gz <= 480 && !foundResources.has('crude_oil'); gz++) {
          if (Math.abs(gx) < 260 && Math.abs(gz) < 260) continue;
          const r = sampleCapytorioBaseResource(gx, gz);
          if (r?.resource === 'crude_oil') foundResources.add('crude_oil');
        }
      }
    }
    assert.ok(waterTiles > 100, 'Default Nauvis world includes water basins');
    assert.ok(treeTiles > 200, `Default Nauvis world includes genuine forests, got ${treeTiles}`);
    assert.ok(foundTreeStyles.size >= 2, 'Nauvis generates multiple Factorio tree species styles');
    for (const id of FACTORIO_RESOURCE_IDS) {
      assert.equal(foundResources.has(id), true, `Expected Factorio resource "${id}" to spawn`);
    }

    // 2. Different seed changes terrain deterministically and produces all 4 starter resources
    const revBefore = getCapytorioMapGenRevision();
    const altSeedCfg = createCapytorioMapPreset('default', 99887766);
    setActiveCapytorioMapGen(altSeedCfg);
    assert.equal(getCapytorioMapGenRevision(), revBefore + 1);
    const sampleA = sampleCapytorioTerrainDetail(32, -28).factorioTileName;
    setActiveCapytorioMapGen(altSeedCfg);
    assert.equal(sampleCapytorioTerrainDetail(32, -28).factorioTileName, sampleA);

    const customStarterFound = new Set<string>();
    for (let gx = -128; gx <= 128; gx += 2) {
      for (let gz = -128; gz <= 128; gz += 2) {
        const res = sampleCapytorioBaseResource(gx, gz);
        if (res) customStarterFound.add(res.resource);
      }
    }
    for (const starter of ['iron_ore', 'copper_ore', 'coal', 'stone']) {
      assert.equal(
        customStarterFound.has(starter),
        true,
        `Custom seed must guarantee Nauvis starter patch for ${starter}`
      );
    }

    // 3. Island preset (elevation_island) surrounds dry central continent with deep ocean
    setActiveCapytorioMapGen(createCapytorioMapPreset('island', 54321));
    assert.equal(sampleCapytorioTerrainDetail(0, 0).isWater, false, 'Island center is dry');
    let outerOceanCount = 0;
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const gx = Math.round(Math.cos(rad) * 1280);
      const gz = Math.round(Math.sin(rad) * 1280);
      if (sampleCapytorioTerrainDetail(gx, gz).isWater) outerOceanCount++;
    }
    assert.ok(outerOceanCount >= 22, `Island outer ring should be ocean, got ${outerOceanCount}/24`);

    // 4. Desert Frontier preset shifts Nauvis moisture/aux toward arid terrain
    setActiveCapytorioMapGen(createCapytorioMapPreset('desert_frontier', 54321));
    let aridCount = 0;
    let lushCount = 0;
    for (let gx = -96; gx <= 96; gx += 4) {
      for (let gz = -96; gz <= 96; gz += 4) {
        const t = sampleCapytorioTerrainDetail(gx, gz);
        if (t.type === 'red_desert' || t.type === 'sand' || t.type === 'dirt') aridCount++;
        if (t.type === 'lush_grass') lushCount++;
      }
    }
    assert.ok(aridCount > lushCount * 3, `Desert Frontier should be arid (${aridCount} arid vs ${lushCount} lush)`);

    // 5. Setting resource size=0 disables that resource completely in factorio-mapgen
    const noIron = createCapytorioMapPreset('default', 421337);
    noIron.resources.iron_ore.size = 0;
    setActiveCapytorioMapGen(noIron);
    for (let gx = -128; gx <= 128; gx += 2) {
      for (let gz = -128; gz <= 128; gz += 2) {
        assert.notEqual(
          sampleCapytorioBaseResource(gx, gz)?.resource,
          'iron_ore',
          'size=0 must disable iron_ore in factorio-mapgen'
        );
      }
    }
  } finally {
    resetActiveCapytorioMapGenToDefault();
  }
});

test('CapytorioAdaptiveLod: full unrestricted view distance at healthy FPS, throttles only on sustained FPS drops, and recovers cleanly', () => {
  const lod = createCapytorioAdaptiveLodState();
  // Default: unrestricted max distance (112 tiles at zoomed-out view), full shadows & fruits
  assert.equal(lod.qualityTier, 0);
  assert.equal(lod.viewDistanceScale, 1.0);
  assert.equal(lod.enableTreeFruits, true);
  assert.equal(lod.enableTreeShadows, true);
  assert.equal(computeCapytorioVisibleTileRadius(160, lod), CAPYTORIO_MAX_VIEW_RADIUS_TILES);

  // Healthy 60 FPS for 3 seconds must NEVER reduce quality or view distance
  for (let i = 0; i < 180; i++) {
    stepCapytorioAdaptiveLod(lod, 1 / 60);
  }
  assert.equal(lod.qualityTier, 0, 'Healthy 60 FPS never degrades quality');
  assert.equal(lod.viewDistanceScale, 1.0);

  // Sustained low FPS (20 FPS for 3 seconds) steps down fruits -> shadows -> view distance
  for (let i = 0; i < 65; i++) {
    stepCapytorioAdaptiveLod(lod, 1 / 20);
  }
  assert.ok(lod.qualityTier >= 3, `Sustained 20 FPS degrades to distance throttling (tier ${lod.qualityTier})`);
  assert.equal(lod.enableTreeFruits, false);
  assert.equal(lod.enableTreeShadows, false);
  assert.ok(lod.viewDistanceScale < 1.0);
  assert.ok(computeCapytorioVisibleTileRadius(160, lod) < CAPYTORIO_MAX_VIEW_RADIUS_TILES);

  // Sustained recovery at 60 FPS brings quality & view distance all the way back to full tier 0
  for (let i = 0; i < 600; i++) {
    stepCapytorioAdaptiveLod(lod, 1 / 60);
  }
  assert.equal(lod.qualityTier, 0, 'Sustained 60 FPS recovers full quality tier 0');
  assert.equal(lod.viewDistanceScale, 1.0);
  assert.equal(lod.enableTreeFruits, true);
  assert.equal(lod.enableTreeShadows, true);
});

test('CapytorioFactoryEngine: Pumpjack oil extraction, Uranium & Oil recipes/fuels, v2 mapGen persistence, and legacy v1 save removal', () => {
  try {
    // Use high oil/uranium frequency seed so test locates both wells quickly without scanning 1M tiles
    const testCfg = createCapytorioMapPreset('rich_resources', 421337);
    testCfg.startingArea = 0.25;
    testCfg.resources.crude_oil.frequency = 4;
    testCfg.resources.crude_oil.size = 4;
    testCfg.resources.uranium_ore.frequency = 4;
    testCfg.resources.uranium_ore.size = 4;
    const engine = new CapytorioFactoryEngine();
    engine.applyMapGenConfig(testCfg);

    let oilTile: [number, number] | null = null;
    let uraniumTile: [number, number] | null = null;
    let ironTile: [number, number] | null = null;
    for (let gx = -260; gx <= 260 && (!oilTile || !uraniumTile || !ironTile); gx++) {
      for (let gz = -260; gz <= 260 && (!oilTile || !uraniumTile || !ironTile); gz++) {
        const res = sampleCapytorioBaseResource(gx, gz);
        if (!oilTile && res?.resource === 'crude_oil') oilTile = [gx, gz];
        if (!uraniumTile && res?.resource === 'uranium_ore') uraniumTile = [gx, gz];
        if (!ironTile && res?.resource === 'iron_ore') ironTile = [gx, gz];
      }
    }
    assert.ok(oilTile, 'Found crude_oil well on Nauvis map');
    assert.ok(uraniumTile, 'Found uranium_ore deposit on Nauvis map');
    assert.ok(ironTile, 'Found iron_ore deposit on Nauvis map');

    // Pumpjack cannot be placed on solid iron ore or empty ground
    engine.addPocketItem('pumpjack', 4);
    assert.equal(engine.placeMachine('pumpjack', 0, 0, 0).ok, false, 'Pumpjack rejected on empty ground');
    assert.equal(
      engine.placeMachine('pumpjack', ironTile![0], ironTile![1], 0).ok,
      false,
      'Pumpjack rejected on iron_ore'
    );

    // Standard mining drill cannot be placed on crude_oil
    const [oilX, oilZ] = oilTile!;
    // Find a valid dry 3x3 footprint covering (oilX, oilZ)
    let pumpAnchor: [number, number] | null = null;
    for (let ox = -2; ox <= 0 && !pumpAnchor; ox++) {
      for (let oz = -2; oz <= 0 && !pumpAnchor; oz++) {
        let dry3x3 = true;
        for (let dx = 0; dx < 3 && dry3x3; dx++) {
          for (let dz = 0; dz < 3 && dry3x3; dz++) {
            if (sampleCapytorioTerrainDetail(oilX + ox + dx, oilZ + oz + dz).isWater) dry3x3 = false;
          }
        }
        if (dry3x3) pumpAnchor = [oilX + ox, oilZ + oz];
      }
    }
    assert.ok(pumpAnchor, 'Found dry 3x3 footprint for pumpjack');
    const [px, pz] = pumpAnchor!;

    const drillOnOil = engine.placeMachine('drill', px, pz, 0);
    assert.equal(drillOnOil.ok, false, 'Standard mining drill rejected on crude_oil');
    assert.match(drillOnOil.reason ?? '', /pumpjack/i);

    const pumpRes = engine.placeMachine('pumpjack', px, pz, 0);
    assert.equal(pumpRes.ok, true, `Pumpjack should place on crude_oil: ${pumpRes.reason}`);

    // Power the grid with a generator on a verified dry 2x2 spot and step simulation -> pumpjack outputs crude_oil
    let genX = 0;
    let genZ = 0;
    let foundGenSpot = false;
    for (let gx = -12; gx <= 12 && !foundGenSpot; gx++) {
      for (let gz = -12; gz <= 12 && !foundGenSpot; gz++) {
        let ok3x3 = true;
        for (let dx = 0; dx < 3 && ok3x3; dx++) {
          for (let dz = 0; dz < 3 && ok3x3; dz++) {
            if (
              sampleCapytorioTerrainDetail(gx + dx, gz + dz).isWater ||
              engine.getMachineAt(gx + dx, gz + dz)
            ) {
              ok3x3 = false;
            }
          }
        }
        if (ok3x3) {
          genX = gx;
          genZ = gz;
          foundGenSpot = true;
        }
      }
    }
    assert.equal(foundGenSpot, true, 'Found dry 3x3 spot for generator');
    const genPlace = engine.placeMachine('generator', genX, genZ, 0);
    assert.equal(genPlace.ok, true, `Generator placement failed: ${genPlace.reason}`);
    engine.insertPocketFuelToGenerator(genX, genZ, 4);
    for (let i = 0; i < 120; i++) engine.step(0.05);
    const pumpMachine = engine.getMachineAt(px, pz)!;
    assert.ok((pumpMachine.outputBuffer.crude_oil ?? 0) >= 1, 'Pumpjack extracts crude_oil');

    // Verify full Factorio Oil & Uranium recipes and high-energy fuel burn times
    assert.ok(CAPYTORIO_RECIPES.some((r) => r.id === 'pumpjack'));
    assert.ok(CAPYTORIO_RECIPES.some((r) => r.id === 'centrifuge'));
    assert.ok(CAPYTORIO_RECIPES.some((r) => r.id === 'solid_fuel_from_crude_oil'));
    assert.ok(CAPYTORIO_RECIPES.some((r) => r.id === 'uranium_processing'));
    assert.ok(CAPYTORIO_RECIPES.some((r) => r.id === 'uranium_fuel_cell'));
    assert.ok(CAPYTORIO_FUEL_BURN_SECONDS.solid_fuel > CAPYTORIO_FUEL_BURN_SECONDS.coal);
    assert.ok(CAPYTORIO_FUEL_BURN_SECONDS.uranium_fuel_cell > CAPYTORIO_FUEL_BURN_SECONDS.solid_fuel);

    // Generator burns uranium_fuel_cell for extended duration
    engine.addPocketItem('uranium_fuel_cell', 2);
    const gen = engine.getMachineAt(genX, genZ)!;
    gen.fuelTimer = 0;
    gen.inputBuffer = { uranium_fuel_cell: 1 };
    engine.step(0.1);
    assert.ok(gen.fuelTimer > 40, `Expected extended uranium fuel cell burn timer, got ${gen.fuelTimer}`);

    // Legacy v1 saves are cleanly dropped (no legacy migration)
    const legacyV1 = {
      version: 1,
      score: 500,
      machines: [{ id: 1, type: 'belt', gx: 0, gz: 0, dir: 1 }],
    };
    assert.equal(sanitizeCapytorioStateShallow(legacyV1), undefined, 'Shallow guard drops v1 saves');
    assert.equal(sanitizeCapytorioState(legacyV1), undefined, 'Full serializer drops v1 saves');

    // v2 save persists mapGen and restores it cleanly on hydration + updates 3D renderer immediately
    const customMap: CapytorioMapGenConfig = createCapytorioMapPreset('rail_world', 654321);
    const rev0 = getCapytorioMapGenRevision();
    engine.applyMapGenConfig(customMap, true);
    assert.equal(engine.machines.size, 0, 'applyMapGenConfig(..., true) starts a fresh factory');
    assert.equal(engine.getMapGenConfig().seed, 654321);
    assert.equal(engine.getMapGenConfig().preset, 'rail_world');
    assert.ok(getCapytorioMapGenRevision() > rev0);

    const savedV2 = engine.serialize();
    assert.equal(savedV2.version, 2);
    assert.equal(savedV2.mapGen.seed, 654321);
    assert.equal(savedV2.mapGen.preset, 'rail_world');
    assert.ok(sanitizeCapytorioStateShallow(savedV2), 'Shallow guard accepts v2 saves');

    // Hydrating into a fresh engine restores mapGen and updates active kernel
    resetActiveCapytorioMapGenToDefault();
    assert.equal(getActiveCapytorioMapGen().seed, DEFAULT_CAPYTORIO_MAP_GEN_CONFIG.seed);
    const restoredEngine = new CapytorioFactoryEngine(savedV2);
    assert.equal(restoredEngine.getMapGenConfig().seed, 654321);
    assert.equal(getActiveCapytorioMapGen().seed, 654321);

    // 3D Renderer immediately rebuilds terrain deck when mapGen changes
    const renderer = new Capytorio3DRenderer();
    try {
      renderer.sync(restoredEngine, 0, 0, 0.016, 1.0, true, 32);
      restoredEngine.applyMapGenConfig(createCapytorioMapPreset('desert_frontier', 112233), true);
      renderer.sync(restoredEngine, 0, 0, 0.016, 1.1, true, 32);
      assert.equal(
        sanitizeCapytorioMapGenConfig(restoredEngine.getUiSnapshot().mapGen).preset,
        'desert_frontier'
      );
    } finally {
      renderer.dispose();
    }
  } finally {
    resetActiveCapytorioMapGenToDefault();
  }
});

test('CapytorioOrbitalLodMath: continuous coverage 10 m - 234 km, cloud lens-fade, Rayleigh haze & proxy palette', () => {
  const lod = createCapytorioAltitudeLodState();

  // Ground tier (26 m)
  evaluateCapytorioAltitudeLod(26, lod);
  assert.equal(lod.groundDeckAlpha, 1);
  assert.equal(lod.waterDeckAlpha, 1);
  assert.equal(lod.useDetailedMachines, true);
  assert.equal(lod.useProxyMachines, false);
  assert.equal(lod.useDetailedBelts, true);
  assert.equal(lod.useProxyBelts, false);
  assert.equal(lod.showDetailedTrees, true);
  assert.equal(lod.showOreCrystals, true);
  assert.equal(lod.clipmapOpacity, 1);
  assert.equal(lod.cloudLayer1Opacity, 0);
  assert.equal(lod.planetGlobeActive, false);

  // Critical mid-zoom crossfade band (185 m..340 m): waterDeck must ALREADY be completely hidden
  // before groundDeck disables depthWrite so tucked dry-land water vertices never paint the ground blue
  for (const crossAlt of [185, 220, 260, 300, 335]) {
    evaluateCapytorioAltitudeLod(crossAlt, lod);
    assert.equal(
      lod.waterDeckAlpha,
      0,
      `waterDeckAlpha must be 0 at ${crossAlt} m while groundDeck crossfades (groundDeckAlpha=${lod.groundDeckAlpha})`
    );
  }

  // Regional tier (600 m): groundDeck handed off to Ring 0..2, simplified 3D proxies active
  evaluateCapytorioAltitudeLod(600, lod);
  assert.equal(lod.groundDeckAlpha, 0);
  assert.equal(lod.waterDeckAlpha, 0);
  assert.equal(lod.useDetailedMachines, false);
  assert.equal(lod.useProxyMachines, true);
  assert.equal(lod.useDetailedBelts, false);
  assert.equal(lod.useProxyBelts, true);
  assert.equal(lod.showDetailedTrees, false);
  assert.equal(lod.showCanopyOnlyTrees, true);
  assert.equal(lod.clipmapOpacity, 1);
  assert.ok(lod.hazeStrength > 0.005 && lod.hazeStrength < 0.25);
  assert.equal(lod.planetGlobeActive, false);

  // Cloud deck lens proximity dip right at lower cloud altitude vs above it
  const atCloud = evaluateCapytorioAltitudeLod(CAPYTORIO_CLOUD_LOWER_Y / 0.96, createCapytorioAltitudeLodState());
  const aboveCloud = evaluateCapytorioAltitudeLod(2_200, createCapytorioAltitudeLodState());
  assert.ok(
    atCloud.cloudLayer1Opacity < aboveCloud.cloudLayer1Opacity,
    `Lower cloud stratum must fade near camera lens (${atCloud.cloudLayer1Opacity} < ${aboveCloud.cloudLayer1Opacity})`
  );
  assert.ok(aboveCloud.cloudLayer1Opacity > 0.4, 'Patchy lower clouds visible above cloud deck');

  const atUpperCloud = evaluateCapytorioAltitudeLod(CAPYTORIO_CLOUD_UPPER_Y / 0.96, createCapytorioAltitudeLodState());
  const aboveUpperCloud = evaluateCapytorioAltitudeLod(8_000, createCapytorioAltitudeLodState());
  assert.ok(
    atUpperCloud.cloudLayer2Opacity < aboveUpperCloud.cloudLayer2Opacity,
    'Upper cloud stratum must fade softly near camera lens'
  );
  assert.ok(aboveUpperCloud.cloudLayer2Opacity > 0.3, 'Upper wispy clouds visible from stratosphere');

  // High orbit (35 km -> 220 km): planet globe activates above 16 km while clipmap dissolves smoothly
  evaluateCapytorioAltitudeLod(CAPYTORIO_PLANET_GLOBE_ACTIVATE_M + 2_000, lod);
  assert.equal(lod.planetGlobeActive, true);
  assert.ok(lod.clipmapOpacity > 0.85, 'Clipmap remains crisp past 18 km before orbital dissolve');
  assert.ok(lod.hazeStrength > 0.15 && lod.hazeStrength <= 0.36, 'Soft Rayleigh haze never obscures terrain completely');

  // Continuous non-zero clipmap ring coverage at every sampled altitude from 12 m to 200 km
  const testAltitudes = [12, 48, 180, 420, 1_200, 3_500, 12_000, 35_000, 90_000, 180_000];
  for (const alt of testAltitudes) {
    evaluateCapytorioAltitudeLod(alt, lod);
    let maxRingAlpha = 0;
    for (const ring of CAPYTORIO_CLIPMAP_RINGS) {
      maxRingAlpha = Math.max(maxRingAlpha, evaluateClipmapRingAlpha(ring, alt, lod.clipmapOpacity));
    }
    assert.ok(
      maxRingAlpha > 0.05,
      `Expected active clipmap ring coverage at altitude ${alt} m, got ${maxRingAlpha}`
    );
  }

  // Machine proxy palette & heights
  assert.notEqual(getCapytorioMachineProxyColorHex('assembler'), getCapytorioMachineProxyColorHex('furnace'));
  assert.notEqual(
    getCapytorioMachineProxyColorHex('belt', 'fast_transport_belt'),
    getCapytorioMachineProxyColorHex('belt')
  );
  assert.ok(getCapytorioMachineProxyHeight('assembler') > getCapytorioMachineProxyHeight('belt'));
});

test('Multi-scale clipmap chunk baking (scales 1..256) and live factory pixel stamping in Capytorio3DRenderer', () => {
  resetActiveCapytorioMapGenToDefault();
  try {
    // Verify genuine factorio-mapgen chunk baking across all 5 clipmap scales
    for (const scale of [1, 4, 16, 64, 256]) {
      const chunk = getOrBakeCapytorioClipmapChunkRGBA(scale, 0, 0);
      assert.equal(chunk.length, 32 * 32 * 4, `Scale ${scale} must produce 32x32 RGBA chunk`);
      const uniqueColors = new Set<number>();
      for (let i = 0; i < chunk.length; i += 4) {
        assert.equal(chunk[i + 3], 255);
        uniqueColors.add((chunk[i] << 16) | (chunk[i + 1] << 8) | chunk[i + 2]);
      }
      assert.ok(
        uniqueColors.size >= 4,
        `Scale ${scale} chunk should contain rich multi-tone Nauvis terrain/forest/ore variation (got ${uniqueColors.size})`
      );
    }

    // Verify Capytorio3DRenderer stamps live built machines into Ring 0..4 and swaps cleanly to 3D proxies
    const engine = new CapytorioFactoryEngine();
    const renderer = new Capytorio3DRenderer();
    try {
      // Find buildable dry tile near origin and place an assembler + belt
      let placeX = 0;
      let placeZ = 0;
      outer: for (let r = 2; r <= 24; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            let ok = true;
            for (let ox = 0; ox < 3 && ok; ox++) {
              for (let oz = 0; oz < 3 && ok; oz++) {
                if (sampleCapytorioTerrainDetail(dx + ox, dz + oz).isWater) ok = false;
              }
            }
            if (ok) {
              placeX = dx;
              placeZ = dz;
              break outer;
            }
          }
        }
      }

      engine.addPocketItem('assembling_machine_1', 2);
      engine.addPocketItem('transport_belt', 4);
      const placed = engine.placeMachine('assembler', placeX, placeZ, 0);
      assert.ok(placed, 'Assembler should place cleanly on dry Nauvis land');

      const camX = 1200 + placeX * 2.5;
      const camZ = placeZ * 2.5;

      // Sync at regional altitude (520 m): simplified 3D proxy active & Ring 0..2 visible
      renderer.sync(engine, camX, camZ, 0.016, 1.0, true, 520);
      renderer.planetarySurfaceLayer.flushVisibleRings(engine);

      const ring0 = renderer.planetarySurfaceLayer.getRingDebugInfo(0);
      assert.ok(ring0 && ring0.visible, 'Ring 0 should be active at 520 m');
      const px = placeX - ring0.originTileX;
      const py = placeZ - ring0.originTileZ;
      assert.ok(px >= 0 && px < 256 && py >= 0 && py < 256, 'Placed machine inside Ring 0 bounds');
      const pOff = (py * 256 + px) * 4;
      // Assembler proxy color is bright blue (0x3b82f6 -> B > R)
      assert.ok(
        ring0.displayPixels[pOff + 2] > ring0.displayPixels[pOff] + 40,
        `Expected stamped blue assembler pixel at (${px},${py}), got rgb(${ring0.displayPixels[pOff]},${ring0.displayPixels[pOff + 1]},${ring0.displayPixels[pOff + 2]})`
      );

      // Sync at high orbit (42 km): Ring 3 & Ring 4 active with live factory still stamped
      renderer.sync(engine, camX, camZ, 0.016, 2.0, true, 42_000);
      renderer.planetarySurfaceLayer.flushVisibleRings(engine);
      const ring4 = renderer.planetarySurfaceLayer.getRingDebugInfo(4);
      assert.ok(ring4 && ring4.visible, 'Ring 4 (163.84 km continent clipmap) should be active at 42 km');
      const px4 = Math.floor((placeX - ring4.originTileX) / ring4.scale);
      const py4 = Math.floor((placeZ - ring4.originTileZ) / ring4.scale);
      assert.ok(px4 >= 0 && px4 < 256 && py4 >= 0 && py4 < 256);
      const pOff4 = (py4 * 256 + px4) * 4;
      assert.ok(
        ring4.displayPixels[pOff4 + 2] > ring4.displayPixels[pOff4] + 30,
        'Live factory pixel remains unmistakably stamped even on 163.84 km orbital Ring 4'
      );
    } finally {
      renderer.dispose();
    }
  } finally {
    resetActiveCapytorioMapGenToDefault();
  }
});
