import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Capytorio3DRenderer, populateCapytorioAltBadgeSpec } from './CapytorioMeshBuilder';
import type { CapytorioAltBadgeSpec } from './CapytorioAltIconRenderer';
import { resolveCapytorioClipboardPointerAction } from './capytorio/CapytorioStateGuard';
import {
  computeCapytorioAmbientMix,
  selectCapytorioPlacementProfile,
} from '../services/AudioService';
import {
  BELT_CURVE_INNER_ARC_M,
  BELT_CURVE_OUTER_ARC_M,
  CAPYTORIO_BELT_ITEMS_PER_LANE,
  CAPYTORIO_BELT_ITEM_SPACING_M,
  CAPYTORIO_BELT_MAX_ITEMS_PER_TILE,
  CapytorioFactoryEngine,
  MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
  MAX_RECENT_CAPYTORIO_TOOLS,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
  evalBeltItemLocalPose,
  getBeltCurveShape,
  getBeltLaneArcMeters,
  getBeltLaneCapacity,
  isCapytorioWaterTerrain,
  resolveCapytorioPlaceableSpec,
  sampleCapytorioBaseResource,
  sampleCapytorioTerrain,
  sampleCapytorioTerrainDetail,
  sampleCapytorioTreeAt,
  sanitizeCapytorioState,
  tileKey,
  worldToCapytorioGridX,
  worldToCapytorioGridZ,
} from './CapytorioFactoryEngine';
import {
  createSampleStarterMallBlueprint,
  decodeFactorioBlueprintString,
  encodeFactorioBlueprintBookString,
  encodeFactorioBlueprintString,
  getSampleStarterMallAbsoluteEntries,
} from './FactorioBlueprintCodec';
import {
  CAPYTORIO_BEACON_SPEC,
  CAPYTORIO_FUEL_BURN_SECONDS,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_ITEM_SHAPES,
  CAPYTORIO_MODULE_EFFECTS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  RECIPE_BY_ID,
  TECH_BY_ID,
  applyCapytorioLuaSources,
  getCapytorioFootprint,
  getCapytorioItemMeta,
  getCapytorioSmeltSpec,
} from './CapytorioData';
import { DEDICATED_CAPYTORIO_VARIANT_MODELS } from './capytorio/CapytorioVariantModels';
import { parseCapytorioLuaCatalog } from './CapytorioLuaParser';
import {
  buildCapytorioPediaCatalog,
  getCapytorioPediaEntry,
  resolvePediaIdFromTileInspection,
} from './CapytorioPedia';

test('Capytorio loads canonical recipe.lua and technology.lua directly with zero duplication', () => {
  assert.ok(CAPYTORIO_RECIPES.length >= 75, `expected >= 75 Factorio recipes, got ${CAPYTORIO_RECIPES.length}`);
  assert.ok(CAPYTORIO_TECHS.length >= 25, `expected >= 25 Factorio technologies, got ${CAPYTORIO_TECHS.length}`);
  assert.ok(Object.keys(CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE).length >= 40);
  assert.equal(RECIPE_BY_ID.get('smelt_iron')?.station, 'furnace');
  assert.equal(RECIPE_BY_ID.get('metallurgic_science')?.requiredTechId, 'automation_1');
  assert.equal(RECIPE_BY_ID.get('metallurgic_science')?.unlockedByDefault, false);
  assert.equal(RECIPE_BY_ID.get('rocket_part')?.requiredTechId, 'electromagnetics_stack');
  assert.equal(TECH_BY_ID.get('rocket_silo_prod')?.repeatable, true);
  assert.equal(getCapytorioSmeltSpec('iron_ore')?.result, 'iron_plate');
});

test('Capytorio Lua parser supports Factorio 1.1 & 2.0 data:extend mods and procedural items', () => {
  const customRecipeLua = `
    --[[ External mod recipe overrides ]]
    local speed_mult = 2.0
    data:extend({
      {
        type = "recipe",
        name = "smelt_titanium",
        category = "smelting",
        energy_required = 1.5,
        ingredients = { {"yuzu_sap", 1} },
        result = "titanium-plate",
        result_count = 2
      },
      {
        type = "recipe",
        name = "quantum-science",
        category = "crafting",
        enabled = false,
        energy_required = speed_mult,
        ingredients = {
          { type = "item", name = "titanium-plate", amount = 1 },
          { type = "item", name = "iron-plate", amount = 1 }
        },
        results = {
          { type = "item", name = "quantum-science-pack", amount = 1 }
        }
      }
    })
  `;
  const customTechLua = `
    data:extend({
      {
        type = "technology",
        name = "quantum-age",
        capytorio_label = "Quantum Capy Age",
        prerequisites = {},
        effects = {
          { type = "unlock-recipe", recipe = "quantum-science" }
        },
        unit = {
          count = 2,
          ingredients = { { "quantum-science-pack", 1 } },
          time = 10
        }
      }
    })
  `;

  const parsed = parseCapytorioLuaCatalog(customRecipeLua, customTechLua);
  assert.equal(parsed.recipes.length, 2);
  assert.equal(parsed.techs.length, 1);
  assert.equal(parsed.recipes[0].result, 'titanium_plate');
  assert.equal(parsed.recipes[0].resultCount, 2);
  assert.equal(parsed.recipes[1].requiredTechId, 'quantum_age');
  assert.equal(parsed.items.quantum_science_pack.category, 'science');
  assert.deepEqual(parsed.techs[0].cost, { quantum_science_pack: 2 });

  // Live apply + test engine smelting with custom recipe.lua + restore canonical files
  const recipePath = path.resolve(process.cwd(), 'public/data/capytorio/recipe.lua');
  const techPath = path.resolve(process.cwd(), 'public/data/capytorio/technology.lua');
  const origRec = fs.readFileSync(recipePath, 'utf8');
  const origTech = fs.readFileSync(techPath, 'utf8');

  try {
    applyCapytorioLuaSources(customRecipeLua, customTechLua, 'custom_override');
    const engine = new CapytorioFactoryEngine();
    assert.equal(getCapytorioItemMeta('titanium_plate').category, 'plate');
    assert.equal(getCapytorioSmeltSpec('yuzu_sap')?.result, 'titanium_plate');

    assert.equal(engine.placeMachine('furnace', 0, 0, 1).ok, true);
    engine.machines.get(tileKey(0, 0))!.inputBuffer.yuzu_sap = 1;
    for (let i = 0; i < 120; i++) engine.step(0.05);
    assert.equal(engine.machines.get(tileKey(0, 0))!.outputBuffer.titanium_plate, 2);
  } finally {
    applyCapytorioLuaSources(origRec, origTech, 'bundled');
  }
});

test('Capytorio spawns as a blank starter ore field with generous starter kit', () => {
  const engine = new CapytorioFactoryEngine();
  assert.equal(engine.machines.size, 0, 'arrives on an empty field to build from scratch');
  assert.equal(engine.getPocketMachineCount('drill'), 4);
  assert.equal(engine.getPocketMachineCount('belt'), 24);
  assert.equal(engine.getPocketMachineCount('inserter'), 8);
  assert.equal(engine.getPocketMachineCount('furnace'), 4);
  assert.equal(engine.getPocketMachineCount('assembler'), 2);
  assert.equal(engine.getPocketMachineCount('generator'), 2);
  assert.equal(engine.getPocketMachineCount('lab'), 1);
  assert.equal(engine.getPocketItemCount('iron_plate'), 24);
  assert.equal(engine.getPocketItemCount('coal'), 16);

  // Center landing tile is clean build ground; genuine factorio-mapgen Nauvis spawns all 4 starter resources around origin
  assert.equal(sampleCapytorioBaseResource(0, 0), null);
  const starterFound = new Set<string>();
  for (let gx = -128; gx <= 128; gx += 2) {
    for (let gz = -128; gz <= 128; gz += 2) {
      const res = sampleCapytorioBaseResource(gx, gz);
      if (res) starterFound.add(res.resource);
    }
  }
  for (const r of ['iron_ore', 'copper_ore', 'coal', 'stone']) {
    assert.equal(starterFound.has(r), true, `Nauvis starting area must include ${r}`);
  }
});

test('Capytorio provides infinite unbounded procedural ore chunks far from origin', () => {
  let foundFarChunkOre = false;
  for (let gx = 160; gx <= 480; gx += 2) {
    for (let gz = -240; gz <= 240; gz += 2) {
      const sample = sampleCapytorioBaseResource(gx, gz);
      if (sample) {
        foundFarChunkOre = true;
        assert.ok(sample.initialAmount >= 1);
        break;
      }
    }
    if (foundFarChunkOre) break;
  }
  assert.equal(foundFarChunkOre, true, 'far away Nauvis chunks should contain procedural ore seams');

  const engine = new CapytorioFactoryEngine();
  // Locate a dry land tile far across the far hemisphere (avoiding procedural oceans/lakes/rivers)
  let farDryGx = 250;
  let farDryGz = -180;
  let foundFarDry = false;
  for (let gx = 240; gx <= 290 && !foundFarDry; gx++) {
    for (let gz = -200; gz <= -150 && !foundFarDry; gz++) {
      if (!isCapytorioWaterTerrain(sampleCapytorioTerrain(gx, gz))) {
        farDryGx = gx;
        farDryGz = gz;
        foundFarDry = true;
      }
    }
  }
  assert.equal(foundFarDry, true, 'far hemisphere should contain buildable dry continents');
  // Verify machines can be placed arbitrarily far across the far hemisphere without clamping
  const beltFar = engine.placeMachine('belt', farDryGx, farDryGz, 1);
  assert.equal(beltFar.ok, true);
  assert.equal(worldToCapytorioGridX(capytorioGridToWorldX(250)), 250);
  assert.equal(worldToCapytorioGridZ(capytorioGridToWorldZ(-180)), -180);
  assert.equal(capytorioGridToWorldX(0), CAPYTORIO_WORLD_ORIGIN_X);
  assert.equal(capytorioGridToWorldZ(0), CAPYTORIO_WORLD_ORIGIN_Z);
});

test('Capytorio hand-mining, full Drill -> Belt -> Furnace -> Chest automation, and 100% demolish refund', () => {
  const engine = new CapytorioFactoryEngine();
  // Locate an authentic factorio-mapgen starter iron_ore tile with dry buildable space to the East
  let oreGx = 0;
  let oreGz = 0;
  let foundIron = false;
  for (let gx = -48; gx <= 48 && !foundIron; gx++) {
    for (let gz = -48; gz <= 48 && !foundIron; gz++) {
      if (engine.getResourceAt(gx, gz)?.resource !== 'iron_ore') continue;
      let clearEast = true;
      for (let ex = gx - 1; ex <= gx + 7 && clearEast; ex++) {
        for (let ez = gz - 3; ez <= gz + 2 && clearEast; ez++) {
          if (isCapytorioWaterTerrain(sampleCapytorioTerrain(ex, ez))) clearEast = false;
        }
      }
      if (clearEast) {
        oreGx = gx;
        oreGz = gz;
        foundIron = true;
      }
    }
  }
  assert.equal(foundIron, true, 'Found starter iron_ore tile on Nauvis');
  assert.equal(engine.getResourceAt(oreGx, oreGz)?.resource, 'iron_ore');

  const mined = engine.handMineAt(oreGx, oreGz, 3);
  assert.equal(mined, 'iron_ore');
  assert.equal(engine.getPocketItemCount('iron_ore'), 3);

  // Drill on non-ore tile fails gracefully with helpful message
  const badDrill = engine.placeMachine('drill', 0, 0, 1);
  assert.equal(badDrill.ok, false);

  // Build 3x3 Drill centered on (oreGx, oreGz) facing East (+X) -> ejects at (dGx+3, dGz+1)
  // -> Belt -> Belt -> 2x2 Furnace -> Chest
  const dGx = oreGx - 1;
  const dGz = oreGz - 1;
  const belt1Gx = dGx + 3;
  const belt1Gz = dGz + 1;
  const chestGx = dGx + 7;
  const chestGz = dGz + 1;
  assert.equal(engine.placeMachine('drill', dGx, dGz, 1).ok, true);
  assert.equal(engine.placeMachine('belt', belt1Gx, belt1Gz, 1).ok, true);
  assert.equal(engine.placeMachine('belt', dGx + 4, dGz + 1, 1).ok, true);
  assert.equal(engine.placeMachine('furnace', dGx + 5, dGz + 1, 1).ok, true);
  assert.equal(engine.placeMachine('chest', chestGx, chestGz, 1).ok, true);
  assert.equal(engine.placeMachine('generator', dGx + 5, dGz - 2, 1).ok, true);

  // Clicking an existing belt rotates it instead of erroring
  const rotateRes = engine.placeMachine('belt', belt1Gx, belt1Gz, 1);
  assert.equal(rotateRes.ok, true);
  assert.equal(rotateRes.machine?.dir, 2);
  // Rotate 3 more times back to East (1)
  engine.rotateMachineAt(belt1Gx, belt1Gz);
  engine.rotateMachineAt(belt1Gx, belt1Gz);
  engine.rotateMachineAt(belt1Gx, belt1Gz);
  assert.equal(engine.machines.get(tileKey(belt1Gx, belt1Gz))?.dir, 1);

  // Simulate 16 seconds of factory execution
  for (let i = 0; i < 320; i++) {
    engine.step(0.05);
  }

  const chest = engine.machines.get(tileKey(chestGx, chestGz));
  assert.ok(chest, 'chest exists');
  assert.ok((chest.outputBuffer.iron_plate ?? 0) >= 1, 'smelted iron plates arrived in chest');
  assert.ok(engine.getTotalProduced() >= 2);
  assert.ok(engine.getScore() > 50);

  // Auto-collect nearby chest empties plates into pocket
  const collected = engine.collectFromNearbyChestsAndOutputs(
    chestGx * CAPYTORIO_TILE_SIZE,
    chestGz * CAPYTORIO_TILE_SIZE
  );
  assert.ok(collected >= 1);
  assert.ok(engine.getPocketItemCount('iron_plate') > 24);

  // Demolish returns the furnace to pocket cleanly (works from any sub-tile!)
  const prevFurnaces = engine.getPocketMachineCount('furnace');
  assert.equal(engine.demolishAt(dGx + 6, dGz + 2), 'furnace');
  assert.equal(engine.getPocketMachineCount('furnace'), prevFurnaces + 1);
});

test('Capytorio Splitters, Underground Tunnels, Smart Inserters, Labs & Tech Unlock', () => {
  const engine = new CapytorioFactoryEngine();
  const completedTechs: string[] = [];

  // Test 2x1 (1x2 East-facing) Splitter dual-lane round-robin & Tunnel jump across 3 tiles
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', 4, 0, 1).ok, true);
  assert.equal(engine.placeMachine('splitter', 5, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 6, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 6, 1, 1).ok, true);

  // Seed 6 copper ores onto belt (0,0) and step
  for (let n = 0; n < 6; n++) {
    const startBelt = engine.machines.get(tileKey(0, 0))!;
    startBelt.beltItems.push({ item: 'copper_ore', progress: 0.99 });
    for (let s = 0; s < 30; s++) {
      engine.step(0.05);
    }
  }
  const cLeft = engine.machines.get(tileKey(6, 0))!.outputBuffer.copper_ore ?? 0;
  const cRight = engine.machines.get(tileKey(6, 1))!.outputBuffer.copper_ore ?? 0;
  assert.equal(cLeft + cRight, 6, 'all items jumped tunnel and split evenly across 2x1 outputs');
  assert.equal(cLeft, 3, 'left output lane gets 3 items');
  assert.equal(cRight, 3, 'right output lane gets 3 items');

  // Power with 3x3 Generator + Coal so 3x3 Assembler + Inserter + 3x3 Lab run at full efficiency
  assert.equal(engine.placeMachine('generator', -7, 3, 1).ok, true);
  engine.machines.get(tileKey(-7, 3))!.inputBuffer.coal = 4;

  // Test 3x3 Assembler (-3,3.. -1,5) -> Inserter (0,4) -> 3x3 Lab (1,3.. 3,5) -> Automation I completion
  assert.equal(engine.placeMachine('assembler', -3, 3, 1, 'automation_science').ok, true);
  const asm = engine.machines.get(tileKey(-3, 3))!;
  asm.inputBuffer.copper_plate = 8;
  asm.inputBuffer.iron_gear = 8;

  // Inserter picking from Assembler sub-tile (-1,4) into Lab sub-tile (1,4)
  assert.equal(engine.placeMachine('inserter', 0, 4, 1).ok, true);
  assert.equal(engine.placeMachine('lab', 1, 3, 1).ok, true);

  const callbacks = {
    onTechCompleted: (techId: string) => {
      completedTechs.push(techId);
    },
  };

  for (let s = 0; s < 500; s++) {
    engine.step(0.05, callbacks);
  }

  assert.ok(engine.powerSupplyMw >= 6.0, 'coal generator boosts supply to 6 MW');
  assert.equal(completedTechs.includes('automation_1'), true);
  assert.equal(engine.isRecipeUnlocked('metallurgic_science'), true);

  // Serialization & Hydration round trip
  const json = JSON.parse(JSON.stringify(engine.serialize()));
  const sanitized = sanitizeCapytorioState(json);
  assert.ok(sanitized);
  const restored = new CapytorioFactoryEngine(sanitized);
  assert.equal(restored.machines.size, engine.machines.size);
  assert.equal(restored.isRecipeUnlocked('metallurgic_science'), true);
});

test('Capytorio belt momentum pushes hero vector without allocation', () => {
  const engine = new CapytorioFactoryEngine();
  engine.placeMachine('belt', 2, -1, 0); // North (-Z)
  const out: [number, number] = [0, 0];
  const onBelt = engine.getBeltMomentumAtLocalPos(2 * CAPYTORIO_TILE_SIZE, -1 * CAPYTORIO_TILE_SIZE, out);
  assert.equal(onBelt, true);
  assert.equal(out[0], 0);
  assert.ok(out[1] < -1.0, 'North belt pushes in -Z direction');
});

test('Capytorio drag belt-painting aligns corners, pipette samples recipes, manual fuel boosts generator 6MW & rocket launches', () => {
  const engine = new CapytorioFactoryEngine();

  // 1. Drag-place L-shaped belt line: (0,0) -> (1,0) -> (2,0) -> (2,1)
  const d0 = engine.placeMachineDuringDrag('belt', 0, 0, null, null, false);
  assert.equal(d0.ok, true);
  const d1 = engine.placeMachineDuringDrag('belt', 1, 0, 0, 0, true);
  assert.equal(d1.ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.dir, 1, 'origin belt turns East toward (1,0)');
  assert.equal(engine.machines.get(tileKey(1, 0))?.dir, 1, 'second belt faces East');
  // Attempting drag onto occupied tile skips cleanly without rotating existing belt
  const dup = engine.placeMachineDuringDrag('belt', 1, 0, 0, 0, false);
  assert.equal(dup.ok, false);
  assert.equal(engine.machines.get(tileKey(1, 0))?.dir, 1, 'occupied belt dir stays intact');
  // Turn South from (2,0) -> (2,1)
  const d2 = engine.placeMachineDuringDrag('belt', 2, 0, 1, 0, true);
  assert.equal(d2.ok, true);
  const d3 = engine.placeMachineDuringDrag('belt', 2, 1, 2, 0, true);
  assert.equal(d3.ok, true);
  assert.equal(engine.machines.get(tileKey(2, 0))?.dir, 2, 'corner tile automatically points South');
  assert.equal(engine.machines.get(tileKey(2, 1))?.dir, 2, 'end tile faces South');

  // 2. Place Generator & manual Coal feeding immediately ignites -> 6.0 MW
  assert.equal(engine.placeMachine('generator', 4, 0, 1).ok, true);
  assert.equal(engine.powerSupplyMw, 1.5);
  const coalLoaded = engine.insertPocketFuelToGenerator(4, 0, 5);
  assert.equal(coalLoaded, 5);
  assert.equal(engine.powerSupplyMw, 6.0);
  assert.ok((engine.machines.get(tileKey(4, 0))?.fuelTimer ?? 0) > 0);

  // 3. Place 3x3 Assembler at (8, 0) with 'copper_cable', test Smart Pipette [Q], manual Load Inputs [F], & Take Outputs
  assert.equal(engine.placeMachine('assembler', 8, 0, 2, 'copper_cable').ok, true);
  engine.selectedTool = 'mine';
  const pick = engine.pipetteAt(9, 1); // Sub-tile inside 3x3 assembler!
  assert.equal(pick.picked, true);
  assert.equal(pick.tool, 'assembler');
  assert.equal(engine.selectedRecipeId, 'copper_cable');

  const emptyPick = engine.pipetteAt(99, 99);
  assert.equal(emptyPick.picked, false);
  assert.equal(engine.selectedTool, 'mine');

  const movedIn = engine.insertPocketInputsForMachine(8, 0, 2);
  assert.equal(movedIn, 2);
  for (let i = 0; i < 60; i++) engine.step(0.05);
  const takenOut = engine.takeMachineOutputsToPocket(8, 0);
  assert.ok(takenOut >= 2);
  assert.ok(engine.getPocketItemCount('copper_cable') >= 2);

  // 4. Milestones progress automatically & Manual Rocket Launch grants +15% productivity
  const milestones = engine.evaluateMilestones();
  const beltMs = milestones.find((ms) => ms.id === 'lay_belts');
  assert.equal(beltMs?.completed, true);

  engine.addPocketItem('rocket_part', 1);
  const launchRes = engine.launchRocketManual();
  assert.equal(launchRes.ok, true);
  assert.equal(launchRes.rocketLaunches, 1);
  assert.equal(engine.getPocketItemCount('rocket_part'), 0);
  assert.ok(engine.getProductivityBonusFraction() >= 0.15);

  const rehydrated = new CapytorioFactoryEngine(engine.serialize());
  assert.equal(rehydrated.getRocketLaunches(), 1);
  assert.equal(
    rehydrated.evaluateMilestones().find((ms) => ms.id === 'launch_rocket')?.completed,
    true
  );
});

test('Capytorio citrus trees yield Fresh Oranges, fuel generators, and milestone/tech callbacks grant zero CapyCoins', () => {
  const engine = new CapytorioFactoryEngine();

  // Locate a deterministic factorio-mapgen tree around the Nauvis starting area
  let treeGx = 0;
  let treeGz = 0;
  let found = false;
  for (let gx = -80; gx <= 80 && !found; gx++) {
    for (let gz = -80; gz <= 80 && !found; gz++) {
      if (sampleCapytorioTreeAt(gx, gz)) {
        treeGx = gx;
        treeGz = gz;
        found = true;
      }
    }
  }
  assert.equal(found, true, 'expected deterministic Nauvis trees');
  assert.equal(engine.hasTreeAt(treeGx, treeGz), true);
  assert.equal(engine.getPocketItemCount('orange'), 0);

  // Hand-mining tree awards +3 Fresh Oranges and removes tree
  const mined = engine.handMineAt(treeGx, treeGz, 2);
  assert.equal(mined, 'orange');
  assert.equal(engine.getPocketItemCount('orange'), 3);
  assert.equal(engine.hasTreeAt(treeGx, treeGz), false);

  // Fuel generator cleanly including oranges after starter coal
  assert.equal(engine.placeMachine('generator', 0, 0, 1).ok, true);
  const loadedFuel = engine.insertPocketFuelToGenerator(0, 0, 20);
  assert.ok(loadedFuel >= 17, `expected coal + oranges loaded into generator, got ${loadedFuel}`);
  assert.equal(engine.getPocketItemCount('orange'), 0);

  // Place a drill on a real starter iron tile & test tree auto-harvest on building placement
  let drillPlaced = false;
  for (let gx = -48; gx <= 48 && !drillPlaced; gx++) {
    for (let gz = -48; gz <= 48 && !drillPlaced; gz++) {
      if (engine.getResourceAt(gx, gz)?.resource === 'iron_ore') {
        if (engine.placeMachine('drill', gx, gz, 1).ok) drillPlaced = true;
      }
    }
  }
  assert.equal(drillPlaced, true, 'Placed drill on Nauvis iron_ore');
  let treeGx2 = 0;
  let treeGz2 = 0;
  let found2 = false;
  for (let gx = -80; gx <= 80 && !found2; gx++) {
    for (let gz = -80; gz <= 80 && !found2; gz++) {
      if ((gx !== treeGx || gz !== treeGz) && sampleCapytorioTreeAt(gx, gz)) {
        treeGx2 = gx;
        treeGz2 = gz;
        found2 = true;
      }
    }
  }
  assert.equal(found2, true);
  assert.equal(engine.placeMachine('belt', treeGx2, treeGz2, 1).ok, true);
  assert.equal(engine.hasTreeAt(treeGx2, treeGz2), false);
  assert.equal(engine.getPocketItemCount('orange'), 3);

  const milestoneCoins: number[] = [];
  engine.evaluateMilestones({
    onMilestoneCompleted: (_id, _label, rewardCoins) => {
      milestoneCoins.push(rewardCoins);
    },
  });
  assert.ok(milestoneCoins.length >= 2, `expected at least 2 milestones completed, got ${milestoneCoins.length}`);
  assert.ok(
    milestoneCoins.every((c) => c === 0),
    `expected zero CapyCoins in Capytorio milestone callbacks, got ${JSON.stringify(milestoneCoins)}`
  );
});

test('Capytorio supports 10-slot Recent-Items Quickbar & Factorio placeable entities with 100% demolish refund', () => {
  const engine = new CapytorioFactoryEngine();
  assert.equal(engine.getRecentTools().length, MAX_RECENT_CAPYTORIO_TOOLS);
  assert.equal(MAX_RECENT_CAPYTORIO_TOOLS, 10);

  // Resolve expanded Factorio entities
  const fastBeltSpec = resolveCapytorioPlaceableSpec('fast_transport_belt');
  assert.ok(fastBeltSpec);
  assert.equal(fastBeltSpec.baseType, 'belt');
  assert.equal(fastBeltSpec.tierMult, 2.0);

  // Unlock logistic_science to craft & place fast_transport_belt
  engine.addPocketItem('iron_plate', 20);
  engine.addPocketItem('iron_gear', 20);
  // Equip directly after adding item to pocket
  engine.addPocketItem('fast_transport_belt', 2);
  assert.equal(engine.equipPlaceableTool('fast_transport_belt', true), true);
  assert.equal(engine.getRecentTools()[0], 'fast_transport_belt');
  assert.equal(engine.getRecentTools().length, 10);

  const placedFast = engine.placeMachine('fast_transport_belt', 1, 0, 1);
  assert.equal(placedFast.ok, true);
  assert.equal(placedFast.machine?.variantItemId, 'fast_transport_belt');
  assert.equal(placedFast.machine?.tierMult, 2.0);
  assert.equal(engine.getPocketItemCount('fast_transport_belt'), 1);

  // Demolish refunds exact variant item to pocket
  assert.equal(engine.demolishAt(1, 0), 'belt');
  assert.equal(engine.getPocketItemCount('fast_transport_belt'), 2);

  // Serialization preserves recentTools & variantItemId
  assert.equal(engine.placeMachine('fast_transport_belt', 2, 0, 1).ok, true);
  const roundTrip = new CapytorioFactoryEngine(engine.serialize());
  assert.equal(roundTrip.getRecentTools().length, 10);
  assert.equal(roundTrip.getRecentTools()[0], 'fast_transport_belt');
  assert.equal(roundTrip.machines.get(tileKey(2, 0))?.variantItemId, 'fast_transport_belt');
});

test('Capytorio pocket crafting shared base machine IDs (inserter/splitter/lab) credits buildable quickbar count', () => {
  const engine = new CapytorioFactoryEngine();
  const prevInserters = engine.getPlaceableToolCount('inserter');
  assert.equal(prevInserters, 8);
  engine.addPocketItem('electronic_circuit', 2);
  assert.equal(engine.pocketCraftRecipe('inserter', 1), true);
  assert.equal(engine.getPocketMachineCount('inserter'), prevInserters + 1);
  assert.equal(engine.getPlaceableToolCount('inserter'), prevInserters + 1);
  assert.equal(engine.getRecentTools()[0], 'inserter');
});

test('Capytorio dual-lane belts side-load left/right lanes independently and preserve lanes across flow & save/load', () => {
  const engine = new CapytorioFactoryEngine();

  // Main belt line heading East (+X): (0,0) -> (1,0) -> (2,0)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 2, 0, 1).ok, true);

  // Side-feeding belts into (1,0):
  // For East (dir=1, +X), North (1,-1) is LEFT side -> feeds lane 0; South (1,1) is RIGHT side -> feeds lane 1
  assert.equal(engine.placeMachine('belt', 1, -1, 2).ok, true); // Facing South (+Z) into (1,0)
  assert.equal(engine.placeMachine('belt', 1, 1, 0).ok, true);  // Facing North (-Z) into (1,0)

  const leftFeeder = engine.machines.get(tileKey(1, -1))!;
  const rightFeeder = engine.machines.get(tileKey(1, 1))!;
  leftFeeder.beltItems.push({ item: 'iron_ore', progress: 0.99, lane: 0 });
  rightFeeder.beltItems.push({ item: 'coal', progress: 0.99, lane: 0 });

  for (let i = 0; i < 6; i++) {
    engine.step(0.05);
  }

  const midBelt = engine.machines.get(tileKey(1, 0))!;
  const leftLaneItem = midBelt.beltItems.find((b) => b.item === 'iron_ore');
  const rightLaneItem = midBelt.beltItems.find((b) => b.item === 'coal');
  assert.equal(leftLaneItem?.lane, 0, 'North side-feeder enters left lane (0)');
  assert.equal(rightLaneItem?.lane, 1, 'South side-feeder enters right lane (1)');

  // Verify 4-item capacity (2 per lane) and lane preservation flowing downstream to (2,0)
  for (let i = 0; i < 20; i++) {
    engine.step(0.05);
  }
  const endBelt = engine.machines.get(tileKey(2, 0))!;
  assert.equal(endBelt.beltItems.find((b) => b.item === 'iron_ore')?.lane, 0);
  assert.equal(endBelt.beltItems.find((b) => b.item === 'coal')?.lane, 1);

  // Fill remaining slots on (2,0) up to 4 items total (2 left + 2 right) via serialize/hydrate round-trip
  endBelt.beltItems = [
    { item: 'iron_ore', progress: 0.9, lane: 0 },
    { item: 'iron_plate', progress: 0.4, lane: 0 },
    { item: 'coal', progress: 0.85, lane: 1 },
    { item: 'copper_plate', progress: 0.35, lane: 1 },
  ];
  const roundTrip = new CapytorioFactoryEngine(engine.serialize());
  const restoredEnd = roundTrip.machines.get(tileKey(2, 0))!;
  assert.equal(restoredEnd.beltItems.length, 4);
  assert.equal(restoredEnd.beltItems.filter((b) => b.lane === 0).length, 2);
  assert.equal(restoredEnd.beltItems.filter((b) => b.lane === 1).length, 2);
});

test('Capytorio assigns distinct 3D shape archetypes and contrasting colors across key item classes', () => {
  const shapes = new Map<string, string>();
  const colors = new Map<string, number>();
  const sampleIds = [
    'iron_ore',
    'coal',
    'iron_plate',
    'copper_plate',
    'iron_gear',
    'copper_cable',
    'electronic_circuit',
    'advanced_circuit',
    'automation_science',
    'logistic_science',
    'orange',
    'assembling_machine_1',
  ];

  for (const id of sampleIds) {
    const meta = getCapytorioItemMeta(id);
    shapes.set(id, meta.shape ?? 'crate');
    colors.set(id, meta.colorHex);
  }

  assert.equal(shapes.get('iron_ore'), 'ore');
  assert.equal(shapes.get('iron_plate'), 'plate');
  assert.equal(shapes.get('iron_gear'), 'gear');
  assert.equal(shapes.get('copper_cable'), 'coil');
  assert.equal(shapes.get('electronic_circuit'), 'circuit');
  assert.equal(shapes.get('automation_science'), 'science');
  assert.equal(shapes.get('orange'), 'fruit');
  assert.equal(shapes.get('assembling_machine_1'), 'crate');

  // Ensure visually distinct colors for commonly mixed items
  assert.notEqual(colors.get('iron_ore'), colors.get('coal'));
  assert.notEqual(colors.get('iron_plate'), colors.get('copper_plate'));
  assert.notEqual(colors.get('electronic_circuit'), colors.get('advanced_circuit'));
  assert.notEqual(colors.get('automation_science'), colors.get('logistic_science'));
});

test('Factorio belt 90-degree corner curving, dynamic T-merge un-curving, and concentric arc lane conservation', () => {
  const engine = new CapytorioFactoryEngine();

  // South feeder at (0, -1) dir=2 (+Z) feeding corner (0, 0) dir=1 (East +X) -> curve_from_left
  assert.equal(engine.placeMachine('belt', 0, -1, 2).ok, true);
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);

  const corner = engine.machines.get(tileKey(0, 0))!;
  assert.equal(getBeltCurveShape(engine.machines, corner), 'curve_from_left');

  // Verify concentric inner/outer arc pose continuity at entry (progress=0) and exit (progress=1)
  const poseOut: [number, number, number] = [0, 0, 0];
  evalBeltItemLocalPose('curve_from_left', 0, 0.0, poseOut);
  assert.ok(Math.abs(poseOut[0] - (-CAPYTORIO_TILE_SIZE * 0.5)) < 1e-4, 'Left-side entry sits at -X edge');
  evalBeltItemLocalPose('curve_from_left', 0, 1.0, poseOut);
  assert.ok(Math.abs(poseOut[1] - (-CAPYTORIO_TILE_SIZE * 0.5)) < 1e-4, 'Exit sits at -Z (local forward)');
  assert.ok(Math.abs(poseOut[0] - (-0.49)) < 1e-4, 'Lane 0 exits at -0.49m');

  // Feed items on both lanes through the curve and assert identical lane conservation + 1:1 beltScrollPhase
  const feeder = engine.machines.get(tileKey(0, -1))!;
  feeder.beltItems.push({ item: 'iron_ore', progress: 0.99, lane: 0 });
  feeder.beltItems.push({ item: 'copper_ore', progress: 0.99, lane: 1 });
  const prevPhase = engine.beltScrollPhase;
  assert.ok(Math.abs(getBeltLaneArcMeters('curve_from_left', 0) - BELT_CURVE_INNER_ARC_M) < 1e-4);
  assert.ok(Math.abs(getBeltLaneArcMeters('curve_from_left', 1) - BELT_CURVE_OUTER_ARC_M) < 1e-4);
  assert.ok(getBeltLaneArcMeters('curve_from_left', 1) > BELT_CURVE_INNER_ARC_M);

  for (let i = 0; i < 36; i++) {
    engine.step(0.05);
  }
  assert.ok(engine.beltScrollPhase > prevPhase + 0.5);
  const downstream = engine.machines.get(tileKey(1, 0))!;
  assert.equal(downstream.beltItems.find((b) => b.item === 'iron_ore')?.lane, 0);
  assert.equal(downstream.beltItems.find((b) => b.item === 'copper_ore')?.lane, 1);

  // Adding a straight rear feeder at (-1, 0) dir=1 un-curves (0, 0) into a straight T-merge
  assert.equal(engine.placeMachine('belt', -1, 0, 1).ok, true);
  assert.equal(getBeltCurveShape(engine.machines, corner), 'straight');

  // Demolishing the rear feeder restores the 90-degree corner dynamically
  assert.equal(engine.demolishAt(-1, 0), 'belt');
  assert.equal(getBeltCurveShape(engine.machines, corner), 'curve_from_left');

  // Adding an opposite right-side feeder (0, 1) dir=0 (North) also keeps it a straight T-junction
  assert.equal(engine.placeMachine('belt', 0, 1, 0).ok, true);
  assert.equal(getBeltCurveShape(engine.machines, corner), 'straight');

  // Demolishing left feeder (0, -1) leaves only right feeder -> curve_from_right
  assert.equal(engine.demolishAt(0, -1), 'belt');
  assert.equal(getBeltCurveShape(engine.machines, corner), 'curve_from_right');
});

test('Capytorio inserters track exact lane coordinates with 4-phase object permanence (no belt item pop)', () => {
  const engine = new CapytorioFactoryEngine();

  // Vertical belt at (0, 1) going North (-Z), inserter at (0, 0) facing North (-Z, picks from South +Z -> drops North -Z),
  // perpendicular destination belt at (0, -1) going East (+X, dir=1).
  assert.equal(engine.placeMachine('belt', 0, 1, 0).ok, true);
  assert.equal(engine.placeMachine('inserter', 0, 0, 0).ok, true);
  assert.equal(engine.placeMachine('belt', 0, -1, 1).ok, true);

  const srcBelt = engine.machines.get(tileKey(0, 1))!;
  const inserter = engine.machines.get(tileKey(0, 0))!;
  const dstBelt = engine.machines.get(tileKey(0, -1))!;
  srcBelt.beltItems.push({ item: 'iron_plate', progress: 0.48, lane: 1 });

  // Step 1: inserter locks onto target belt item UID and reaches out WITHOUT removing it yet
  engine.step(0.05);
  assert.equal(inserter.inserterPhase, 'reaching');
  assert.equal(inserter.holdingItem, null);
  assert.equal(srcBelt.beltItems.length, 1, 'Item remains on belt while inserter reaches toward it');
  assert.ok((inserter.armExtend ?? 0) > 0 && (inserter.armExtend ?? 0) < 1);
  assert.equal(inserter.pickupLane, 1);

  // Advance until physical contact lifts the item off the belt cleanly into holdingItem
  let lifted = false;
  for (let i = 0; i < 15; i++) {
    engine.step(0.05);
    if (String(inserter.inserterPhase) === 'carrying' && inserter.holdingItem === 'iron_plate') {
      lifted = true;
      break;
    }
  }
  assert.equal(lifted, true);
  assert.equal(srcBelt.beltItems.length, 0, 'Item leaves belt only at physical claw grab contact');

  // Advance until inserter drops onto perpendicular belt far lane (East belt approached from South drops onto lane 0 = North/Left)
  let releasedToReturn = false;
  for (let i = 0; i < 20; i++) {
    engine.step(0.05);
    if (String(inserter.inserterPhase) === 'returning') {
      releasedToReturn = true;
      break;
    }
  }
  assert.equal(releasedToReturn, true);
  assert.equal(inserter.holdingItem, null);
  assert.equal(dstBelt.beltItems.length, 1);
  assert.equal(dstBelt.beltItems[0].lane, 0, 'Factorio perpendicular inserter drop places onto far lane');
  engine.step(0.05);
  assert.ok(inserter.armSwing > 0 && inserter.armSwing < 1, 'Arm swings smoothly back instead of snapping');

  // Settles back cleanly into idle_pickup
  for (let i = 0; i < 24; i++) {
    engine.step(0.05);
  }
  assert.equal(inserter.inserterPhase, 'idle_pickup');
  assert.equal(inserter.armSwing, 0);
});

test('Capytorio belts hold canonical Factorio capacity (4/lane, 8/tile), pack flush with zero gaps across tile seams, and never deform items', () => {
  const engine = new CapytorioFactoryEngine();
  assert.equal(engine.beltEndSpillEnabled, false, 'Belt end item spill must be disabled by default');
  assert.equal(CAPYTORIO_BELT_ITEMS_PER_LANE, 4);
  assert.equal(CAPYTORIO_BELT_MAX_ITEMS_PER_TILE, 8);
  assert.equal(getBeltLaneCapacity('straight', 0), 4);
  assert.equal(getBeltLaneCapacity('straight', 1), 4);
  assert.equal(getBeltLaneCapacity('curve_from_left', 0), 2);
  assert.equal(getBeltLaneCapacity('curve_from_left', 1), 4);

  // 2-tile straight belt East: (0,0) -> (1,0) with open end at (1,0)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);

  const b0 = engine.machines.get(tileKey(0, 0))!;
  const b1 = engine.machines.get(tileKey(1, 0))!;
  // Feed 6 copper plates on lane 0 and 4 iron plates on lane 1
  b1.beltItems.push({ item: 'copper_plate', progress: 0.875, lane: 0 });
  b1.beltItems.push({ item: 'copper_plate', progress: 0.60, lane: 0 });
  b1.beltItems.push({ item: 'copper_plate', progress: 0.30, lane: 0 });
  b0.beltItems.push({ item: 'copper_plate', progress: 0.90, lane: 0 });
  b0.beltItems.push({ item: 'copper_plate', progress: 0.55, lane: 0 });
  b0.beltItems.push({ item: 'copper_plate', progress: 0.20, lane: 0 });

  b1.beltItems.push({ item: 'iron_plate', progress: 0.85, lane: 1 });
  b1.beltItems.push({ item: 'iron_plate', progress: 0.50, lane: 1 });
  b0.beltItems.push({ item: 'iron_plate', progress: 0.80, lane: 1 });
  b0.beltItems.push({ item: 'iron_plate', progress: 0.35, lane: 1 });

  for (let i = 0; i < 60; i++) {
    engine.step(0.05);
  }

  // With spill disabled by default, zero items fall off and end belt packs 100% full (4 left + 4 right = 8)
  assert.equal(engine.spilledItems.length, 0);
  const b1Lane0 = b1.beltItems.filter((b) => b.lane === 0).sort((a, b) => b.progress - a.progress);
  const b1Lane1 = b1.beltItems.filter((b) => b.lane === 1).sort((a, b) => b.progress - a.progress);
  const b0Lane0 = b0.beltItems.filter((b) => b.lane === 0).sort((a, b) => b.progress - a.progress);

  assert.equal(b1Lane0.length, 4, 'Straight belt lane 0 holds exactly 4 Factorio items');
  assert.equal(b1Lane1.length, 4, 'Straight belt lane 1 holds exactly 4 Factorio items');
  assert.equal(b1.beltItems.length, 8, 'Straight belt tile holds exactly 8 Factorio items total');
  assert.equal(b0Lane0.length, 2, 'Remaining 2 lane-0 items back up seamlessly onto upstream belt');

  // Verify exact touching 0.25-tile (0.625 m) slot positions with zero gaps and zero shape squish
  const expectedSlots = [0.875, 0.625, 0.375, 0.125];
  for (let idx = 0; idx < 4; idx++) {
    assert.ok(
      Math.abs(b1Lane0[idx].progress - expectedSlots[idx]) < 1e-3,
      `Lane 0 slot ${idx} expected ${expectedSlots[idx]}, got ${b1Lane0[idx].progress}`
    );
    assert.equal(b1Lane0[idx].squish ?? 0, 0, 'Belt items stay rigid (squish === 0)');
    assert.equal(b1Lane0[idx].edgeProgress ?? 0, 0, 'No edge overhang when spill is disabled');
  }

  // Verify zero-gap cross-tile seam continuity: b0 leading item (0.875) touches b1 trailing item (0.125)
  const crossSeamDistMeters = ((1.0 - b0Lane0[0].progress) + b1Lane0[3].progress) * CAPYTORIO_TILE_SIZE;
  assert.ok(
    Math.abs(crossSeamDistMeters - CAPYTORIO_BELT_ITEM_SPACING_M) < 1e-3,
    `Cross-tile seam spacing must equal ${CAPYTORIO_BELT_ITEM_SPACING_M}m, got ${crossSeamDistMeters}m`
  );
  assert.ok(Math.abs(b0Lane0[0].progress - 0.875) < 1e-3);
  assert.ok(Math.abs(b0Lane0[1].progress - 0.625) < 1e-3);

  // Serialization & hydration preserves all 8 items per belt tile
  const roundTrip = new CapytorioFactoryEngine(engine.serialize());
  assert.equal(roundTrip.machines.get(tileKey(1, 0))?.beltItems.length, 8);
});

test('Capytorio optional belt-end spill-off tips items off open ends, bounces to ground, and supports hero, inserter, collect-all & save round-trip', () => {
  const engine = new CapytorioFactoryEngine();
  engine.beltEndSpillEnabled = true;

  // Open-ended East belt at (0,0)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  const belt = engine.machines.get(tileKey(0, 0))!;
  belt.beltItems.push({ item: 'copper_plate', progress: 0.96, lane: 0 });
  belt.beltItems.push({ item: 'iron_gear', progress: 0.52, lane: 0 });

  // Step a little to verify overhang edgeProgress rises before detaching
  engine.step(0.05);
  engine.step(0.05);
  assert.ok(
    (belt.beltItems[0]?.edgeProgress ?? 0) > 0 || engine.spilledItems.length > 0,
    'Leading item tips over the open belt lip'
  );

  // Step until both items spill off, arc through gravity, bounce, and settle on the ground
  for (let i = 0; i < 60; i++) {
    engine.step(0.05);
  }
  assert.equal(belt.beltItems.length, 0, 'Both items fell off the open belt end');
  assert.equal(engine.spilledItems.length, 2, 'Two spilled items resting on the ground');
  for (const sp of engine.spilledItems) {
    assert.ok(sp.lx > CAPYTORIO_TILE_SIZE * 0.5, 'Spilled items launched past East belt lip');
    assert.equal(sp.y, 0, 'Spilled items settled on ground plane y=0');
    assert.equal(sp.settled, true);
  }

  // Verify serialization/hydration round-trip preserves spilled items
  const snap = engine.getUiSnapshot();
  assert.equal(snap.spilledItemCount, 2);
  assert.equal(snap.beltEndSpillEnabled, true);
  const roundTrip = new CapytorioFactoryEngine(engine.serialize());
  assert.equal(roundTrip.spilledItems.length, 2);

  // Verify hero walk-over auto-collect picks up nearby spilled items
  const firstSpill = roundTrip.spilledItems[0];
  const prevCount = roundTrip.getPocketItemCount(firstSpill.item);
  const walkedCollected = roundTrip.collectFromNearbyChestsAndOutputs(firstSpill.lx, firstSpill.lz, 0.25);
  assert.ok(walkedCollected >= 1);
  assert.ok(roundTrip.getPocketItemCount(firstSpill.item) >= prevCount + 1);

  // Verify Inserter facing an empty ground tile with spilled item picks it up into a chest!
  const engine2 = new CapytorioFactoryEngine();
  engine2.beltEndSpillEnabled = true;
  // Open belt at (0,0) East spills onto tile (1,0); inserter at (2,0) East picks from (1,0) -> chest at (3,0)
  assert.equal(engine2.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine2.placeMachine('inserter', 2, 0, 1).ok, true);
  assert.equal(engine2.placeMachine('chest', 3, 0, 1).ok, true);
  engine2.machines.get(tileKey(0, 0))!.beltItems.push({ item: 'iron_plate', progress: 0.99, lane: 0 });
  for (let i = 0; i < 90; i++) {
    engine2.step(0.05);
  }
  const chest = engine2.machines.get(tileKey(3, 0))!;
  assert.equal(chest.outputBuffer.iron_plate ?? 0, 1, 'Inserter picked up spilled item from ground into chest');
  assert.equal(engine2.spilledItems.length, 0);

  // Verify Collect Outputs sweeps remaining spilled items
  const engine3 = new CapytorioFactoryEngine();
  engine3.beltEndSpillEnabled = true;
  assert.equal(engine3.placeMachine('belt', 0, 0, 1).ok, true);
  engine3.machines.get(tileKey(0, 0))!.beltItems.push({ item: 'coal', progress: 0.99, lane: 1 });
  for (let i = 0; i < 40; i++) {
    engine3.step(0.05);
  }
  assert.equal(engine3.spilledItems.length, 1);
  const coalBefore = engine3.getPocketItemCount('coal');
  const swept = engine3.collectAllChestsAndOutputs();
  assert.equal(swept, 1);
  assert.equal(engine3.spilledItems.length, 0);
  assert.equal(engine3.getPocketItemCount('coal'), coalBefore + 1);
});

test('Capytorio3DRenderer: low-profile machines are immune to camera-fade, share pooled geometries, and track topologyRevision', () => {
  const engine = new CapytorioFactoryEngine();

  const rev0 = engine.topologyRevision;
  assert.equal(engine.placeMachine('furnace', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('furnace', 0, 2, 1).ok, true);
  assert.equal(engine.placeMachine('furnace', 0, 4, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', -1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', -1, 2, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', 2, 0, 1).ok, true);
  assert.ok(engine.topologyRevision >= rev0 + 6, 'topologyRevision increments on each placement');

  const revBeforeRotate = engine.topologyRevision;
  assert.notEqual(engine.rotateMachineAt(-1, 0), null);
  assert.equal(engine.topologyRevision, revBeforeRotate + 1, 'topologyRevision increments on rotate');

  const renderer3d = new Capytorio3DRenderer();
  try {
    renderer3d.sync(
      engine,
      CAPYTORIO_WORLD_ORIGIN_X,
      CAPYTORIO_WORLD_ORIGIN_Z,
      0.016,
      1.25,
      true,
      26
    );

    // 1. Oblique mode (includeTallLandmark=false) yields zero occluders; chase mode yields ONLY beaconPillarGroup
    const obliqueOccluders: THREE.Object3D[] = [];
    renderer3d.collectOccluderCandidates(obliqueOccluders, false);
    assert.equal(obliqueOccluders.length, 0, 'Oblique top-down camera never fades Capytorio structures');

    const chaseOccluders: THREE.Object3D[] = [];
    renderer3d.collectOccluderCandidates(chaseOccluders, true);
    assert.equal(chaseOccluders.length, 1, '3D chase camera only exposes the tall Drop-Pod Beacon landmark');
    assert.equal(
      chaseOccluders[0].userData.__occluderRoot,
      chaseOccluders[0],
      'Beacon landmark carries self __occluderRoot so sub-parts never vanish independently'
    );

    // 2. Every placed furnace & inserter sub-mesh carries ignoreCameraFade=true and shares pooled geometries
    const machineGroups: THREE.Group[] = [];
    for (const child of renderer3d.root.children) {
      if (child instanceof THREE.Group && child.userData.machineType) {
        machineGroups.push(child);
      }
    }
    assert.equal(machineGroups.length, 6, 'All 6 placed machines synced into 3D scene');

    const furnaceGeos = new Set<THREE.BufferGeometry>();
    const inserterGeos = new Set<THREE.BufferGeometry>();
    for (const grp of machineGroups) {
      assert.equal(grp.userData.ignoreCameraFade, true);
      assert.equal(grp.userData.__occluderRoot, grp);
      grp.traverse((node) => {
        assert.equal(node.userData.ignoreCameraFade, true, 'Every machine sub-mesh resists partial fade');
        assert.equal(node.userData.__occluderRoot, grp, 'Every machine sub-mesh points to its parent group');
        if (node instanceof THREE.Mesh) {
          if (grp.userData.machineType === 'furnace') furnaceGeos.add(node.geometry);
          if (grp.userData.machineType === 'inserter') inserterGeos.add(node.geometry);
        }
      });
    }
    // 3 furnaces share exact same 6 cached geometries (plinth, kiln, chimney, hearth, capRing, outPort)
    assert.ok(furnaceGeos.size <= 6, `Expected <=6 shared furnace geometries across 3 furnaces, got ${furnaceGeos.size}`);
    // 3 inserters share plinth + inserter parts + 16 held-item shapes (never multiplied by 3!)
    assert.ok(inserterGeos.size <= 32, `Expected pooled inserter geometries, got ${inserterGeos.size}`);

    // 3. Ground deck stays opaque at normal factory altitude for clean early-Z and SSAO depth
    const deckMesh = renderer3d.root.children.find(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry
    ) as THREE.Mesh | undefined;
    assert.ok(deckMesh, 'Ground deck mesh exists');
    const deckMat = deckMesh.material as THREE.MeshStandardMaterial;
    assert.equal(deckMat.transparent, false, 'Ground deck renders in opaque pass at normal altitude');
    assert.equal(deckMat.depthWrite, true, 'Ground deck writes to hardware depth buffer');
  } finally {
    renderer3d.dispose();
  }
});

test('Capytorio universal tile inspection reports belt item counts/lanes, ore richness, trees, drills on ore, spilled items, beacon, and terrain', () => {
  const engine = new CapytorioFactoryEngine();

  // 1. Straight belt with mixed items across left & right lanes
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);
  const straightBelt = engine.machines.get(tileKey(0, 0))!;
  straightBelt.beltItems.push(
    { item: 'iron_ore', progress: 0.85, lane: 0 },
    { item: 'iron_ore', progress: 0.55, lane: 0 },
    { item: 'copper_plate', progress: 0.25, lane: 0 },
    { item: 'coal', progress: 0.75, lane: 1 },
    { item: 'coal', progress: 0.45, lane: 1 }
  );

  const beltInfo = engine.inspectTileAt(0, 0);
  assert.equal(beltInfo.primaryKind, 'machine');
  assert.equal(beltInfo.title, 'Transport Belt');
  assert.ok(beltInfo.machine);
  assert.equal(beltInfo.machine!.beltItemCount, 5);
  assert.equal(beltInfo.machine!.beltCapacity, 8);
  assert.equal(beltInfo.machine!.beltLeftLaneCount, 3);
  assert.equal(beltInfo.machine!.beltRightLaneCount, 2);
  assert.equal(beltInfo.machine!.beltLeftLaneCapacity, 4);
  assert.equal(beltInfo.machine!.beltRightLaneCapacity, 4);
  assert.equal(beltInfo.machine!.beltCurveShape, 'straight');
  assert.equal(beltInfo.machine!.status, 'Working');
  assert.deepEqual(beltInfo.machine!.beltItemsByType, [
    { item: 'coal', count: 2 },
    { item: 'iron_ore', count: 2 },
    { item: 'copper_plate', count: 1 },
  ]);

  // Verify curved belt reports canonical capacity 6 (2 inner + 4 outer)
  assert.equal(engine.placeMachine('belt', 1, 1, 2).ok, true);
  const curveTarget = engine.machines.get(tileKey(1, 0))!;
  curveTarget.dir = 2; // East belt (0,0) feeds into South belt (1,0) -> curve_from_right
  const curvedInfo = engine.inspectTileSnapshot(1, 0);
  assert.equal(curvedInfo.machine?.beltCurveShape, 'curve_from_right');
  assert.equal(curvedInfo.machine?.beltCapacity, 6);

  // 2. Find an untouched ground ore patch & inspect it directly, then place a Mining Drill on top
  let oreGx = 0;
  let oreGz = 0;
  let foundOre = false;
  for (let gx = -14; gx <= 14 && !foundOre; gx++) {
    for (let gz = -14; gz <= 14 && !foundOre; gz++) {
      if (!engine.machines.has(tileKey(gx, gz)) && engine.getResourceAt(gx, gz)) {
        oreGx = gx;
        oreGz = gz;
        foundOre = true;
      }
    }
  }
  assert.equal(foundOre, true, 'Found a ground ore tile in starter field');
  const oreInfo = engine.inspectTileAt(oreGx, oreGz);
  assert.equal(oreInfo.primaryKind, 'resource');
  assert.ok(oreInfo.resource && oreInfo.resource.remaining > 0);
  assert.equal(oreInfo.machine, null);
  assert.equal(engine.inspectedKey, null, 'Non-machine inspected tile does not set inspectedKey');
  assert.deepEqual(engine.inspectedTile, { gx: oreGx, gz: oreGz });

  const initialRemaining = oreInfo.resource!.remaining;
  assert.equal(engine.placeMachine('drill', oreGx, oreGz, 1).ok, true);
  const drillOnOreInfo = engine.inspectTileSnapshot(oreGx, oreGz);
  assert.equal(drillOnOreInfo.primaryKind, 'machine');
  assert.equal(drillOnOreInfo.machine?.type, 'drill');
  assert.equal(drillOnOreInfo.resource?.remaining, initialRemaining, 'Drill inspection preserves underlying ore richness');

  // 3. Find a Wild Citrus Tree and inspect it without destroying it
  let treeGx = 0;
  let treeGz = 0;
  let foundTree = false;
  for (let gx = -80; gx <= 80 && !foundTree; gx++) {
    for (let gz = -80; gz <= 80 && !foundTree; gz++) {
      if (engine.hasTreeAt(gx, gz)) {
        treeGx = gx;
        treeGz = gz;
        foundTree = true;
      }
    }
  }
  assert.equal(foundTree, true, 'Found a Wild Citrus Tree');
  const treeInfo = engine.inspectTileAt(treeGx, treeGz);
  assert.equal(treeInfo.primaryKind, 'tree');
  assert.equal(treeInfo.title, 'Wild Citrus Tree');
  assert.equal(treeInfo.tree?.yieldItem, 'orange');
  assert.equal(treeInfo.tree?.yieldCount, 3);
  assert.equal(engine.hasTreeAt(treeGx, treeGz), true, 'Inspecting tree does not destroy it');

  // 4. Inspect spilled items on an empty meadow tile
  let emptyGx = 0;
  let emptyGz = 0;
  let foundEmpty = false;
  for (let gx = -10; gx <= 10 && !foundEmpty; gx++) {
    for (let gz = -10; gz <= 10 && !foundEmpty; gz++) {
      if (
        !engine.machines.has(tileKey(gx, gz)) &&
        !engine.getResourceAt(gx, gz) &&
        !engine.hasTreeAt(gx, gz) &&
        !engine.isBeaconTile(gx, gz)
      ) {
        emptyGx = gx;
        emptyGz = gz;
        foundEmpty = true;
      }
    }
  }
  assert.equal(foundEmpty, true);
  const terrainInfo = engine.inspectTileSnapshot(emptyGx, emptyGz);
  assert.equal(terrainInfo.primaryKind, 'terrain');
  assert.ok(
    ['Lush Meadow', 'Meadow Grass', 'Dry Dirt', 'Arid Dirt', 'Golden Sand', 'Red Desert'].includes(
      terrainInfo.title
    ),
    `Expected dry land biome title, got ${terrainInfo.title}`
  );

  engine.spilledItems.push(
    {
      uid: 9001,
      item: 'iron_plate',
      lx: emptyGx * CAPYTORIO_TILE_SIZE,
      y: 0,
      lz: emptyGz * CAPYTORIO_TILE_SIZE,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vrz: 0,
      squish: 0,
      settled: true,
      ageSec: 1,
    },
    {
      uid: 9002,
      item: 'iron_plate',
      lx: emptyGx * CAPYTORIO_TILE_SIZE + 0.2,
      y: 0,
      lz: emptyGz * CAPYTORIO_TILE_SIZE - 0.1,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vrz: 0,
      squish: 0,
      settled: true,
      ageSec: 1,
    }
  );
  const spilledInfo = engine.inspectTileSnapshot(emptyGx, emptyGz);
  assert.equal(spilledInfo.primaryKind, 'spilled');
  assert.equal(spilledInfo.spilledTotalCount, 2);
  assert.deepEqual(spilledInfo.spilledItems, [{ item: 'iron_plate', count: 2 }]);

  // 5. Inspect Drop-Pod Surveyor Beacon at (0, -3)
  const beaconInfo = engine.inspectTileSnapshot(0, -3);
  assert.equal(beaconInfo.primaryKind, 'beacon');
  assert.equal(beaconInfo.isBeacon, true);
  assert.equal(beaconInfo.title, 'Surveyor Beacon');

  // 6. Verify getUiSnapshot() exposes both inspectedTile and hoveredTileInfo cleanly
  engine.hoveredGx = 0;
  engine.hoveredGz = 0;
  const snap = engine.getUiSnapshot();
  assert.equal(snap.hoveredTileInfo.machine?.beltItemCount, 5);
  assert.equal(snap.inspectedTile?.primaryKind, 'tree');

  engine.clearInspection();
  assert.equal(engine.getUiSnapshot().inspectedTile, null);
});

test('Capytorio Cut/Copy/Paste: Box & Freeform Lasso selection, 90-deg rotation, recipe copy, relocation, and Undo Cut', () => {
  const engine = new CapytorioFactoryEngine();
  // Grant starter crafting materials and craft extra machines into pocket for copy-pasting
  engine.addPocketItem('iron_plate', 80);
  engine.addPocketItem('copper_plate', 40);
  engine.addPocketItem('iron_gear', 40);
  engine.addPocketItem('circuit', 20);
  for (let i = 0; i < 4; i++) {
    engine.craftMachineIntoPocket('belt');
    engine.craftMachineIntoPocket('inserter');
    engine.craftMachineIntoPocket('assembler');
  }

  // Build an L-shaped cluster at (0,0)-(2,1) plus an outside furnace at (6, 6)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', 1, 1, 2).ok, true);
  assert.equal(engine.placeMachine('assembler', 2, 1, 0).ok, true);
  assert.equal(engine.setAssemblerRecipeAt(2, 1, 'iron_gear'), true);
  assert.equal(engine.placeMachine('furnace', 6, 6, 3).ok, true);

  // 1. Square Box Selection captures only the 4 buildings in (0,0)-(2,1)
  const boxMachines = engine.selectMachinesInBox(2, 1, 0, 0);
  assert.equal(boxMachines.length, 4, 'Box selection captures all 4 buildings regardless of drag direction');
  assert.equal(
    boxMachines.some((m) => m.gx === 6 && m.gz === 6),
    false,
    'Outside furnace excluded from box'
  );

  // 2. Freeform Lasso (Polygon) Selection: concave L-shape around (0,0), (1,0), (1,1) excluding (2,1) and (6,6)
  const lassoPolygon = [
    { gx: -0.6, gz: -0.6 },
    { gx: 1.45, gz: -0.6 },
    { gx: 1.45, gz: 1.45 },
    { gx: 0.55, gz: 1.45 },
    { gx: 0.55, gz: 0.45 },
    { gx: -0.6, gz: 0.45 },
  ];
  const lassoMachines = engine.selectMachinesInPolygon(lassoPolygon);
  const lassoKeys = lassoMachines.map((m) => tileKey(m.gx, m.gz));
  assert.equal(lassoMachines.length, 3, 'Freeform concave lasso selects exact 3 enclosed buildings');
  assert.equal(lassoKeys.includes(tileKey(0, 0)), true);
  assert.equal(lassoKeys.includes(tileKey(1, 0)), true);
  assert.equal(lassoKeys.includes(tileKey(1, 1)), true);
  assert.equal(lassoKeys.includes(tileKey(2, 1)), false, 'Assembler outside concave notch excluded');

  // Freeform brush stroke (open polyline touching tiles directly)
  const brushedMachines = engine.selectMachinesInPolygon([
    { gx: 0, gz: 0 },
    { gx: 1, gz: 0 },
  ]);
  assert.equal(brushedMachines.length, 2, 'Freeform line brush selects buildings along stroke');

  // 3. Copy + Rotate 90° CW + Paste at (0, 8) preserves relative geometry, rotated dirs, and Assembler recipe
  const copyRes = engine.captureBlueprint(boxMachines, 'copy');
  assert.equal(copyRes.count, 4);
  assert.equal(engine.clipboardToolState, 'paste');
  assert.equal(engine.getUiSnapshot().clipboard.count, 4);

  // Rotate 90° CW: (dx, dz) -> (-dz, dx), dir -> (dir + 1) & 3
  engine.rotateBlueprint90();
  const evalChecks = engine.evaluateBlueprintPlacementAt(0, 8);
  assert.equal(evalChecks.length, 4);
  assert.equal(evalChecks.every((c) => c.valid), true, 'All 4 rotated paste slots valid on clear meadow');

  const pasteRes = engine.pasteBlueprintAt(0, 8);
  assert.equal(pasteRes.placedCount, 4);
  assert.equal(pasteRes.skippedCount, 0);
  // Copy mode stays active for multi-stamping
  assert.equal(engine.clipboardToolState, 'paste');

  // Verify rotated Assembler arrived with dir=1 (rotated from 0) and recipe 'iron_gear'
  const pastedAssemblers = Array.from(engine.machines.values()).filter(
    (m) => m.type === 'assembler' && m.gz >= 6
  );
  assert.equal(pastedAssemblers.length, 1);
  assert.equal(pastedAssemblers[0].dir, 1, 'Assembler direction rotated 90° CW (0 -> 1)');
  assert.equal(pastedAssemblers[0].recipeId, 'iron_gear', 'Assembler recipe preserved across copy/paste');

  // 4. Cut refunds 100% into pocket & enables Undo Cut
  const beltsBeforeCut = engine.getPocketMachineCount('belt');
  const insertersBeforeCut = engine.getPocketMachineCount('inserter');
  const assemblersBeforeCut = engine.getPocketMachineCount('assembler');
  const cutRes = engine.captureBlueprint(boxMachines, 'cut');
  assert.equal(cutRes.count, 4);
  assert.equal(engine.machines.has(tileKey(0, 0)), false, 'Original cut tiles removed');
  assert.equal(engine.machines.has(tileKey(2, 1)), false);
  assert.equal(engine.getPocketMachineCount('belt'), beltsBeforeCut + 2, 'Cut refunded 2 belts');
  assert.equal(engine.getPocketMachineCount('inserter'), insertersBeforeCut + 1, 'Cut refunded 1 inserter');
  assert.equal(engine.getPocketMachineCount('assembler'), assemblersBeforeCut + 1, 'Cut refunded 1 assembler');
  assert.equal(engine.getUiSnapshot().clipboard.canUndoCut, true);

  // Undo Cut restores all 4 buildings back to exact original positions & recipes!
  const undoRes = engine.undoCut();
  assert.equal(undoRes.restoredCount, 4);
  assert.equal(engine.machines.has(tileKey(0, 0)), true);
  assert.equal(engine.machines.get(tileKey(2, 1))?.recipeId, 'iron_gear');
  assert.equal(engine.getUiSnapshot().clipboard.canUndoCut, false);

  // 5. Cut again and Paste to new location (-6, 8) -> clears clipboard after 1 move
  const boxMachinesAgain = engine.selectMachinesInBox(0, 0, 2, 1);
  engine.captureBlueprint(boxMachinesAgain, 'cut');
  const moveRes = engine.pasteBlueprintAt(-6, 8);
  assert.equal(moveRes.placedCount, 4);
  assert.equal(engine.clipboardToolState, 'off', 'Cut clears clipboard after relocating buildings');
  assert.equal(engine.getUiSnapshot().clipboard.canUndoCut, false);
});

test('Blueprint Library remembers last 100 Cut/Copy selections, persists across save/load, and supports Rotate CCW + Flip H/V', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Build an asymmetric L-shaped layout (starter kit has 24 belts, 8 inserters, 4 furnaces):
  // (0,0) belt dir=1 (East) -> (1,0) belt dir=2 (South) -> (1,1) inserter dir=2 (South) -> (2,1) furnace dir=3 (West)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 2).ok, true);
  assert.equal(engine.placeMachine('inserter', 1, 1, 2).ok, true);
  assert.equal(engine.placeMachine('furnace', 2, 1, 3).ok, true);

  // 1. Copy saves to library and remains remembered even after clearClipboard (Esc)
  // Furnace at (2,1) is 2x2 (x: 2..3, z: 1..2), so bounding box is width=4, height=3
  const all = engine.selectMachinesInBox(0, 0, 3, 2);
  assert.equal(all.length, 4);
  engine.captureBlueprint(all, 'copy');
  assert.equal(engine.blueprintLibrary.length, 1);
  const firstBpId = engine.blueprintLibrary[0].id;
  assert.equal(engine.blueprintLibrary[0].sourceMode, 'copy');
  assert.equal(engine.blueprintLibrary[0].width, 4);
  assert.equal(engine.blueprintLibrary[0].height, 3);

  engine.clearClipboard();
  assert.equal(engine.clipboardToolState, 'off');
  assert.equal(engine.getUiSnapshot().clipboard.hasRememberedSelection, true);
  assert.equal(engine.getUiSnapshot().clipboard.libraryCount, 1);

  // Ctrl+V / activateLastBlueprint immediately recalls the remembered selection
  assert.equal(engine.activateLastBlueprint(), true);
  assert.equal(engine.clipboardToolState, 'paste');
  assert.equal(engine.clipboard?.entries.length, 4);

  // 2. Flip Horizontal: center-preserving multi-tile mirror (dx -> -dx - (w-1)), dir 1 <-> 3, dir 0/2 unchanged
  const beforeFlipH = engine.clipboard!.entries.map((e) => ({
    dx: e.dx,
    dz: e.dz,
    dir: e.dir,
    w: e.baseType === 'furnace' ? 2 : 1,
  }));
  assert.equal(engine.flipBlueprintHorizontal(), true);
  const afterFlipH = engine.clipboard!.entries;
  for (let i = 0; i < beforeFlipH.length; i++) {
    const a = beforeFlipH[i];
    const entry = afterFlipH[i];
    assert.equal(entry.dx, -a.dx - (a.w - 1), 'Flip H mirrors multi-tile center cleanly');
    assert.equal(entry.dz, a.dz, 'Flip H preserves dz');
    const expectedDir = a.dir === 1 ? 3 : a.dir === 3 ? 1 : a.dir;
    assert.equal(entry.dir, expectedDir, 'Flip H mirrors East <-> West');
  }

  // Flip Vertical: center-preserving multi-tile mirror (dz -> -dz - (h-1)), dir 0 <-> 2, dir 1/3 unchanged
  const beforeFlipV = engine.clipboard!.entries.map((e) => ({
    dx: e.dx,
    dz: e.dz,
    dir: e.dir,
    h: e.baseType === 'furnace' ? 2 : 1,
  }));
  assert.equal(engine.flipBlueprintVertical(), true);
  const afterFlipV = engine.clipboard!.entries;
  for (let i = 0; i < beforeFlipV.length; i++) {
    const a = beforeFlipV[i];
    const entry = afterFlipV[i];
    assert.equal(entry.dx, a.dx, 'Flip V preserves dx');
    assert.equal(entry.dz, -a.dz - (a.h - 1), 'Flip V mirrors multi-tile center cleanly');
    const expectedDir = a.dir === 0 ? 2 : a.dir === 2 ? 0 : a.dir;
    assert.equal(entry.dir, expectedDir, 'Flip V mirrors North <-> South');
  }

  // Rotate 90° CW then 90° CCW returns to exact original coordinates & directions
  const beforeRot = engine.clipboard!.entries.map((e) => ({ dx: e.dx, dz: e.dz, dir: e.dir }));
  engine.rotateBlueprint90(false);
  engine.rotateBlueprint90(true);
  for (let i = 0; i < beforeRot.length; i++) {
    assert.equal(engine.clipboard!.entries[i].dx, beforeRot[i].dx);
    assert.equal(engine.clipboard!.entries[i].dz, beforeRot[i].dz);
    assert.equal(engine.clipboard!.entries[i].dir, beforeRot[i].dir);
  }

  // 3. Cut also saves to library and stays recallable after relocating buildings
  const singleFurnace = [engine.machines.get(tileKey(2, 1))!];
  engine.captureBlueprint(singleFurnace, 'cut');
  assert.equal(engine.blueprintLibrary.length, 2);
  assert.equal(engine.blueprintLibrary[0].sourceMode, 'cut');
  const cutMoved = engine.pasteBlueprintAt(6, 6);
  assert.equal(cutMoved.placedCount, 1);
  assert.equal(engine.clipboardToolState, 'off');
  assert.equal(engine.getUiSnapshot().clipboard.hasRememberedSelection, true);
  assert.equal(engine.activateLastBlueprint(), true);
  assert.equal(engine.clipboardToolState, 'paste');
  assert.equal(engine.clipboard?.entries[0].baseType, 'furnace');

  // 4. Cap at MAX_CAPYTORIO_BLUEPRINT_LIBRARY (100), newest first
  const beltMachine = engine.machines.get(tileKey(0, 0))!;
  for (let i = 0; i < MAX_CAPYTORIO_BLUEPRINT_LIBRARY + 8; i++) {
    engine.captureBlueprint([beltMachine], 'copy');
  }
  assert.equal(
    engine.blueprintLibrary.length,
    MAX_CAPYTORIO_BLUEPRINT_LIBRARY,
    'Library retains strictly the last 100 copied/cut blueprints'
  );
  assert.equal(
    engine.blueprintLibrary.some((bp) => bp.id === firstBpId),
    false,
    'Oldest entries beyond 100 are evicted'
  );

  // 5. Persistence via serialize() -> hydrate() + select/delete/clear
  const serialized = engine.serialize();
  assert.equal(serialized.blueprintLibrary?.length, MAX_CAPYTORIO_BLUEPRINT_LIBRARY);

  const restored = new CapytorioFactoryEngine();
  restored.hydrate(serialized);
  assert.equal(restored.blueprintLibrary.length, MAX_CAPYTORIO_BLUEPRINT_LIBRARY);
  const newestId = restored.blueprintLibrary[0].id;
  const picked = restored.selectBlueprintFromLibrary(newestId);
  assert.ok(picked);
  assert.equal(restored.clipboardToolState, 'paste');
  assert.equal(restored.deleteBlueprintFromLibrary(newestId), true);
  assert.equal(restored.blueprintLibrary.length, MAX_CAPYTORIO_BLUEPRINT_LIBRARY - 1);
  restored.clearBlueprintLibrary();
  assert.equal(restored.blueprintLibrary.length, 0);
});

test('Capytorio3DRenderer renders transparent 3D ghost models (and hides arrows) during blueprint paste', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 2).ok, true);
  assert.equal(engine.placeMachine('inserter', 1, 1, 2).ok, true);
  assert.equal(engine.placeMachine('furnace', 2, 1, 0).ok, true);

  const selection = engine.selectMachinesInBox(0, 0, 2, 1);
  engine.captureBlueprint(selection, 'copy');
  engine.hoveredGx = 6;
  engine.hoveredGz = 6;

  const renderer = new Capytorio3DRenderer();
  renderer.sync(
    engine,
    capytorioGridToWorldX(6),
    capytorioGridToWorldZ(6),
    0.016,
    1.0,
    true,
    28
  );

  const ghostRoot = renderer.root.getObjectByName('CapytorioBlueprintGhostRoot');
  assert.ok(ghostRoot, 'Blueprint ghost root group exists in 3D scene');
  const visibleGhostGroups = ghostRoot.children.filter((c) => c.visible);
  assert.equal(visibleGhostGroups.length, 4, 'All 4 blueprint entries render as visible 3D ghost models');

  // Verify every visible ghost mesh uses transparent, depthWrite=false ghost materials
  let transparentMeshCount = 0;
  for (const group of visibleGhostGroups) {
    group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.visible && !mesh.userData.isGhostHiddenHeld) {
        const mat = mesh.material as THREE.Material;
        assert.equal(mat.transparent, true, 'Ghost mesh material must be transparent');
        assert.equal(mat.depthWrite, false, 'Ghost mesh material must disable depthWrite');
        transparentMeshCount++;
      }
    });
  }
  assert.ok(transparentMeshCount >= 10, 'Ghost models contain composite 3D geometry parts');

  // Verify dead arrow-only paste instanced mesh has been removed in favor of 3D ghosts
  const arrowInstanced = (renderer as unknown as { blueprintArrowInstanced?: THREE.InstancedMesh })
    .blueprintArrowInstanced;
  assert.equal(arrowInstanced, undefined, 'Dead arrow-only paste mesh is removed in favor of 3D ghosts');

  // Exiting paste mode hides all pooled 3D ghosts cleanly
  engine.clearClipboard();
  renderer.sync(
    engine,
    capytorioGridToWorldX(6),
    capytorioGridToWorldZ(6),
    0.016,
    1.1,
    true,
    28
  );
  assert.equal(
    ghostRoot.children.filter((c) => c.visible).length,
    0,
    'Pooled 3D ghosts hide cleanly when leaving paste mode'
  );
  renderer.dispose();
});

test('Capytorio Undo/Redo covers place, rotate, recipe, demolish, cut, and atomic blueprint paste, and Place uses locked pasteAnchor', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  assert.equal(engine.getUiSnapshot().history.canUndo, false);
  assert.equal(engine.getUiSnapshot().history.canRedo, false);

  // 1. Place assembler -> Undo removes & refunds -> Redo restores
  const asmBefore = engine.getPocketMachineCount('assembler');
  assert.equal(engine.placeMachine('assembler', 0, 0, 1).ok, true);
  assert.equal(engine.getPocketMachineCount('assembler'), asmBefore - 1);
  assert.equal(engine.getUiSnapshot().history.canUndo, true);

  const undoPlace = engine.undoLastAction();
  assert.equal(undoPlace.ok, true);
  assert.equal(engine.machines.has(tileKey(0, 0)), false, 'Undo removed placed assembler');
  assert.equal(engine.getPocketMachineCount('assembler'), asmBefore, 'Undo refunded assembler to pocket');
  assert.equal(engine.getUiSnapshot().history.canRedo, true);

  const redoPlace = engine.redoLastAction();
  assert.equal(redoPlace.ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.dir, 1, 'Redo restored assembler with direction');
  assert.equal(engine.getPocketMachineCount('assembler'), asmBefore - 1);

  // 2. Rotate & Set Recipe -> Undo reverts recipe then direction -> Redo reapplies both
  assert.equal(engine.rotateMachineAt(0, 0), 2);
  assert.equal(engine.setAssemblerRecipeAt(0, 0, 'copper_cable'), true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.recipeId, 'copper_cable');

  assert.equal(engine.undoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.recipeId, 'iron_gear', 'Undo reverted assembler recipe');

  assert.equal(engine.undoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.dir, 1, 'Undo reverted machine rotation');

  assert.equal(engine.redoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.dir, 2);
  assert.equal(engine.redoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.recipeId, 'copper_cable');

  // 3. Demolish -> Undo restores building with exact recipe & direction
  assert.equal(engine.demolishAt(0, 0), 'assembler');
  assert.equal(engine.machines.has(tileKey(0, 0)), false);
  assert.equal(engine.undoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(0, 0))?.dir, 2);
  assert.equal(engine.machines.get(tileKey(0, 0))?.recipeId, 'copper_cable');

  // 4. Build 3-building cluster (3x3 Assembler at 0,0 + Belt at 3,0 + Inserter at 3,1), Copy,
  //    position ghost anchor at (8, 8), move hover away to (-9, -9),
  //    then place via pasteBlueprintAtAnchor() -> stamps at locked (8, 8), NOT (-9, -9)!
  assert.equal(engine.placeMachine('belt', 3, 0, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', 3, 1, 2).ok, true);
  const cluster = engine.selectMachinesInBox(0, 0, 3, 2);
  assert.equal(cluster.length, 3);
  engine.captureBlueprint(cluster, 'copy');

  // Position and lock ghost at (8, 8)
  engine.setBlueprintAnchor(8, 8);
  assert.deepEqual(engine.getUiSnapshot().clipboard.pasteAnchor, { gx: 8, gz: 8 });

  // Simulate moving pointer down toward the HUD Place button (changes hoveredGx/hoveredGz)
  engine.hoveredGx = -9;
  engine.hoveredGz = -9;

  const beltsBeforePaste = engine.getPocketMachineCount('belt');
  const insBeforePaste = engine.getPocketMachineCount('inserter');
  const asmBeforePaste = engine.getPocketMachineCount('assembler');

  const anchorPaste = engine.pasteBlueprintAtAnchor();
  assert.equal(anchorPaste.placedCount, 3, 'All 3 blueprint buildings placed via Place button');
  assert.equal(anchorPaste.anchorGx, 8);
  assert.equal(anchorPaste.anchorGz, 8);
  assert.equal(engine.machines.has(tileKey(-9, -9)), false, 'Did NOT stamp at drifted hover coords');

  const pastedNearAnchor = Array.from(engine.machines.values()).filter((m) => m.gx >= 5 && m.gz >= 5);
  assert.equal(pastedNearAnchor.length, 3, 'All 3 buildings stamped around locked anchor (8, 8)');
  const pastedAsm = pastedNearAnchor.find((m) => m.type === 'assembler');
  assert.equal(pastedAsm?.recipeId, 'copper_cable', 'Pasted assembler preserved recipe');

  // 5. Single Undo removes ALL 3 misplaced blueprint buildings atomically & refunds pocket stock!
  const undoBlueprint = engine.undoLastAction();
  assert.equal(undoBlueprint.ok, true);
  assert.equal(undoBlueprint.changedCount, 3, 'Atomic undo reverted all 3 pasted buildings in one step');
  assert.equal(
    Array.from(engine.machines.values()).filter((m) => m.gx >= 5 && m.gz >= 5).length,
    0,
    'All misplaced blueprint buildings removed'
  );
  assert.equal(engine.getPocketMachineCount('belt'), beltsBeforePaste);
  assert.equal(engine.getPocketMachineCount('inserter'), insBeforePaste);
  assert.equal(engine.getPocketMachineCount('assembler'), asmBeforePaste);

  // Single Redo puts all 3 blueprint buildings right back with recipe intact
  const redoBlueprint = engine.redoLastAction();
  assert.equal(redoBlueprint.ok, true);
  assert.equal(redoBlueprint.changedCount, 3);
  assert.equal(
    Array.from(engine.machines.values()).filter((m) => m.gx >= 5 && m.gz >= 5).length,
    3,
    'Atomic redo restored all 3 blueprint buildings'
  );

  // 6. New building edit after Undo clears Redo stack
  assert.equal(engine.undoLastAction().ok, true);
  assert.equal(engine.getUiSnapshot().history.canRedo, true);
  assert.equal(engine.placeMachine('furnace', -4, 4, 0).ok, true);
  assert.equal(engine.getUiSnapshot().history.canRedo, false, 'New action clears Redo stack');
});

test('Partial cut-paste keeps unplaced blueprint entries & Undo Cut intact until all cut buildings are placed or restored', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Place 4 belts in a horizontal line (0,0)..(3,0) then cut all 4
  for (let x = 0; x < 4; x++) {
    assert.equal(engine.placeMachine('belt', x, 0, 1).ok, true);
  }
  const cutList = engine.selectMachinesInBox(0, 0, 3, 0);
  assert.equal(cutList.length, 4);
  engine.captureBlueprint(cutList, 'cut');
  assert.equal(engine.clipboardToolState, 'paste');
  assert.equal(engine.clipboard?.entries.length, 4);

  // Occupy 3 of the 4 destination tiles around (0, 6) with 1x1 chests so only 1 slot fits cleanly
  assert.equal(engine.placeMachine('chest', -2, 6, 0).ok, true);
  assert.equal(engine.placeMachine('chest', -1, 6, 0).ok, true);
  assert.equal(engine.placeMachine('chest', 0, 6, 0).ok, true);
  // Tile (1, 6) is open -> 1 belt places, 3 are skipped!
  const partialRes = engine.pasteBlueprintAt(0, 6);
  assert.equal(partialRes.placedCount, 1);
  assert.equal(partialRes.skippedCount, 3);

  // Clipboard & Undo Cut MUST remain active with the 3 remaining unplaced belts
  assert.equal(engine.clipboardToolState, 'paste', 'Partial cut-paste keeps paste mode active');
  assert.equal(engine.clipboard?.entries.length, 3, '3 skipped cut entries remain in clipboard');
  assert.equal(engine.getUiSnapshot().clipboard.canUndoCut, true, 'Undo Cut stays available for remaining cut buildings');

  // Calling undoCut restores the 3 unplaced belts back to their original tiles (without disturbing the 1 moved belt)
  const restored = engine.undoCut();
  assert.equal(restored.restoredCount, 3, 'All 3 remaining cut belts restored cleanly to original tiles');
  assert.equal(engine.machines.has(tileKey(1, 6)), true, 'The 1 successfully moved belt stays at destination');
  assert.equal(engine.clipboardToolState, 'off');

  // Also test finishing a partial cut-paste cleanly on clear ground clears clipboard when skippedCount reaches 0
  engine.resetToBlankStarterField();
  for (let x = 0; x < 3; x++) {
    assert.equal(engine.placeMachine('belt', x, 0, 1).ok, true);
  }
  engine.captureBlueprint(engine.selectMachinesInBox(0, 0, 2, 0), 'cut');
  assert.equal(engine.placeMachine('chest', -1, 5, 0).ok, true);
  assert.equal(engine.placeMachine('chest', 0, 5, 0).ok, true);

  const partial2 = engine.pasteBlueprintAt(0, 5);
  assert.equal(partial2.placedCount, 1);
  assert.equal(partial2.skippedCount, 2);
  assert.equal(engine.clipboard?.entries.length, 2);

  // Move to clear meadow (0, 10) and paste the remaining 2 entries -> now clipboard clears!
  const finishRes = engine.pasteBlueprintAt(0, 10);
  assert.equal(finishRes.placedCount, 2);
  assert.equal(finishRes.skippedCount, 0);
  assert.equal(engine.clipboardToolState, 'off', 'Clipboard clears only once all cut buildings are placed');
  assert.equal(engine.getUiSnapshot().clipboard.canUndoCut, false);
});

test('pickupItemsAtTile scoops items from belts, splitters, tunnels, and floor while refreshing inspection', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('splitter', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', 2, 0, 1).ok, true);

  const belt = engine.machines.get(tileKey(0, 0))!;
  belt.beltItems.push(
    { item: 'iron_ore', lane: 0, progress: 0.25 },
    { item: 'copper_plate', lane: 1, progress: 0.55 },
    { item: 'iron_ore', lane: 1, progress: 0.85 }
  );

  // Pin inspection on belt tile before pickup
  const beforeInspect = engine.inspectTileAt(0, 0);
  assert.equal(beforeInspect.machine?.beltItemCount, 3);

  const oreBefore = engine.getPocketItemCount('iron_ore');
  const cuBefore = engine.getPocketItemCount('copper_plate');
  const pickupBelt = engine.pickupItemsAtTile(0, 0);

  assert.equal(pickupBelt.source, 'belt');
  assert.equal(pickupBelt.total, 3);
  assert.equal(belt.beltItems.length, 0, 'All items picked up off belt');
  assert.equal(engine.getPocketItemCount('iron_ore'), oreBefore + 2);
  assert.equal(engine.getPocketItemCount('copper_plate'), cuBefore + 1);
  assert.equal(engine.inspectTileSnapshot(0, 0).machine?.beltItemCount, 0);

  // Splitter and tunnel item pickup
  const splitter = engine.machines.get(tileKey(1, 0))!;
  splitter.beltItems.push({ item: 'iron_gear', lane: 0, progress: 0.4 });
  const pickupSplitter = engine.pickupItemsAtTile(1, 0);
  assert.equal(pickupSplitter.source, 'belt');
  assert.equal(pickupSplitter.total, 1);
  assert.equal(splitter.beltItems.length, 0);

  const tunnel = engine.machines.get(tileKey(2, 0))!;
  tunnel.beltItems.push({ item: 'coal', lane: 1, progress: 0.3 });
  const pickupTunnel = engine.pickupItemsAtTile(2, 0);
  assert.equal(pickupTunnel.source, 'belt');
  assert.equal(pickupTunnel.total, 1);
  assert.equal(tunnel.beltItems.length, 0);

  // Spilled floor item pickup at empty tile (4, 4)
  const makeSpilled = (uid: number, item: string, lx: number, lz: number) => ({
    uid,
    item,
    lx,
    y: 0,
    lz,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vrz: 0,
    squish: 0,
    settled: true,
    ageSec: 0,
  });
  engine.spilledItems.push(
    makeSpilled(901, 'electronic_circuit', 4 * CAPYTORIO_TILE_SIZE, 4 * CAPYTORIO_TILE_SIZE),
    makeSpilled(
      902,
      'electronic_circuit',
      4 * CAPYTORIO_TILE_SIZE + 0.2,
      4 * CAPYTORIO_TILE_SIZE - 0.1
    )
  );
  const floorRes = engine.pickupItemsAtTile(4, 4);
  assert.equal(floorRes.source, 'floor');
  assert.equal(floorRes.total, 2);
  assert.equal(engine.spilledItems.length, 0);
  assert.equal(engine.getPocketItemCount('electronic_circuit'), 2);
});

test('CapytorioPedia resolves machines, variants, ores, trees, beacon, terrain, recipes, and tech links', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  const catalog = buildCapytorioPediaCatalog();
  assert.ok(catalog.length >= 60, `expected rich Capytoriopedia catalog, got ${catalog.length}`);

  // Machine & upgraded variant
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  const beltInspect = engine.inspectTileSnapshot(0, 0);
  assert.equal(resolvePediaIdFromTileInspection(beltInspect), 'belt');

  // Ore seam (locate real factorio-mapgen starter iron_ore tile)
  let ironX = 0;
  let ironZ = 0;
  let foundIronPedia = false;
  for (let x = -48; x <= 48 && !foundIronPedia; x++) {
    for (let z = -48; z <= 48 && !foundIronPedia; z++) {
      if (sampleCapytorioBaseResource(x, z)?.resource === 'iron_ore') {
        ironX = x;
        ironZ = z;
        foundIronPedia = true;
      }
    }
  }
  assert.equal(foundIronPedia, true, 'Found Nauvis iron_ore seam for CapytorioPedia');
  const ironOreInspect = engine.inspectTileSnapshot(ironX, ironZ);
  assert.equal(ironOreInspect.resource?.id, 'iron_ore');
  assert.equal(resolvePediaIdFromTileInspection(ironOreInspect), 'iron_ore');

  // Spilled item on empty tile
  engine.spilledItems.push({
    uid: 903,
    item: 'iron_plate',
    lx: 2 * CAPYTORIO_TILE_SIZE,
    y: 0,
    lz: 2 * CAPYTORIO_TILE_SIZE,
    vx: 0,
    vy: 0,
    vz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    vrx: 0,
    vrz: 0,
    squish: 0,
    settled: true,
    ageSec: 0,
  });
  const spilledInspect = engine.inspectTileSnapshot(2, 2);
  assert.equal(resolvePediaIdFromTileInspection(spilledInspect), 'iron_plate');

  // Surveyor Beacon at (0, -3)
  const beaconInspect = engine.inspectTileSnapshot(0, -3);
  assert.equal(resolvePediaIdFromTileInspection(beaconInspect), 'world:beacon');

  // Clean terrain at (3, 3) (ensure no tree or ore there)
  let cleanGx = 3;
  let cleanGz = 3;
  while (sampleCapytorioBaseResource(cleanGx, cleanGz) || sampleCapytorioTreeAt(cleanGx, cleanGz)) {
    cleanGx++;
  }
  const terrainInspect = engine.inspectTileSnapshot(cleanGx, cleanGz);
  assert.equal(resolvePediaIdFromTileInspection(terrainInspect), 'world:terrain');

  // Find a starter Wild Citrus Tree
  let treeGx: number | null = null;
  let treeGz: number | null = null;
  for (let x = -80; x <= 80 && treeGx === null; x++) {
    for (let z = -80; z <= 80; z++) {
      if (sampleCapytorioTreeAt(x, z) && !sampleCapytorioBaseResource(x, z)) {
        treeGx = x;
        treeGz = z;
        break;
      }
    }
  }
  assert.ok(treeGx !== null && treeGz !== null, 'Found a procedural Wild Citrus Tree');
  const treeInspect = engine.inspectTileSnapshot(treeGx!, treeGz!);
  assert.equal(resolvePediaIdFromTileInspection(treeInspect), 'world:tree');

  // Check recipe & tech cross-links on entries
  const ironPlateEntry = getCapytorioPediaEntry('iron_plate', catalog);
  assert.ok(ironPlateEntry);
  assert.ok(ironPlateEntry.producedByRecipes.length >= 1, 'Iron Plate has smelting recipe');
  assert.ok(ironPlateEntry.usedInRecipes.length >= 3, 'Iron Plate used in multiple downstream recipes');

  const drillEntry = getCapytorioPediaEntry('drill', catalog);
  assert.ok(drillEntry && drillEntry.kind === 'machine');
  assert.ok(drillEntry.buildCost.length >= 2);

  const techEntry = getCapytorioPediaEntry('tech:automation_1', catalog);
  assert.ok(techEntry && techEntry.kind === 'tech');
  assert.ok(techEntry.unlockedRecipesForTech.length >= 1, 'Tech entry lists unlocked recipes');
});

test('Classic multi-tile footprints (3x3, 2x2, 2x1/1x2): O(1) occupancy lookup, collision guard, splitter rotation, and 3-inserter perimeter loading', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // 1. Place 3x3 Assembler at (0,0) -> covers x:0..2, z:0..2
  assert.equal(engine.placeMachine('assembler', 0, 0, 0, 'electronic_circuit').ok, true);
  const asm = engine.machines.get(tileKey(0, 0))!;
  const asmFp = engine.getMachineFootprint(asm);
  assert.equal(asmFp.width, 3);
  assert.equal(asmFp.height, 3);

  // Every sub-tile resolves to the same assembler instance via getMachineAt()
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      assert.equal(engine.getMachineAt(dx, dz), asm, `Sub-tile (${dx},${dz}) resolves to 3x3 assembler`);
    }
  }
  // Collision rejection on any overlapping sub-tile
  assert.equal(engine.placeMachine('belt', 2, 2, 1).ok, false, 'Cannot place belt inside 3x3 sub-tile');
  assert.equal(engine.placeMachine('furnace', 1, 2, 0).ok, false, 'Cannot place 2x2 furnace overlapping 3x3 corner');

  // 2. Perimeter loading: 3 inserters along the West edge (-1,0), (-1,1), (-1,2) all feed into the single 3x3 Assembler!
  assert.equal(engine.placeMachine('chest', -2, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', -2, 1, 1).ok, true);
  assert.equal(engine.placeMachine('chest', -2, 2, 1).ok, true);
  engine.machines.get(tileKey(-2, 0))!.outputBuffer.iron_plate = 4;
  engine.machines.get(tileKey(-2, 1))!.outputBuffer.copper_cable = 6;
  engine.machines.get(tileKey(-2, 2))!.outputBuffer.copper_cable = 6;

  assert.equal(engine.placeMachine('inserter', -1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', -1, 1, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', -1, 2, 1).ok, true);
  // Power generator nearby
  assert.equal(engine.placeMachine('generator', 6, 0, 0).ok, true);
  engine.machines.get(tileKey(6, 0))!.inputBuffer.coal = 4;

  for (let i = 0; i < 160; i++) engine.step(0.05);
  assert.ok(
    (asm.outputBuffer.electronic_circuit ?? 0) >= 1,
    'Multiple side-by-side inserters along 3x3 perimeter feed ingredients into the same assembler'
  );

  // 3. 2x1 Splitter rotates to 1x2 when facing East, and rejects rotation when blocked
  assert.equal(engine.placeMachine('splitter', 0, 6, 0).ok, true); // North -> 2x1: (0,6) & (1,6)
  const sp = engine.machines.get(tileKey(0, 6))!;
  assert.equal(engine.getMachineFootprint(sp).width, 2);
  assert.equal(engine.getMachineFootprint(sp).height, 1);
  assert.equal(engine.getMachineAt(1, 6), sp);
  assert.equal(engine.getMachineAt(0, 7), undefined);

  // Rotate to East (dir=1) -> 1x2: (0,6) & (0,7)
  assert.equal(engine.rotateMachineAt(0, 6), 1);
  assert.equal(engine.getMachineFootprint(sp).width, 1);
  assert.equal(engine.getMachineFootprint(sp).height, 2);
  assert.equal(engine.getMachineAt(0, 7), sp);
  assert.equal(engine.getMachineAt(1, 6), undefined);

  // Block (1,6) with a chest -> rotating back to South (2x1) is rejected cleanly!
  assert.equal(engine.placeMachine('chest', 1, 6, 0).ok, true);
  assert.equal(engine.rotateMachineAt(0, 6), null, '2x1 splitter refuses rotation into occupied tile');
  assert.equal(sp.dir, 1);
});

test('2x1 Splitter Output Filter, Output Priority, and Input Priority route items deterministically', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Place East-facing 1x2 Splitter at (2, 0) -> covers (2,0) [Left] & (2,1) [Right]
  // Inputs: belts at (1,0) & (1,1). Outputs: chests at (3,0) [Left] & (3,1) [Right]
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 1, 1).ok, true);
  assert.equal(engine.placeMachine('splitter', 2, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 3, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 3, 1, 1).ok, true);

  // 1. Output Filter: filter iron_ore to Left output (3,0); all other items strictly go Right (3,1)
  assert.equal(
    engine.setSplitterConfigAt(2, 0, { outputPriority: 'left', filterItem: 'iron_ore' }),
    true
  );

  for (let i = 0; i < 4; i++) {
    engine.machines.get(tileKey(1, 0))!.beltItems.push({ item: 'iron_ore', lane: 0, progress: 0.99 });
    engine.machines.get(tileKey(1, 1))!.beltItems.push({ item: 'copper_ore', lane: 1, progress: 0.99 });
    for (let s = 0; s < 35; s++) engine.step(0.05);
  }

  const leftChest = engine.machines.get(tileKey(3, 0))!;
  const rightChest = engine.machines.get(tileKey(3, 1))!;
  assert.equal(leftChest.outputBuffer.iron_ore ?? 0, 4, 'Filtered iron_ore strictly exits Left');
  assert.equal(leftChest.outputBuffer.copper_ore ?? 0, 0, 'Non-matching copper_ore never enters filtered Left lane');
  assert.equal(rightChest.outputBuffer.copper_ore ?? 0, 4, 'Non-matching copper_ore strictly exits Right');
  assert.equal(rightChest.outputBuffer.iron_ore ?? 0, 0, 'Filtered iron_ore never spills to Right while Left is open');

  // 2. Output Priority (no filter): priority='right' routes everything to Right until full
  leftChest.outputBuffer = {};
  rightChest.outputBuffer = {};
  assert.equal(
    engine.setSplitterConfigAt(2, 0, { outputPriority: 'right', filterItem: null }),
    true
  );
  for (let i = 0; i < 4; i++) {
    engine.machines.get(tileKey(1, 0))!.beltItems.push({ item: 'coal', lane: 0, progress: 0.99 });
    for (let s = 0; s < 35; s++) engine.step(0.05);
  }
  assert.equal(rightChest.outputBuffer.coal ?? 0, 4, 'Output priority Right receives all items when clear');
  assert.equal(leftChest.outputBuffer.coal ?? 0, 0);
});

test('Inserter Whitelist/Blacklist Filters, Stack Size Limit, Long-Handed 2-Tile Reach, and Chest Red-Bar Slot Cap', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();
  assert.equal(engine.placeMachine('generator', 10, 10, 0).ok, true);
  engine.machines.get(tileKey(10, 10))!.inputBuffer.coal = 10;

  // 1. Whitelist Filter + Stack Size Limit
  assert.equal(engine.placeMachine('chest', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 2, 0, 1).ok, true);
  const srcChest = engine.machines.get(tileKey(0, 0))!;
  const dstChest = engine.machines.get(tileKey(2, 0))!;
  srcChest.outputBuffer.iron_ore = 10;
  srcChest.outputBuffer.copper_ore = 10;

  assert.equal(
    engine.setInserterConfigAt(1, 0, { filterMode: 'whitelist', filters: ['copper_ore'], stackLimit: 1 }),
    true
  );
  for (let s = 0; s < 120; s++) engine.step(0.05);
  assert.ok((dstChest.outputBuffer.copper_ore ?? 0) >= 2, 'Whitelisted copper_ore transferred');
  assert.equal(dstChest.outputBuffer.iron_ore ?? 0, 0, 'Non-whitelisted iron_ore ignored');

  // Switch to Blacklist copper_ore -> now moves iron_ore only
  dstChest.outputBuffer = {};
  assert.equal(
    engine.setInserterConfigAt(1, 0, { filterMode: 'blacklist', filters: ['copper_ore'] }),
    true
  );
  for (let s = 0; s < 120; s++) engine.step(0.05);
  assert.ok((dstChest.outputBuffer.iron_ore ?? 0) >= 2, 'Non-blacklisted iron_ore transferred');
  assert.equal(dstChest.outputBuffer.copper_ore ?? 0, 0, 'Blacklisted copper_ore blocked');

  // 2. Long-Handed Inserter true 2-tile reach (skips intermediate belt tiles at x=1 and x=3!)
  engine.addPocketItem('long_handed_inserter', 2);
  assert.equal(engine.placeMachine('chest', 0, 4, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 4, 0).ok, true);
  assert.equal(engine.placeMachine('long_handed_inserter', 2, 4, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 3, 4, 0).ok, true);
  assert.equal(engine.placeMachine('chest', 4, 4, 1).ok, true);

  engine.machines.get(tileKey(0, 4))!.outputBuffer.iron_plate = 6;
  const farDst = engine.machines.get(tileKey(4, 4))!;
  for (let s = 0; s < 120; s++) engine.step(0.05);
  assert.ok(
    (farDst.outputBuffer.iron_plate ?? 0) >= 2,
    'Long-handed inserter reaches 2 tiles behind (0,4) and drops 2 tiles ahead (4,4) over intermediate belts'
  );

  // 3. Chest Red-Bar Slot Limit: 1 slot = 10 items max
  assert.equal(engine.placeMachine('chest', 0, 7, 1).ok, true);
  assert.equal(engine.placeMachine('inserter', 1, 7, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 2, 7, 1).ok, true);
  engine.machines.get(tileKey(0, 7))!.outputBuffer.stone = 50;
  assert.equal(engine.setChestSlotLimitAt(2, 7, 1), true); // 1 slot = 10 items
  const cappedChest = engine.machines.get(tileKey(2, 7))!;

  for (let s = 0; s < 600; s++) engine.step(0.05);
  assert.equal(cappedChest.outputBuffer.stone ?? 0, 10, 'Red-bar 1-slot limit caps chest strictly at 10 items');
});

test('Entity Settings Copy & Paste (Shift+RClick / Shift+LClick) works for assemblers, splitters, inserters, and chests with Undo/Redo', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Assembler recipe copy/paste
  assert.equal(engine.placeMachine('assembler', 0, 0, 0, 'copper_cable').ok, true);
  assert.equal(engine.placeMachine('assembler', 4, 0, 0, 'iron_gear').ok, true);
  const copyAsm = engine.copyEntitySettingsAt(1, 1); // Sub-tile copy
  assert.equal(copyAsm.ok, true);
  const pasteAsm = engine.pasteEntitySettingsAt(5, 1); // Sub-tile paste
  assert.equal(pasteAsm.ok, true);
  assert.equal(engine.machines.get(tileKey(4, 0))?.recipeId, 'copper_cable');

  // Undo reverts pasted settings cleanly
  assert.equal(engine.undoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(4, 0))?.recipeId, 'iron_gear');
  assert.equal(engine.redoLastAction().ok, true);
  assert.equal(engine.machines.get(tileKey(4, 0))?.recipeId, 'copper_cable');

  // Splitter filter & priority copy/paste
  assert.equal(engine.placeMachine('splitter', 0, 5, 0).ok, true);
  assert.equal(engine.placeMachine('splitter', 4, 5, 0).ok, true);
  engine.setSplitterConfigAt(0, 5, {
    inputPriority: 'left',
    outputPriority: 'right',
    filterItem: 'iron_plate',
  });
  assert.equal(engine.copyEntitySettingsAt(0, 5).ok, true);
  assert.equal(engine.pasteEntitySettingsAt(4, 5).ok, true);
  const sp2 = engine.machines.get(tileKey(4, 5))!;
  assert.equal(sp2.splitterInputPriority, 'left');
  assert.equal(sp2.splitterOutputPriority, 'right');
  assert.equal(sp2.splitterFilterItem, 'iron_plate');

  // Chest red-bar slot limit copy/paste
  assert.equal(engine.placeMachine('chest', 0, 8, 0).ok, true);
  assert.equal(engine.placeMachine('chest', 2, 8, 0).ok, true);
  engine.setChestSlotLimitAt(0, 8, 3);
  assert.equal(engine.copyEntitySettingsAt(0, 8).ok, true);
  assert.equal(engine.pasteEntitySettingsAt(2, 8).ok, true);
  assert.equal(engine.machines.get(tileKey(2, 8))?.chestSlotLimit, 3);
});

test('Real-time recursive hand-crafting queue auto-queues intermediates, completes on step(), and refunds 100% on cancel', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Isolate pocket inventory via public hydrate() so automation_science MUST recursively craft iron_gear
  const baseState = engine.serialize();
  baseState.pocketItems = { iron_plate: 20, copper_plate: 10 };
  engine.hydrate(baseState);

  const ironInit = engine.getPocketItemCount('iron_plate');
  const copperInit = engine.getPocketItemCount('copper_plate');
  assert.equal(ironInit, 20);
  assert.equal(copperInit, 10);

  // Queue 1x Automation Science Pack (needs 1 copper_plate + 1 iron_gear; iron_gear needs 2 iron_plate)
  const qRes = engine.enqueuePocketCraft('automation_science', 1);
  assert.equal(qRes.ok, true, 'Recursive craft succeeds using raw iron plates for intermediate gear');
  assert.equal(engine.craftingQueue.length, 2, 'Intermediate iron_gear queued before automation_science');
  assert.equal(engine.craftingQueue[0].resultId, 'iron_gear');
  assert.equal(engine.craftingQueue[1].resultId, 'automation_science');
  assert.equal(engine.getPocketItemCount('iron_plate'), ironInit - 2, '2 iron plates reserved upfront');
  assert.equal(engine.getPocketItemCount('copper_plate'), copperInit - 1, '1 copper plate reserved upfront');

  // Step until queue drains completely
  for (let i = 0; i < 200; i++) engine.step(0.05);
  assert.equal(engine.craftingQueue.length, 0);
  assert.equal(engine.getPocketItemCount('automation_science'), 1, 'Completed science pack added to pocket');
  assert.equal(
    engine.getPocketItemCount('iron_gear'),
    1,
    'Surplus iron_gear (2 yielded - 1 consumed) delivered to pocket with zero loss'
  );

  // Queue 2 independent orders: order #1 reuses the 1 surplus iron_gear (1 queue item),
  // order #2 recursively queues [iron_gear -> automation_science] (2 queue items) = 3 total!
  const ironBefore = engine.getPocketItemCount('iron_plate');
  const copperBefore = engine.getPocketItemCount('copper_plate');
  const q2 = engine.enqueuePocketCraft('automation_science', 2);
  assert.equal(q2.ok, true);
  assert.equal(engine.craftingQueue.length, 3);
  assert.equal(engine.getPocketItemCount('iron_gear'), 0, 'Surplus iron_gear reserved by order #1');
  assert.equal(engine.getPocketItemCount('iron_plate'), ironBefore - 2);
  assert.equal(engine.getPocketItemCount('copper_plate'), copperBefore - 2);

  // Cancel first order (science#1 using 1 gear + 1 copper) -> leaves second order intact
  const cancel1 = engine.cancelCraftQueueItem(engine.craftingQueue[0].uid);
  assert.equal(cancel1.ok, true);
  assert.equal(cancel1.cancelledCount, 1);
  assert.equal(engine.craftingQueue.length, 2);
  assert.equal(engine.getPocketItemCount('iron_gear'), 1, 'Order #1 iron_gear refunded');
  assert.equal(engine.getPocketItemCount('copper_plate'), copperBefore - 1);

  // Cancel second order (gear#2 + science#2) -> queue drains & 100% of raw ingredients are refunded!
  const cancel2 = engine.cancelCraftQueueItem(engine.craftingQueue[0].uid);
  assert.equal(cancel2.ok, true);
  assert.equal(cancel2.cancelledCount, 2);
  assert.equal(engine.craftingQueue.length, 0);
  assert.equal(engine.getPocketItemCount('iron_plate'), ironBefore, '100% iron plates refunded on cancel');
  assert.equal(engine.getPocketItemCount('copper_plate'), copperBefore, '100% copper plates refunded on cancel');
  assert.equal(engine.getPocketItemCount('iron_gear'), 1, 'Original surplus iron_gear preserved');
});

test('Capytorio3DRenderer centers multi-tile models cleanly and syncs Alt-Mode overlay sprites without leaks', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  assert.equal(engine.placeMachine('assembler', 0, 0, 0, 'iron_gear').ok, true);
  assert.equal(engine.placeMachine('furnace', 4, 0, 0).ok, true);
  assert.equal(engine.placeMachine('splitter', 0, 4, 0).ok, true);
  engine.setSplitterConfigAt(0, 4, { outputPriority: 'left', filterItem: 'iron_ore' });

  const renderer = new Capytorio3DRenderer();
  try {
    // Alt-Mode defaults to ON
    assert.equal(engine.altModeEnabled, true);
    renderer.sync(engine, CAPYTORIO_WORLD_ORIGIN_X, CAPYTORIO_WORLD_ORIGIN_Z, 0.016, 1.0, true, 28);

    const altRoot = renderer.root.getObjectByName('CapytorioAltModeRoot');
    assert.ok(altRoot, 'Alt-Mode sprite root exists in 3D scene');
    assert.equal(altRoot.visible, true);
    assert.equal(renderer.hasVisibleAltOverlay(), true, 'Reports visible crisp Alt-Mode overlay');
    assert.ok(altRoot.children.length > 0, 'Alt-Mode sprites pooled');
    const firstSprite = altRoot.children[0] as THREE.Sprite;
    assert.equal(firstSprite.layers.mask, 1 << 2, 'Alt-Mode sprite isolated on Layer 2 (post-PP crisp overlay)');
    assert.equal(firstSprite.material.toneMapped, false, 'Alt-Mode sprite bypasses tone mapping');
    assert.equal(firstSprite.material.fog, false, 'Alt-Mode sprite bypasses atmospheric fog');

    // Toggle Alt-Mode OFF -> hides overlay cleanly
    assert.equal(engine.toggleAltMode(), false);
    renderer.sync(engine, CAPYTORIO_WORLD_ORIGIN_X, CAPYTORIO_WORLD_ORIGIN_Z, 0.016, 1.1, true, 28);
    assert.equal(altRoot.visible, false, 'Alt-Mode overlay hides when toggled OFF');
    assert.equal(renderer.hasVisibleAltOverlay(), false, 'Reports hidden Alt-Mode overlay when toggled OFF');

    // Toggle back ON
    assert.equal(engine.toggleAltMode(), true);
    renderer.sync(engine, CAPYTORIO_WORLD_ORIGIN_X, CAPYTORIO_WORLD_ORIGIN_Z, 0.016, 1.2, true, 28);
    assert.equal(altRoot.visible, true);
    assert.equal(renderer.hasVisibleAltOverlay(), true);
  } finally {
    renderer.dispose();
  }
});

test('Capytorio procedural audio helpers classify placement profiles and scale ambient mix safely', () => {
  assert.equal(selectCapytorioPlacementProfile('belt'), 'belt');
  assert.equal(selectCapytorioPlacementProfile('tunnel'), 'belt');
  assert.equal(selectCapytorioPlacementProfile('splitter'), 'belt');
  assert.equal(selectCapytorioPlacementProfile('inserter'), 'servo');
  assert.equal(selectCapytorioPlacementProfile('chest'), 'crate');
  assert.equal(selectCapytorioPlacementProfile('assembler'), 'heavy');
  assert.equal(selectCapytorioPlacementProfile('furnace'), 'heavy');
  assert.equal(selectCapytorioPlacementProfile('drill'), 'heavy');
  assert.equal(selectCapytorioPlacementProfile('generator'), 'heavy');
  assert.equal(selectCapytorioPlacementProfile('lab'), 'heavy');

  // Ambient mix silences outside Capytorio, when muted, or with zero active machines
  assert.equal(computeCapytorioAmbientMix(12, 1.0, false, false).targetGain, 0);
  assert.equal(computeCapytorioAmbientMix(12, 1.0, true, true).targetGain, 0);
  assert.equal(computeCapytorioAmbientMix(0, 1.0, true, false).targetGain, 0);

  // Active machines smoothly ramp gain & frequency while capping cleanly for large factories
  const small = computeCapytorioAmbientMix(2, 1.0, true, false);
  const large = computeCapytorioAmbientMix(40, 1.0, true, false);
  const brownout = computeCapytorioAmbientMix(10, 0.2, true, false);
  assert.ok(small.targetGain > 0 && small.targetGain < large.targetGain, 'Larger factory produces richer hum');
  assert.ok(large.targetGain <= 0.04, 'Ambient gain stays subtle and non-fatiguing');
  assert.ok(brownout.humHz < large.humHz, 'Low power efficiency drops turbine hum pitch');
  assert.ok(brownout.filterHz < large.filterHz, 'Low power efficiency softens filter cutoff');
});

test('Capytorio3DRenderer builds all 9 upgraded composite archetypes with live mechanical animations', () => {
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();

  // Ensure every archetype has pocket stock available for placement
  const pocket = (engine as unknown as { pocketMachines: Record<string, number> }).pocketMachines;
  for (const mType of ['drill', 'furnace', 'assembler', 'generator', 'lab', 'splitter', 'tunnel', 'chest', 'inserter']) {
    pocket[mType] = Math.max(pocket[mType] ?? 0, 5);
  }

  // Place all remaining 8 composite machine types on non-overlapping guaranteed dry starter clearing coordinates
  const placements: Array<['furnace' | 'assembler' | 'generator' | 'lab' | 'splitter' | 'tunnel' | 'chest' | 'inserter', number, number]> = [
    ['furnace', 1, -2],
    ['assembler', 5, -2],
    ['generator', -4, -2],
    ['lab', -8, -2],
    ['splitter', 0, 3],
    ['tunnel', 3, 3],
    ['chest', 5, 3],
    ['inserter', 7, 3],
  ];
  for (const [type, gx, gz] of placements) {
    assert.equal(engine.placeMachine(type, gx, gz, 0).ok, true, `Placed ${type}`);
  }

  // Locate a nearby ore tile that does not overlap the 8 placed buildings
  let oreGx = 0;
  let oreGz = 0;
  let foundOre = false;
  for (let r = 0; r <= 32 && !foundOre; r++) {
    for (let dx = -r; dx <= r && !foundOre; dx++) {
      for (let dz = -r; dz <= r && !foundOre; dz++) {
        if (engine.findFirstOreInFootprint(dx, dz, 3, 3) && engine.placeMachine('drill', dx, dz, 0).ok) {
          oreGx = dx;
          oreGz = dz;
          foundOre = true;
        }
      }
    }
  }
  assert.equal(foundOre, true, `Found ore patch for drill placement at (${oreGx},${oreGz})`);

  // Activate generator, assembler, lab, and inserter hold state so all sub-parts animate
  const gen = engine.machines.get(tileKey(-4, -2))!;
  gen.fuelTimer = 25;
  const asm = engine.machines.get(tileKey(5, -2))!;
  asm.recipeId = 'iron_gear';
  asm.craftProgress = 0.45;
  const lab = engine.machines.get(tileKey(-8, -2))!;
  lab.craftProgress = 0.5;
  const ins = engine.machines.get(tileKey(7, 3))!;
  ins.holdingItem = 'iron_plate';

  const renderer = new Capytorio3DRenderer();
  try {
    const cx = capytorioGridToWorldX(0);
    const cz = capytorioGridToWorldZ(0);
    renderer.sync(engine, cx, cz, 0.016, 1.0, true, 32);

    const activeGroups = (renderer as unknown as { activeMachineGroups: Map<string, THREE.Group> }).activeMachineGroups;
    const asmGroup = activeGroups.get(tileKey(5, -2))!;
    const labGroup = activeGroups.get(tileKey(-8, -2))!;
    const insGroup = activeGroups.get(tileKey(7, 3))!;
    const genGroup = activeGroups.get(tileKey(-4, -2))!;
    assert.ok(asmGroup.userData.gearA && asmGroup.userData.gearB && asmGroup.userData.pressHead, 'Assembler has meshing gears and stamping press');
    assert.ok(labGroup.userData.labRingA && labGroup.userData.labRingB, 'Lab has dual orbital gyro rings');
    assert.ok(insGroup.userData.jawL && insGroup.userData.jawR, 'Inserter has articulated pneumatic jaws');
    assert.ok(genGroup.userData.flywheel, 'Generator has spoked brass flywheel');

    const gearA0 = (asmGroup.userData.gearA as THREE.Object3D).rotation.y;
    const ringA0 = (labGroup.userData.labRingA as THREE.Object3D).rotation.x;
    const fw0 = (genGroup.userData.flywheel as THREE.Object3D).rotation.x;
    const jawClampedX = (insGroup.userData.jawL as THREE.Object3D).position.x;

    // Release inserter item and advance time -> animations update cleanly
    ins.holdingItem = null;
    renderer.sync(engine, cx, cz, 0.016, 2.25, true, 32);

    assert.notEqual((asmGroup.userData.gearA as THREE.Object3D).rotation.y, gearA0, 'Assembler toothed gear rotates');
    assert.notEqual((labGroup.userData.labRingA as THREE.Object3D).rotation.x, ringA0, 'Lab gyro ring rotates');
    assert.notEqual((genGroup.userData.flywheel as THREE.Object3D).rotation.x, fw0, 'Generator spoked flywheel spins');
    assert.ok(
      Math.abs((insGroup.userData.jawL as THREE.Object3D).position.x) > Math.abs(jawClampedX),
      'Inserter pincer jaws open wider when empty vs clamped on held item'
    );
  } finally {
    renderer.dispose();
  }
});

test('Capytorio terrain generator creates lakes, rivers, and oceans while keeping starter plain dry and guarding water placement', () => {
  // 1. Starter plain (r <= 12.6) is strictly dry buildable land
  for (let gx = -12; gx <= 12; gx++) {
    for (let gz = -12; gz <= 12; gz++) {
      if (Math.hypot(gx, gz) <= 12.6) {
        const detail = sampleCapytorioTerrainDetail(gx, gz);
        assert.equal(detail.isWater, false, `Starter tile (${gx},${gz}) must stay dry`);
      }
    }
  }

  // 2. Scan surrounding Nauvis region (-140..140) and verify authentic Factorio water & biome tiles exist
  const counts: Record<string, number> = {
    lush_grass: 0,
    grass: 0,
    dirt: 0,
    sand: 0,
    red_desert: 0,
    lake: 0,
    ocean: 0,
  };
  let sampleLakeTile: [number, number] | null = null;
  let sampleOceanTile: [number, number] | null = null;
  let sampleSandTile: [number, number] | null = null;

  for (let gx = -140; gx <= 140; gx += 2) {
    for (let gz = -140; gz <= 140; gz += 2) {
      const d = sampleCapytorioTerrainDetail(gx, gz);
      counts[d.type] = (counts[d.type] ?? 0) + 1;
      if (d.isWater) {
        assert.ok(d.elevationY <= -0.2, `Water tile (${gx},${gz}) must recess below water plane`);
        assert.ok(d.waterDepth > 0, `Water tile (${gx},${gz}) must have positive depth`);
        // Zero ores or trees spawn underwater
        assert.equal(sampleCapytorioBaseResource(gx, gz), null, `No ore should spawn underwater at (${gx},${gz})`);
        assert.equal(sampleCapytorioTreeAt(gx, gz), false, `No tree should spawn underwater at (${gx},${gz})`);
      } else if (d.type === 'sand') {
        if (!sampleSandTile) sampleSandTile = [gx, gz];
      }
      if (d.type === 'lake' && !sampleLakeTile) sampleLakeTile = [gx, gz];
      if (d.type === 'ocean' && !sampleOceanTile) sampleOceanTile = [gx, gz];
    }
  }

  assert.ok(counts.grass + counts.lush_grass > 100, 'Expected abundant temperate & lush grass');
  assert.ok(counts.dirt > 100, 'Expected Nauvis dirt tiles');
  assert.ok(counts.sand > 10, 'Expected sandy desert/beach tiles');
  assert.ok(counts.lake > 10, 'Expected inland freshwater water tiles');
  assert.ok(counts.ocean > 50, 'Expected deep water ocean basins');
  assert.ok(sampleLakeTile && sampleOceanTile && sampleSandTile);

  // 3. Water blocks land machines while permitting offshore_pump
  const engine = new CapytorioFactoryEngine();
  engine.addPocketItem('offshore_pump', 2);
  const [lakeX, lakeZ] = sampleLakeTile!;
  const [oceanX, oceanZ] = sampleOceanTile!;
  const [sandX, sandZ] = sampleSandTile!;

  const blockedBelt = engine.placeMachine('belt', lakeX, lakeZ, 0);
  assert.equal(blockedBelt.ok, false, 'Belt cannot be placed on lake water');
  assert.match(blockedBelt.reason ?? '', /water/i);

  const blockedAsm = engine.placeMachine('assembler', oceanX, oceanZ, 0);
  assert.equal(blockedAsm.ok, false, 'Assembler cannot be placed on ocean water');

  const okPump = engine.placeMachine('offshore_pump', lakeX, lakeZ, 0);
  assert.equal(okPump.ok, true, 'Offshore pump can be placed on water');

  // 4. Tile inspection reports accurate hydrology labels
  const lakeInspect = engine.inspectTileSnapshot(lakeX, lakeZ);
  assert.equal(lakeInspect.terrainName, 'Freshwater Lake');
  const oceanInspect = engine.inspectTileSnapshot(oceanX, oceanZ);
  assert.equal(oceanInspect.terrainName, 'Deep Ocean');
  const sandInspect = engine.inspectTileSnapshot(sandX, sandZ);
  assert.equal(sandInspect.terrainName, 'Golden Sand');

  // 5. Capytorio3DRenderer syncs terrain & water decks cleanly across close, strategic, and high-altitude zooms
  const renderer = new Capytorio3DRenderer();
  try {
    const cx = capytorioGridToWorldX(0);
    const cz = capytorioGridToWorldZ(0);
    renderer.sync(engine, cx, cz, 0.016, 1.0, true, 32);
    renderer.sync(engine, cx, cz, 0.016, 2.0, true, 180);
    renderer.sync(engine, cx, cz, 0.016, 3.0, true, 520);
  } finally {
    renderer.dispose();
  }
});

test('Factorio blueprint codec round-trips single 0e... blueprints, settings, multi-tile footprints, and 1.1/2.0 directions', async () => {
  const entries = [
    {
      dx: 0,
      dz: 0,
      baseType: 'assembler' as const,
      toolId: 'assembling_machine_2',
      dir: 1 as const,
      recipeId: 'iron_gear' as const,
    },
    {
      dx: 3,
      dz: 1,
      baseType: 'inserter' as const,
      toolId: 'fast_inserter',
      dir: 2 as const,
      inserterFilterMode: 'blacklist' as const,
      inserterFilters: ['iron_plate' as const, 'electronic_circuit' as const],
      inserterStackLimit: 3,
    },
    {
      dx: 4,
      dz: 0,
      baseType: 'splitter' as const,
      toolId: 'splitter',
      dir: 0 as const,
      splitterInputPriority: 'left' as const,
      splitterOutputPriority: 'right' as const,
      splitterFilterItem: 'copper_plate' as const,
    },
    {
      dx: 4,
      dz: 2,
      baseType: 'chest' as const,
      toolId: 'iron_chest',
      dir: 0 as const,
      chestSlotLimit: 4,
    },
    {
      dx: 6,
      dz: 0,
      baseType: 'drill' as const,
      toolId: 'electric_mining_drill',
      dir: 3 as const,
    },
  ];

  const encoded = await encodeFactorioBlueprintString({
    label: 'Gear Test Module',
    entries,
  });
  assert.ok(encoded.startsWith('0e'), `Expected Factorio 0e... prefix, got ${encoded.slice(0, 6)}`);

  const decoded = await decodeFactorioBlueprintString(encoded);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.kind, 'blueprint');
  assert.equal(decoded.blueprints.length, 1);
  assert.equal(decoded.skippedTotalCount, 0);

  const bp = decoded.blueprints[0];
  assert.equal(bp.label, 'Gear Test Module');
  assert.equal(bp.entries.length, entries.length);

  const asm = bp.entries.find((e) => e.toolId === 'assembling_machine_2');
  assert.ok(asm);
  assert.equal(asm.dx, 0);
  assert.equal(asm.dz, 0);
  assert.equal(asm.dir, 1);
  assert.equal(asm.recipeId, 'iron_gear');

  const ins = bp.entries.find((e) => e.toolId === 'fast_inserter');
  assert.ok(ins);
  assert.equal(ins.dx, 3);
  assert.equal(ins.dz, 1);
  assert.equal(ins.dir, 2);
  assert.equal(ins.inserterFilterMode, 'blacklist');
  assert.deepEqual(ins.inserterFilters, ['iron_plate', 'electronic_circuit']);
  assert.equal(ins.inserterStackLimit, 3);

  const spl = bp.entries.find((e) => e.toolId === 'splitter');
  assert.ok(spl);
  assert.equal(spl.splitterInputPriority, 'left');
  assert.equal(spl.splitterOutputPriority, 'right');
  assert.equal(spl.splitterFilterItem, 'copper_plate');

  const chest = bp.entries.find((e) => e.toolId === 'iron_chest');
  assert.ok(chest);
  assert.equal(chest.chestSlotLimit, 4);

  const drill = bp.entries.find((e) => e.toolId === 'electric_mining_drill');
  assert.ok(drill);
  assert.equal(drill.dx, 6);
  assert.equal(drill.dz, 0);
  assert.equal(drill.dir, 3);

  // Factorio 2.0 raw JSON with 16-way directions (0/4/8/12) and object filters
  const factorio20Json = JSON.stringify({
    blueprint: {
      item: 'blueprint',
      label: 'Factorio 2.0 Belt Line',
      version: 562949958139904,
      entities: [
        { entity_number: 1, name: 'transport-belt', position: { x: 0.5, y: 0.5 }, direction: 4 },
        { entity_number: 2, name: 'transport-belt', position: { x: 1.5, y: 0.5 }, direction: 8 },
        {
          entity_number: 3,
          name: 'fast-inserter',
          position: { x: 2.5, y: 0.5 },
          direction: 12,
          filters: [{ index: 1, name: 'iron-gear-wheel' }],
        },
      ],
    },
  });
  const dec20 = await decodeFactorioBlueprintString(factorio20Json);
  assert.equal(dec20.ok, true);
  assert.equal(dec20.blueprints[0].entries[0].dir, 1);
  assert.equal(dec20.blueprints[0].entries[1].dir, 2);
  assert.equal(dec20.blueprints[0].entries[2].dir, 3);
  assert.deepEqual(dec20.blueprints[0].entries[2].inserterFilters, ['iron_gear']);
});

test('Factorio blueprint import uses exact matches only, warns on skipped entities, and rejects empty/corrupt strings', async () => {
  const mixedPayload = JSON.stringify({
    blueprint: {
      item: 'blueprint',
      label: 'Mixed Vanilla + Modded',
      version: 281479278886912,
      entities: [
        { entity_number: 1, name: 'transport-belt', position: { x: 0.5, y: 0.5 }, direction: 2 },
        { entity_number: 2, name: 'se-space-elevator', position: { x: 4, y: 4 } },
        { entity_number: 3, name: 'bob-beacon-3', position: { x: 6, y: 6 } },
        { entity_number: 4, name: 'bob-beacon-3', position: { x: 8, y: 6 } },
        { entity_number: 5, name: 'kr-crusher', position: { x: 10, y: 6 } },
        {
          entity_number: 6,
          name: 'assembling-machine-1',
          position: { x: 2.5, y: 1.5 },
          recipe: 'electronic-circuit',
        },
      ],
    },
  });

  const engine = new CapytorioFactoryEngine();
  const res = await engine.importFactorioBlueprintString(mixedPayload);
  assert.equal(res.ok, true);
  assert.equal(res.importedEntityCount, 2);
  assert.equal(res.skippedTotalCount, 4);
  assert.equal(res.addedIds.length, 1);
  assert.equal(engine.blueprintLibrary.length, 1);
  assert.equal(engine.blueprintLibrary[0].sourceMode, 'import');
  assert.equal(engine.clipboardToolState, 'paste');

  const skipMap = new Map(res.skippedEntities.map((s) => [s.name, s.count]));
  assert.equal(skipMap.get('bob-beacon-3'), 2);
  assert.equal(skipMap.get('se-space-elevator'), 1);
  assert.equal(skipMap.get('kr-crusher'), 1);

  // 100% unsupported entities returns ok: false with skipped report
  const unsupportedOnly = JSON.stringify({
    blueprint: {
      item: 'blueprint',
      label: 'Modded Only',
      entities: [
        { entity_number: 1, name: 'kr-crusher', position: { x: 0, y: 0 } },
        { entity_number: 2, name: 'se-space-elevator', position: { x: 2, y: 0 } },
      ],
    },
  });
  const failRes = await engine.importFactorioBlueprintString(unsupportedOnly);
  assert.equal(failRes.ok, false);
  assert.equal(failRes.skippedTotalCount, 2);
  assert.match(failRes.error ?? '', /No supported/i);

  // Malformed string returns ok: false
  const badRes = await engine.importFactorioBlueprintString('0eNOT_VALID_BASE64!!!');
  assert.equal(badRes.ok, false);
  assert.ok((badRes.error ?? '').length > 0);
});

test('Factorio Blueprint Book (including nested books) imports every blueprint and exports cleanly', async () => {
  const nestedBookPayload = JSON.stringify({
    blueprint_book: {
      item: 'blueprint-book',
      label: 'Capytorio Master Book',
      active_index: 0,
      version: 281479278886912,
      blueprints: [
        {
          index: 0,
          blueprint: {
            item: 'blueprint',
            label: 'Smelter Pair',
            entities: [
              { entity_number: 1, name: 'stone-furnace', position: { x: 1, y: 1 }, direction: 4 },
              { entity_number: 2, name: 'transport-belt', position: { x: 1.5, y: 2.5 }, direction: 2 },
            ],
          },
        },
        {
          index: 1,
          blueprint_book: {
            item: 'blueprint-book',
            label: 'Nested Logistics',
            blueprints: [
              {
                index: 0,
                blueprint: {
                  item: 'blueprint',
                  label: 'Belt Bus',
                  entities: [
                    { entity_number: 1, name: 'transport-belt', position: { x: 0.5, y: 0.5 }, direction: 2 },
                    { entity_number: 2, name: 'splitter', position: { x: 1.5, y: 1 }, direction: 2 },
                    { entity_number: 3, name: 'kr-crusher', position: { x: 5, y: 5 } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  });

  const engine = new CapytorioFactoryEngine();
  const imported = await engine.importFactorioBlueprintString(nestedBookPayload);
  assert.equal(imported.ok, true);
  assert.equal(imported.kind, 'blueprint_book');
  assert.equal(imported.bookLabel, 'Capytorio Master Book');
  assert.equal(imported.blueprints.length, 2);
  assert.equal(imported.importedEntityCount, 4);
  assert.equal(imported.skippedTotalCount, 1);
  assert.equal(engine.blueprintLibrary.length, 2);
  assert.equal(engine.blueprintLibrary[0].label, 'Smelter Pair');
  assert.equal(engine.blueprintLibrary[1].label, 'Nested Logistics / Belt Bus');

  // Round-trip export of the Blueprint Library as a 0e... Factorio blueprint_book
  const exportedBook = await engine.exportBlueprintLibraryAsFactorioBookString('Exported Capy Book');
  assert.equal(exportedBook.ok, true);
  assert.ok(exportedBook.encoded.startsWith('0e'));
  assert.equal(exportedBook.blueprintCount, 2);
  assert.equal(exportedBook.entityCount, 4);

  const redecoded = await decodeFactorioBlueprintString(exportedBook.encoded);
  assert.equal(redecoded.ok, true);
  assert.equal(redecoded.kind, 'blueprint_book');
  assert.equal(redecoded.bookLabel, 'Exported Capy Book');
  assert.equal(redecoded.blueprints.length, 2);
  assert.equal(redecoded.importedEntityCount, 4);

  // Also test standalone encodeFactorioBlueprintBookString directly
  const preset = createSampleStarterMallBlueprint();
  const directBook = await encodeFactorioBlueprintBookString([preset], 'Preset Book');
  assert.ok(directBook.startsWith('0e'));
  const directDec = await decodeFactorioBlueprintString(directBook);
  assert.equal(directDec.ok, true);
  assert.equal(directDec.kind, 'blueprint_book');
  assert.equal(directDec.blueprints.length, 1);
});

test('Starter Mall sample factory builds cleanly on demand, produces Belts, Inserters & Circuits, exports to 0e..., and rolls back via Undo', async () => {
  const engine = new CapytorioFactoryEngine();
  assert.equal(engine.machines.size, 0, 'Fresh starter world stays blank until user builds sample mall');
  assert.equal(engine.presetBlueprints.length, 1);
  assert.equal(engine.presetBlueprints[0].id, 'preset_starter_mall');

  const expectedCount = getSampleStarterMallAbsoluteEntries().length;
  const built = engine.buildSampleStarterMall();
  assert.equal(built.ok, true);
  assert.equal(built.placedCount, expectedCount, `All ${expectedCount} Starter Mall buildings must place cleanly`);
  assert.equal(engine.machines.size, expectedCount);
  assert.ok(
    engine.powerEfficiency >= 1.0,
    `Starter Mall coal power plant must supply >= 100% power (got ${engine.powerEfficiency})`
  );

  // Step factory simulation forward 120 seconds (480 × 0.25s) and confirm automated outputs
  for (let i = 0; i < 480; i++) {
    engine.step(0.25);
  }

  const beltChest = engine.getMachineAt(-3, 6);
  const inserterChest = engine.getMachineAt(7, 8);
  const circuitChest = engine.getMachineAt(11, 7);
  assert.ok(beltChest && beltChest.type === 'chest', 'Transport Belt output chest exists');
  assert.ok(inserterChest && inserterChest.type === 'chest', 'Inserter output chest exists');
  assert.ok(circuitChest && circuitChest.type === 'chest', 'Electronic Circuit output chest exists');

  const beltsMade = beltChest.outputBuffer.transport_belt ?? 0;
  const insertersMade = inserterChest.outputBuffer.inserter ?? 0;
  const circuitsMade = circuitChest.outputBuffer.electronic_circuit ?? 0;

  assert.ok(beltsMade > 0, `Expected automated transport_belt production, got ${beltsMade}`);
  assert.ok(insertersMade > 0, `Expected automated inserter production, got ${insertersMade}`);
  assert.ok(circuitsMade > 0, `Expected automated electronic_circuit production, got ${circuitsMade}`);

  // Export live Starter Mall factory to Factorio 0e... string and verify round-trip
  const factoryExport = await engine.exportFactoryToFactorioString('Live Starter Mall');
  assert.equal(factoryExport.ok, true);
  assert.ok(factoryExport.encoded.startsWith('0e'));
  assert.equal(factoryExport.entityCount, expectedCount);

  const redecoded = await decodeFactorioBlueprintString(factoryExport.encoded);
  assert.equal(redecoded.ok, true);
  assert.equal(redecoded.importedEntityCount, expectedCount);
  assert.equal(redecoded.skippedTotalCount, 0);

  // Single atomic Undo cleanly reverts the entire Starter Mall
  const undoRes = engine.undoLastAction();
  assert.equal(undoRes.ok, true);
  assert.equal(engine.machines.size, 0, 'Atomic Undo reverts every Starter Mall building cleanly');
});

test('Factorio blueprint decoder enforces 4 MB decompressed byte cap and rejects corrupt deflate streams without unhandled rejections', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    // 1. Craft a tiny compressed zlib payload that inflates to ~4.5 MB (exceeds 4 MB cap)
    const bigPayload = new Uint8Array(4_500_000);
    bigPayload.fill(0x20); // highly compressible ASCII spaces
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    const writeDone = writer.write(bigPayload).then(() => writer.close());
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    await writeDone;
    const compressed = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.byteLength;
    }
    const bombString = '0' + Buffer.from(compressed).toString('base64');

    const bombRes = await decodeFactorioBlueprintString(bombString);
    assert.equal(bombRes.ok, false, 'Oversized compressed payload must be rejected');
    assert.match(bombRes.error ?? '', /4 MB|exceeds maximum/i);

    // 2. Corrupt zlib header/body (valid base64, invalid deflate stream) must reject cleanly with zero unhandled rejections
    const corruptBytes = new Uint8Array([0x78, 0x9c, 0xff, 0xff, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x01]);
    const corruptString = '0' + Buffer.from(corruptBytes).toString('base64');
    const corruptRes = await decodeFactorioBlueprintString(corruptString);
    assert.equal(corruptRes.ok, false, 'Corrupt deflate stream must fail cleanly');
    assert.ok((corruptRes.error ?? '').length > 0);

    // Flush microtask/macrotask turn to ensure no stray unhandled rejection fires
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(unhandled.length, 0, `Expected zero unhandled rejections, got ${unhandled.length}`);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('Capytorio3DRenderer maintains 128x128 tile-exact terrain deck resolution while preserving 320 m world width', () => {
  const renderer = new Capytorio3DRenderer();
  try {
    const groundDeckGeo = (renderer as unknown as { groundDeckGeo: THREE.PlaneGeometry }).groundDeckGeo;
    assert.ok(groundDeckGeo, 'groundDeckGeo exists');
    assert.equal(groundDeckGeo.parameters.widthSegments, 128);
    assert.equal(groundDeckGeo.parameters.heightSegments, 128);
    assert.equal(groundDeckGeo.parameters.width, 320);
    assert.equal(groundDeckGeo.parameters.height, 320);
    assert.equal(groundDeckGeo.attributes.position.count, 129 * 129);
  } finally {
    renderer.dispose();
  }
});

test('100% of CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE entries (including steam_turbine and 10 new infrastructure buildings) have craftable recipes', () => {
  const recipeResults = new Set(CAPYTORIO_RECIPES.map((r) => r.result));
  const missing: string[] = [];
  for (const itemId of Object.keys(CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE)) {
    if (!recipeResults.has(itemId)) {
      missing.push(itemId);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `Expected all placeable buildings to have recipes, missing: ${missing.join(', ')}`
  );
  const turbineRec = RECIPE_BY_ID.get('steam_turbine');
  assert.ok(turbineRec, 'steam_turbine recipe is loaded from recipe.lua');
  assert.equal(
    turbineRec.requiredTechId,
    'production_science',
    'production_science unlocks steam_turbine'
  );
});

test('All 10 new infrastructure buildings place with exact footprints, round-trip through Factorio 0e blueprints, and refund 100% on demolish', async () => {
  const engine = new CapytorioFactoryEngine();
  const newBuildings: Array<{
    id: string;
    expectedW: number;
    expectedH: number;
    factorioName: string;
  }> = [
    { id: 'pipe', expectedW: 1, expectedH: 1, factorioName: 'pipe' },
    { id: 'pipe_to_ground', expectedW: 1, expectedH: 1, factorioName: 'pipe-to-ground' },
    { id: 'pump', expectedW: 1, expectedH: 1, factorioName: 'pump' },
    { id: 'oil_refinery', expectedW: 3, expectedH: 3, factorioName: 'oil-refinery' },
    { id: 'chemical_plant', expectedW: 3, expectedH: 3, factorioName: 'chemical-plant' },
    { id: 'rail', expectedW: 1, expectedH: 1, factorioName: 'straight-rail' },
    { id: 'train_stop', expectedW: 1, expectedH: 1, factorioName: 'train-stop' },
    { id: 'locomotive', expectedW: 1, expectedH: 2, factorioName: 'locomotive' },
    { id: 'cargo_wagon', expectedW: 1, expectedH: 2, factorioName: 'cargo-wagon' },
    { id: 'roboport', expectedW: 3, expectedH: 3, factorioName: 'roboport' },
  ];

  const placedCoords: Array<{ id: string; gx: number; gz: number }> = [];
  let cursorGx = 14;
  for (const spec of newBuildings) {
    engine.addPocketItem(spec.id, 3);
    const fpN = getCapytorioFootprint(
      CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[spec.id].baseType,
      spec.id,
      0
    );
    assert.equal(fpN.width, spec.expectedW, `${spec.id} North width`);
    assert.equal(fpN.height, spec.expectedH, `${spec.id} North height`);

    if (spec.expectedW === 1 && spec.expectedH === 2) {
      const fpE = getCapytorioFootprint(
        CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[spec.id].baseType,
        spec.id,
        1
      );
      assert.equal(fpE.width, 2, `${spec.id} East width`);
      assert.equal(fpE.height, 1, `${spec.id} East height`);
    }

    let placed = false;
    for (let gz = -6; gz <= 20 && !placed; gz += 4) {
      if (engine.canFootprintFit(cursorGx, gz, fpN.width, fpN.height)) {
        const res = engine.placeMachine(spec.id, cursorGx, gz, 0);
        assert.equal(res.ok, true, `Should place ${spec.id} at (${cursorGx}, ${gz})`);
        placedCoords.push({ id: spec.id, gx: cursorGx, gz });
        placed = true;
      }
    }
    assert.equal(placed, true, `Found clear spot for ${spec.id}`);
    cursorGx += 5;
  }

  // Blueprint round-trip of all 10 new buildings
  const rawBlueprint = JSON.stringify({
    blueprint: {
      item: 'blueprint',
      label: 'All 10 Infrastructure Buildings',
      entities: newBuildings.map((b, idx) => ({
        entity_number: idx + 1,
        name: b.factorioName,
        position: { x: idx * 5 + 0.5, y: 0.5 },
        direction: 0,
      })),
    },
  });
  const decoded = await decodeFactorioBlueprintString(rawBlueprint);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.importedEntityCount, 10);
  assert.equal(decoded.skippedTotalCount, 0);
  const reencoded = await encodeFactorioBlueprintString(decoded.blueprints[0]);
  assert.ok(reencoded.startsWith('0e'));
  const roundTripped = await decodeFactorioBlueprintString(reencoded);
  assert.equal(roundTripped.ok, true);
  assert.equal(roundTripped.importedEntityCount, 10);
  assert.deepEqual(
    roundTripped.blueprints[0].entries.map((e) => e.toolId).sort(),
    newBuildings.map((b) => b.id).sort()
  );

  // Demolish all 10 and confirm 100% pocket refund
  for (const p of placedCoords) {
    const before = engine.getPocketItemCount(p.id);
    const demolished = engine.demolishAt(p.gx, p.gz);
    assert.ok(demolished !== null, `Demolish ${p.id}`);
    assert.equal(engine.getPocketItemCount(p.id), before + 1, `100% refund for ${p.id}`);
  }
});

test('Modules socket into machines & beacons with real speed/efficiency/productivity effects, and repair_pack restores integrity + overclock', () => {
  const engine = new CapytorioFactoryEngine();
  engine.addPocketItem('assembling_machine_2', 1);
  engine.addPocketItem('beacon', 1);
  engine.addPocketItem('speed_module', 2);
  engine.addPocketItem('efficiency_module', 1);
  engine.addPocketItem('productivity_module', 1);
  engine.addPocketItem('repair_pack', 2);

  let asmGx = 16;
  let asmGz = 0;
  for (let gx = 12; gx <= 40; gx += 4) {
    if (engine.canFootprintFit(gx, 0, 3, 3) && engine.canFootprintFit(gx + 4, 0, 3, 3)) {
      asmGx = gx;
      asmGz = 0;
      break;
    }
  }
  assert.equal(engine.placeMachine('assembling_machine_2', asmGx, asmGz, 0).ok, true);
  const asm = engine.getMachineAt(asmGx, asmGz)!;
  assert.ok(asm, 'Assembler placed');

  const baseMods = engine.computeMachineModuleModifiers(asm);
  assert.equal(baseMods.speedMult, 1);
  assert.equal(baseMods.powerMult, 1);
  assert.equal(baseMods.prodBonus, 0);

  // Socket 1 speed_module + 1 productivity_module
  assert.equal(engine.installModuleOnMachine(asmGx, asmGz, 'speed_module').ok, true);
  assert.equal(engine.installModuleOnMachine(asmGx, asmGz, 'productivity_module').ok, true);
  assert.equal(engine.getPocketItemCount('speed_module'), 1);
  assert.equal(engine.getPocketItemCount('productivity_module'), 0);
  const modDirect = engine.computeMachineModuleModifiers(asm);
  assert.ok(
    modDirect.speedMult > 1.05,
    `Speed boosted by speed_module (+0.20 - 0.10 = 1.10), got ${modDirect.speedMult}`
  );
  assert.ok(
    modDirect.prodBonus >= 0.1,
    `Productivity boosted by productivity_module, got ${modDirect.prodBonus}`
  );

  // Place nearby Beacon within 6 tiles and socket speed_module -> aura adds half-strength speed
  assert.equal(engine.placeMachine('beacon', asmGx + 4, asmGz, 0).ok, true);
  assert.equal(engine.installModuleOnMachine(asmGx + 4, asmGz, 'speed_module').ok, true);
  const modWithBeacon = engine.computeMachineModuleModifiers(asm);
  assert.ok(
    modWithBeacon.speedMult > modDirect.speedMult + 0.05,
    `Nearby beacon broadcasts speed aura (${modDirect.speedMult} -> ${modWithBeacon.speedMult})`
  );

  // Repair pack restores damaged integrity to 100 and grants 30s +20% tune-up overclock
  assert.equal(engine.damageMachineAt(asmGx, asmGz, 45), 55);
  assert.equal(asm.integrity, 55);
  const repairRes = engine.useRepairPackAt(asmGx, asmGz);
  assert.equal(repairRes.ok, true);
  assert.equal(repairRes.restored, 45);
  assert.equal(asm.integrity, 100);
  assert.ok((asm.overclockTimer ?? 0) >= 29.5);
  assert.equal(engine.getPocketItemCount('repair_pack'), 1);
  const modRepaired = engine.computeMachineModuleModifiers(asm);
  assert.ok(
    modRepaired.speedMult > modWithBeacon.speedMult + 0.15,
    'Repair overclock boosts speed by +20%'
  );

  // Demolishing machine refunds socketed modules too
  const speedBefore = engine.getPocketItemCount('speed_module');
  const prodBefore = engine.getPocketItemCount('productivity_module');
  assert.ok(engine.demolishAt(asmGx, asmGz) !== null);
  assert.equal(engine.getPocketItemCount('speed_module'), speedBefore + 1);
  assert.equal(engine.getPocketItemCount('productivity_module'), prodBefore + 1);
});

test('Capytorio3DRenderer constructs distinct procedural 3D meshes & ghosts for all 29 dedicated variants and calibrates all 16 item shapes at Y = 0', () => {
  const renderer = new Capytorio3DRenderer();
  try {
    const engine = new CapytorioFactoryEngine();
    const internal = renderer as unknown as {
      createCompositeMachineMesh: (type: string, variantItemId?: string) => THREE.Group;
      createGhostMachineGroup: (type: string, variantItemId?: string) => THREE.Group;
      itemGeosByShape: Record<string, THREE.BufferGeometry>;
    };

    // 1. All 29 dedicated building variants produce distinct meshKey groups & transparent ghosts
    assert.equal(DEDICATED_CAPYTORIO_VARIANT_MODELS.size, 29);
    const seenGeoSignatures = new Set<string>();
    for (const variantId of DEDICATED_CAPYTORIO_VARIANT_MODELS) {
      const mapping = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[variantId];
      assert.ok(mapping, `Variant ${variantId} exists in CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE`);
      const grp = internal.createCompositeMachineMesh(mapping.baseType, variantId);
      assert.equal(grp.userData.meshKey, variantId);
      let meshCount = 0;
      const geoUuids: string[] = [];
      grp.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          meshCount++;
          geoUuids.push(n.geometry.uuid);
        }
      });
      assert.ok(
        meshCount >= 2,
        `Variant ${variantId} should compose multiple sub-meshes (got ${meshCount})`
      );
      seenGeoSignatures.add(geoUuids.sort().join(','));

      const ghost = internal.createGhostMachineGroup(mapping.baseType, variantId);
      assert.equal(ghost.userData.meshKey, variantId);
      assert.ok(
        ((ghost.userData.ghostPrimaryMeshes as THREE.Mesh[])?.length ?? 0) +
          ((ghost.userData.ghostAccentMeshes as THREE.Mesh[])?.length ?? 0) >=
          2,
        `Variant ${variantId} ghost converts sub-meshes cleanly`
      );
    }
    assert.equal(
      seenGeoSignatures.size,
      DEDICATED_CAPYTORIO_VARIANT_MODELS.size,
      'Every one of the 29 dedicated variants has a unique procedural geometry signature'
    );

    // 2. Verify live sync() animates roboport hovering drones, radar dish, sentry turret, and steam turbine
    engine.addPocketItem('roboport', 1);
    engine.addPocketItem('logistic_robot', 4);
    engine.addPocketItem('radar', 1);
    engine.addPocketItem('laser_turret', 1);
    engine.addPocketItem('steam_turbine', 1);
    const spots: Array<{ id: string; gx: number; gz: number }> = [];
    let sx = 12;
    for (const vid of ['roboport', 'radar', 'laser_turret', 'steam_turbine']) {
      const fp = getCapytorioFootprint(CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[vid].baseType, vid, 0);
      for (let gz = -4; gz <= 20; gz += 4) {
        if (engine.canFootprintFit(sx, gz, fp.width, fp.height)) {
          if (engine.placeMachine(vid, sx, gz, 0).ok) {
            spots.push({ id: vid, gx: sx, gz });
            break;
          }
        }
      }
      sx += 5;
    }
    assert.equal(spots.length, 4);
    renderer.sync(
      engine,
      capytorioGridToWorldX(18),
      capytorioGridToWorldZ(0),
      1 / 60,
      2.5,
      true,
      40
    );
    const activeMap = (renderer as unknown as { activeMachineGroups: Map<string, THREE.Group> })
      .activeMachineGroups;
    const roboSpot = spots.find((s) => s.id === 'roboport')!;
    const roboGroup = activeMap.get(tileKey(roboSpot.gx, roboSpot.gz));
    assert.ok(roboGroup, 'Roboport synced to activeMachineGroups');
    const drones = roboGroup.userData.roboDrones as THREE.Object3D[];
    assert.equal(drones.length, 6);
    assert.equal(drones.filter((d) => d.visible).length, 4, '4 roboport drones visible with 4 pocket bots');
    // Also verify adding 2 more bots activates all 6 pooled drones
    engine.addPocketItem('construction_robot', 2);
    renderer.sync(
      engine,
      capytorioGridToWorldX(18),
      capytorioGridToWorldZ(0),
      1 / 60,
      2.6,
      true,
      40
    );
    assert.equal(drones.filter((d) => d.visible).length, 6, 'All 6 roboport drones visible with 6 bots');

    // 3. Verify all 16 CAPYTORIO_ITEM_SHAPES geometries exist, are grounded at Y = 0, and fit belt slot pitch
    assert.equal(CAPYTORIO_ITEM_SHAPES.length, 16);
    for (const shape of CAPYTORIO_ITEM_SHAPES) {
      const geo = internal.itemGeosByShape[shape];
      assert.ok(geo instanceof THREE.BufferGeometry, `Geometry exists for item shape ${shape}`);
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      assert.ok(Math.abs(bb.min.y) < 0.01, `Shape ${shape} grounded at Y = 0 (min.y=${bb.min.y})`);
      const sizeX = bb.max.x - bb.min.x;
      const sizeZ = bb.max.z - bb.min.z;
      assert.ok(sizeX <= 0.78, `Shape ${shape} width fits belt lane (sizeX=${sizeX.toFixed(3)})`);
      assert.ok(
        sizeZ >= 0.45 && sizeZ <= 0.72,
        `Shape ${shape} Z pitch calibrated for belt lanes (sizeZ=${sizeZ.toFixed(3)})`
      );
    }

    // 4. Verify non-building curated items never fall back to 'crate' (crate reserved only for packaged buildings)
    const nonBuildingCrates: string[] = [];
    for (const meta of Object.values(CAPYTORIO_ITEM_CATALOG)) {
      const isPackagedBuilding =
        Boolean(CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[meta.id]) || meta.category === 'production';
      if (!isPackagedBuilding && meta.shape === 'crate') {
        nonBuildingCrates.push(meta.id);
      }
    }
    assert.deepEqual(
      nonBuildingCrates,
      [],
      `Non-building items should not use 'crate': ${nonBuildingCrates.join(', ')}`
    );
  } finally {
    renderer.dispose();
  }
});

test('Curved left and right transport belt decks, chassis, and rails have outward/upward CCW triangle winding', () => {
  const renderer = new Capytorio3DRenderer();
  try {
    const internal = renderer as unknown as {
      curvedDeckLeftGeo: THREE.BufferGeometry;
      curvedDeckRightGeo: THREE.BufferGeometry;
      curvedChassisLeftGeo: THREE.BufferGeometry;
      curvedChassisRightGeo: THREE.BufferGeometry;
      curvedRailLeftGeo: THREE.BufferGeometry;
      curvedRailRightGeo: THREE.BufferGeometry;
    };

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const storedNormal = new THREE.Vector3();

    // 1. Both left and right curved decks must have EVERY triangle wound CCW upward (+Y)
    for (const [label, geo] of [
      ['curvedDeckLeftGeo', internal.curvedDeckLeftGeo],
      ['curvedDeckRightGeo', internal.curvedDeckRightGeo],
    ] as const) {
      const pos = geo.getAttribute('position');
      const idx = geo.getIndex()!;
      assert.ok(idx.count >= 28 * 3, `${label} has expected curved deck triangles`);
      for (let i = 0; i < idx.count; i += 3) {
        vA.fromBufferAttribute(pos, idx.getX(i));
        vB.fromBufferAttribute(pos, idx.getX(i + 1));
        vC.fromBufferAttribute(pos, idx.getX(i + 2));
        ab.subVectors(vB, vA);
        ac.subVectors(vC, vA);
        faceNormal.crossVectors(ab, ac);
        assert.ok(
          faceNormal.y > 0,
          `${label} triangle ${i / 3} must face +Y upward (got normal.y=${faceNormal.y})`
        );
      }
    }

    // 2. Curved chassis & rail bands must match their outward vertex normals on every triangle
    for (const [label, geo] of [
      ['curvedChassisLeftGeo', internal.curvedChassisLeftGeo],
      ['curvedChassisRightGeo', internal.curvedChassisRightGeo],
      ['curvedRailLeftGeo', internal.curvedRailLeftGeo],
      ['curvedRailRightGeo', internal.curvedRailRightGeo],
    ] as const) {
      const pos = geo.getAttribute('position');
      const nrm = geo.getAttribute('normal');
      const idx = geo.getIndex()!;
      let signedVolume6 = 0;
      for (let i = 0; i < idx.count; i += 3) {
        const i0 = idx.getX(i);
        const i1 = idx.getX(i + 1);
        const i2 = idx.getX(i + 2);
        vA.fromBufferAttribute(pos, i0);
        vB.fromBufferAttribute(pos, i1);
        vC.fromBufferAttribute(pos, i2);
        ab.subVectors(vB, vA);
        ac.subVectors(vC, vA);
        faceNormal.crossVectors(ab, ac);
        assert.ok(faceNormal.lengthSq() > 1e-10, `${label} triangle ${i / 3} is non-degenerate`);
        faceNormal.normalize();
        storedNormal.fromBufferAttribute(nrm, i0);
        assert.ok(
          faceNormal.dot(storedNormal) > 0.5,
          `${label} triangle ${i / 3} geometric normal must align with outward vertex normal (dot=${faceNormal.dot(storedNormal).toFixed(3)})`
        );
        signedVolume6 += vA.dot(ab.copy(vB).cross(vC));
      }
      assert.ok(
        signedVolume6 > 0,
        `${label} must have strictly positive signed volume (got ${(signedVolume6 / 6).toFixed(4)})`
      );
    }
  } finally {
    renderer.dispose();
  }
});

test('Phase 2: Hand-crafting queue conserves items exactly on surplus, nested intermediate cancel, and mid-batch cancel', () => {
  const engine = new CapytorioFactoryEngine();
  // Drain existing pocket items cleanly using hydrate to an exact controlled state
  engine.hydrate({
    ...engine.serialize(),
    pocketItems: { iron_plate: 10, copper_plate: 10 },
    pocketMachines: {},
    machines: [],
  });

  // 1. Automation science needs 1 copper_plate + 1 iron_gear (iron_gear yields 2 per 2 iron_plate -> 1 surplus iron_gear).
  const qRes = engine.enqueuePocketCraft('automation_science', 1);
  assert.equal(qRes.ok, true);
  assert.equal(engine.getPocketItemCount('iron_plate'), 8, '2 iron_plate reserved for iron_gear batch');
  assert.equal(engine.getPocketItemCount('copper_plate'), 9, '1 copper_plate reserved for automation_science');

  // Complete all queued crafts
  for (let i = 0; i < 120; i++) engine.step(0.1);
  assert.equal(engine.getUiSnapshot().craftingQueue.length, 0);
  assert.equal(engine.getPocketItemCount('automation_science'), 1, '1 automation_science crafted');
  assert.equal(engine.getPocketItemCount('iron_gear'), 1, '1 surplus iron_gear delivered to pocket');
  assert.equal(engine.getPocketItemCount('iron_plate'), 8);
  assert.equal(engine.getPocketItemCount('copper_plate'), 9);

  // 2. Queue 1 Lab machine (needs 4 iron_plate + 2 electronic_circuit -> 2 batches of copper_cable + 2 batches of electronic_circuit),
  // complete 1 of 2 copper_cable batches, then cancel the root -> exact item mass conservation!
  engine.hydrate({
    ...engine.serialize(),
    pocketItems: { iron_plate: 10, copper_plate: 10 },
    pocketMachines: {},
    machines: [],
  });
  assert.equal(engine.enqueueMachineCraft('lab', 1).ok, true);
  // Step 4 x 0.1s = 0.4s (respecting 0.1s dt clamp) to finish 1 of 2 copper_cable batches (0.3s each)
  for (let i = 0; i < 4; i++) engine.step(0.1);
  const rootItem = engine.getUiSnapshot().craftingQueue.find((q) => !q.isIntermediate);
  assert.ok(rootItem, 'Root lab still queued');
  const cancelRes = engine.cancelCraftQueueItem(rootItem!.uid);
  assert.equal(cancelRes.ok, true);
  assert.equal(engine.getUiSnapshot().craftingQueue.length, 0);
  // All iron plates must be 100% refunded; copper must be strictly conserved (10 plates = 20 cable-equivalents)
  assert.equal(engine.getPocketItemCount('iron_plate'), 10, 'Iron plates 100% refunded');
  assert.equal(
    engine.getPocketItemCount('copper_plate') * 2 + engine.getPocketItemCount('copper_cable'),
    20,
    'Copper mass strictly conserved (10 plates = 20 cable-equivalents)'
  );
  assert.equal(engine.getPocketItemCount('copper_cable'), 2, 'Completed intermediate batch refunded as 2 cables');
  assert.equal(engine.getPocketMachineCount('lab'), 0, 'No lab created on cancel');
});

test('Phase 2: feedPocketScienceToLabs completes technology immediately and fires onTechCompleted callback', () => {
  const engine = new CapytorioFactoryEngine();
  engine.selectActiveTech('automation_1');
  const tech = TECH_BY_ID.get('automation_1')!;
  const autoCost = tech.cost.automation_science ?? 10;
  engine.addPocketItem('automation_science', autoCost);
  // Place a functional lab on a dry tile
  engine.hydrate({
    ...engine.serialize(),
    pocketMachines: { ...engine.serialize().pocketMachines, lab: 2 },
  });
  let placed = false;
  for (let gx = 4; gx <= 20 && !placed; gx++) {
    for (let gz = -6; gz <= 10 && !placed; gz++) {
      if (engine.canFootprintFit(gx, gz, 2, 2)) {
        placed = engine.placeMachine('lab', gx, gz, 0).ok;
      }
    }
  }
  assert.equal(placed, true);

  const completed: string[] = [];
  const fed = engine.feedPocketScienceToLabs({
    onTechCompleted: (techId) => completed.push(techId),
  });
  assert.equal(fed, autoCost);
  assert.ok(
    engine.serialize().unlockedTechs.includes('automation_1'),
    'Tech completed immediately without extra step()'
  );
  assert.deepEqual(completed, ['automation_1']);
});

test('Phase 2: Passive variant capabilities reject mismatched operations and report accurate power/status', () => {
  const engine = new CapytorioFactoryEngine();
  const findSpot = (w: number, h: number): [number, number] => {
    for (let gx = 6; gx <= 28; gx++) {
      for (let gz = -12; gz <= 16; gz++) {
        if (engine.canFootprintFit(gx, gz, w, h)) return [gx, gz];
      }
    }
    throw new Error('No dry spot found');
  };

  engine.addPocketItem('stone_wall', 2);
  engine.addPocketItem('gun_turret', 2);
  engine.addPocketItem('solar_panel', 2);
  engine.addPocketItem('beacon', 2);
  engine.addPocketItem('coal', 10);

  const [wx, wz] = findSpot(1, 1);
  assert.equal(engine.placeMachine('stone_wall', wx, wz, 0).ok, true);
  assert.equal(engine.setChestSlotLimitAt(wx, wz, 2), false, 'Stone wall rejects chest slot limit');
  assert.equal(engine.copyEntitySettingsAt(wx, wz).ok, false, 'Stone wall rejects copy settings');
  const wallInfo = engine.inspectTileSnapshot(wx, wz);
  assert.equal(wallInfo.machine?.isStorageChest, false);

  const [tx, tz] = findSpot(1, 1);
  assert.equal(engine.placeMachine('gun_turret', tx, tz, 0).ok, true);
  assert.equal(engine.setInserterConfigAt(tx, tz, { stackLimit: 2 }), false, 'Turret rejects inserter config');
  const turretInfo = engine.inspectTileSnapshot(tx, tz);
  assert.equal(turretInfo.machine?.isFunctionalInserter, false);

  const [sx, sz] = findSpot(2, 2);
  assert.equal(engine.placeMachine('solar_panel', sx, sz, 0).ok, true);
  assert.equal(engine.insertPocketFuelToGenerator(sx, sz), 0, 'Solar panel rejects fuel insertion');
  const solarInfo = engine.inspectTileSnapshot(sx, sz);
  assert.equal(solarInfo.machine?.isFuelGenerator, false);
  assert.equal(solarInfo.machine?.status, 'Working');
  assert.ok((solarInfo.machine?.powerSupplyMw ?? 0) > 0);

  const [bx, bz] = findSpot(2, 2);
  assert.equal(engine.placeMachine('beacon', bx, bz, 0).ok, true);
  const beaconInfo = engine.inspectTileSnapshot(bx, bz);
  assert.equal(beaconInfo.machine?.isResearchLab, false);
  assert.ok((beaconInfo.machine?.powerDemandMw ?? 0) > 0);
});

test('Phase 2: Underground tunnel preserves lane and does not spill from hood when paired exit is full; opposing belts reject head-on merge', () => {
  const engine = new CapytorioFactoryEngine();
  engine.hydrate({
    ...engine.serialize(),
    pocketMachines: { ...engine.serialize().pocketMachines, tunnel: 4, belt: 4 },
  });
  let rowGx = 8;
  let rowGz = 0;
  outer: for (let gz = -10; gz <= 10; gz++) {
    for (let gx = 4; gx <= 20; gx++) {
      if (
        engine.canFootprintFit(gx, gz, 1, 1) &&
        engine.canFootprintFit(gx + 1, gz, 1, 1) &&
        engine.canFootprintFit(gx + 2, gz, 1, 1) &&
        engine.canFootprintFit(gx + 3, gz, 1, 1)
      ) {
        rowGx = gx;
        rowGz = gz;
        break outer;
      }
    }
  }

  // Place East-facing (dir=1) entrance tunnel at (rowGx, rowGz), exit at (rowGx + 2, rowGz),
  // and receiving output belt at (rowGx + 3, rowGz) + a middle belt at (rowGx + 1, rowGz) to prove no front-hood spill
  assert.equal(engine.placeMachine('tunnel', rowGx, rowGz, 1).ok, true);
  assert.equal(engine.placeMachine('belt', rowGx + 1, rowGz, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', rowGx + 2, rowGz, 1).ok, true);
  assert.equal(engine.placeMachine('belt', rowGx + 3, rowGz, 1).ok, true);
  const entry = engine.getMachineAt(rowGx, rowGz)!;
  const middleBelt = engine.getMachineAt(rowGx + 1, rowGz)!;
  const afterExitBelt = engine.getMachineAt(rowGx + 3, rowGz)!;
  // Place a single item on right lane (lane = 1) at entrance
  entry.beltItems.push({ item: 'iron_ore', progress: 0.96, lane: 1 });
  engine.step(0.15);
  assert.equal(afterExitBelt.beltItems.length, 1, 'Item warped through underground tunnel to belt after exit');
  assert.equal(afterExitBelt.beltItems[0].lane, 1, 'Right lane preserved across underground tunnel');
  assert.equal(middleBelt.beltItems.length, 0, 'Middle belt untouched during underground warp');

  // Fill afterExitBelt completely on lane 1 so warp is blocked; item must wait instead of ejecting onto middleBelt!
  for (let i = 0; i < 6; i++) {
    afterExitBelt.beltItems.push({ item: 'copper_ore', progress: 0.05 + i * 0.16, lane: 1 });
  }
  entry.beltItems.push({ item: 'iron_plate', progress: 0.98, lane: 1 });
  engine.step(0.2);
  assert.equal(
    middleBelt.beltItems.length,
    0,
    'Paired entrance tunnel does not spill onto middle tile when exit target is full'
  );
  assert.equal(entry.beltItems.length, 1, 'Blocked item waits safely in entrance tunnel');

  // Opposing head-on belts reject transfer
  const bGx = rowGx;
  const bGz = rowGz + 2;
  if (engine.canFootprintFit(bGx, bGz, 1, 1) && engine.canFootprintFit(bGx + 1, bGz, 1, 1)) {
    assert.equal(engine.placeMachine('belt', bGx, bGz, 1).ok, true); // East
    assert.equal(engine.placeMachine('belt', bGx + 1, bGz, 3).ok, true); // West (head-on)
    const eastBelt = engine.getMachineAt(bGx, bGz)!;
    const westBelt = engine.getMachineAt(bGx + 1, bGz)!;
    eastBelt.beltItems.push({ item: 'coal', progress: 0.99, lane: 0 });
    engine.step(0.2);
    assert.equal(westBelt.beltItems.length, 0, 'Head-on opposing belt rejects incoming item');
  }
});

test('Phase 2: Drag placement allows offshore_pump on water, getUiSnapshot is read-only, and undo preserves modules & checks footprint', () => {
  const engine = new CapytorioFactoryEngine();

  // 1. Offshore pump drag placement on water tile
  let waterSpot: [number, number] | null = null;
  for (let gx = -80; gx <= 80 && !waterSpot; gx++) {
    for (let gz = -80; gz <= 80 && !waterSpot; gz++) {
      if (isCapytorioWaterTerrain(sampleCapytorioTerrain(gx, gz)) && !engine.getMachineAt(gx, gz)) {
        waterSpot = [gx, gz];
      }
    }
  }
  assert.ok(waterSpot, 'Found a water tile on the Capytorio meadow');
  engine.addPocketItem('offshore_pump', 2);
  const dragRes = engine.placeMachineDuringDrag('offshore_pump', waterSpot![0], waterSpot![1], null, null);
  assert.equal(dragRes.ok, true, 'placeMachineDuringDrag succeeds for offshore_pump on water');

  // 2. getUiSnapshot is strictly read-only on milestones and score
  const beforeSer = engine.serialize();
  const scoreBefore = beforeSer.score ?? 0;
  const completedBefore = beforeSer.completedMilestones?.length ?? 0;
  // Give enough iron_plate to trigger an uncompleted milestone if getUiSnapshot were mutating
  engine.addPocketItem('iron_plate', 500);
  engine.getUiSnapshot();
  const afterSer = engine.serialize();
  assert.equal(afterSer.score ?? 0, scoreBefore, 'getUiSnapshot does not mutate score');
  assert.equal(
    afterSer.completedMilestones?.length ?? 0,
    completedBefore,
    'getUiSnapshot does not mutate completedMilestones'
  );

  // 3. Undo/redo preserves socketed modules and machine integrity
  let spot: [number, number] | null = null;
  for (let gx = 6; gx <= 24 && !spot; gx++) {
    for (let gz = -10; gz <= 10 && !spot; gz++) {
      if (engine.canFootprintFit(gx, gz, 2, 2)) spot = [gx, gz];
    }
  }
  assert.ok(spot);
  engine.hydrate({
    ...engine.serialize(),
    pocketMachines: { ...engine.serialize().pocketMachines, assembler: 2 },
  });
  engine.addPocketItem('speed_module', 2);
  assert.equal(engine.placeMachine('assembler', spot![0], spot![1], 0).ok, true);
  assert.equal(engine.installModuleOnMachine(spot![0], spot![1], 'speed_module').ok, true);
  const asm = engine.getMachineAt(spot![0], spot![1])!;
  asm.integrity = 0.72;
  assert.equal(engine.demolishAt(spot![0], spot![1]), 'assembler');
  assert.equal(engine.undoLastAction().ok, true);
  const restored = engine.getMachineAt(spot![0], spot![1])!;
  assert.deepEqual(restored.modules, ['speed_module'], 'Undo restores socketed modules');
  assert.ok(Math.abs((restored.integrity ?? 1) - 0.72) < 1e-6, 'Undo restores machine integrity');
});

test('Phase 2: Save hydration sanitizes corrupted data, Factorio codec pairs tunnels, Lua parser handles concat/index/not, and Pedia matches CapytorioData', async () => {
  // 1. Save hydration sanitization
  const engine = new CapytorioFactoryEngine();
  const sanitized = sanitizeCapytorioState({
    version: 2,
    mapGen: engine.getMapGenConfig(),
    score: Number.NaN,
    techDelivered: -99,
    activeTechId: 'nonexistent_tech',
    machines: [
      {
        id: 1,
        type: 'chest',
        variantItemId: 'solar_panel', // mismatched baseType ('generator' != 'chest')
        gx: 10,
        gz: 0,
        dir: 0,
        tierMult: -5,
        modules: ['speed_module', 'invalid_mod', 'speed_module', 'speed_module', 'speed_module'],
        beltItems: [{ item: 'iron_ore', progress: 99, lane: 0 }],
        inputBuffer: { iron_ore: -10, copper_ore: 3 },
        outputBuffer: { iron_plate: Number.NaN, copper_plate: 2 },
      },
      {
        id: 2,
        type: 'belt',
        gx: 10,
        gz: 0, // overlapping footprint with machine 1!
        dir: 1,
      },
    ],
  });
  assert.ok(sanitized);
  engine.hydrate(sanitized!);
  assert.equal(engine.serialize().techDelivered.red_science ?? 0, 0, 'Negative techDelivered sanitized');
  assert.equal(engine.machines.size, 1, 'Overlapping duplicate machine skipped during hydration');
  const hydrated = engine.getMachineAt(10, 0)!;
  assert.equal(hydrated.variantItemId, undefined, 'Mismatched variantItemId cleared');
  assert.equal(hydrated.tierMult, 1, 'Invalid negative tierMult clamped');
  assert.equal(hydrated.modules?.length ?? 0, 0, 'Chest has 0 module slots so invalid modules stripped');
  assert.equal(hydrated.beltItems[0].progress, 1, 'Belt progress clamped to [0, 1]');
  assert.equal(hydrated.inputBuffer.iron_ore, undefined, 'Negative inputBuffer entry dropped');
  assert.equal(hydrated.inputBuffer.copper_ore, 3);
  assert.equal(hydrated.outputBuffer.copper_plate, 2);

  // 2. Factorio Blueprint Codec tunnel input/output pairing
  const encoded = await encodeFactorioBlueprintString({
    label: 'Tunnel Pair Test',
    entries: [
      { toolId: 'tunnel', baseType: 'tunnel', dx: 0, dz: 0, dir: 1 },
      { toolId: 'tunnel', baseType: 'tunnel', dx: 3, dz: 0, dir: 1 },
    ],
  });
  const decoded = await decodeFactorioBlueprintString(encoded);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.blueprints[0].entries.length, 2);

  // 3. Lua parser: concatenation, bracket indexing, unary not, and 1..2 tokenization
  const parsed = parseCapytorioLuaCatalog(
    `
    data:extend({
      {
        type = "recipe",
        name = "test-" .. "widget-" .. 1..2,
        energy_required = 1.5,
        enabled = not false,
        ingredients = { { type = "item", name = "iron-plate", amount = 2 } },
        results = { { type = "item", name = "test-" .. "widget-" .. 1..2, amount = 1 } }
      }
    })
    `,
    `data:extend({})`
  );
  const widgetRecipe = parsed.recipes.find((r) => r.id === 'test_widget_12');
  assert.ok(widgetRecipe, 'Parsed recipe name with .. string concat and 1..2 numeric concat');
  assert.equal(widgetRecipe!.unlockedByDefault, true, 'enabled = not false keeps recipe unlocked');

  // 4. CapytorioPedia derives module, beacon, and fuel text from CapytorioData constants
  const speedEntry = getCapytorioPediaEntry('speed_module');
  assert.ok(speedEntry);
  assert.ok(
    speedEntry.description.includes(`+${Math.round(CAPYTORIO_MODULE_EFFECTS.speed_module.speedDelta * 100)}%`),
    'Pedia speed_module description matches CAPYTORIO_MODULE_EFFECTS'
  );
  const beaconEntry = getCapytorioPediaEntry('beacon');
  assert.ok(beaconEntry);
  assert.ok(
    beaconEntry.description.includes(`within ${CAPYTORIO_BEACON_SPEC.rangeTiles} tiles`),
    'Pedia beacon description matches CAPYTORIO_BEACON_SPEC'
  );
  const coalEntry = getCapytorioPediaEntry('coal');
  assert.ok(coalEntry);
  const coalFuelStat = coalEntry.stats.find((s) => s.label === 'Fuel');
  assert.ok(
    coalFuelStat?.value.includes(`${CAPYTORIO_FUEL_BURN_SECONDS.coal.toFixed(1)}s burn`),
    'Pedia coal Fuel stat matches CAPYTORIO_FUEL_BURN_SECONDS'
  );
});

test('Capytorio3DRenderer.dispose() disposes every InstancedMesh GPU buffer and HUD integrity uses 0..100 scale', () => {
  const renderer = new Capytorio3DRenderer();
  const instancedMeshes: THREE.InstancedMesh[] = [];
  renderer.root.traverse((obj) => {
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      instancedMeshes.push(obj as THREE.InstancedMesh);
    }
  });
  assert.ok(instancedMeshes.length >= 20, `Expected >=20 InstancedMesh objects, found ${instancedMeshes.length}`);

  let disposedCount = 0;
  for (const inst of instancedMeshes) {
    const origDispose = inst.dispose.bind(inst);
    inst.dispose = () => {
      disposedCount += 1;
      return origDispose();
    };
  }

  renderer.dispose();
  assert.equal(
    disposedCount,
    instancedMeshes.length,
    'Every InstancedMesh under Capytorio3DRenderer.root must have .dispose() called'
  );
  assert.equal(renderer.root.children.length, 0, 'Capytorio3DRenderer.root cleared after dispose');

  const hudSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/capygame/components/CapytorioHud.tsx'),
    'utf8'
  );
  assert.ok(
    hudSrc.includes('{Math.round(inspectedTile.machine.integrity ?? 100)}%'),
    'CapytorioHud renders machine.integrity directly on 0..100 scale'
  );
  assert.ok(
    !hudSrc.includes('(inspectedTile.machine.integrity ?? 1) * 100'),
    'CapytorioHud must not multiply 0..100 integrity by 100'
  );
  assert.ok(
    hudSrc.includes('30s +20% speed overclock'),
    'Repair button tooltip matches 30s overclock duration in useRepairPackAt()'
  );
});

test('Capytorio Copy/Cut/Paste movement: pointer routing, blueprint footprint hit-testing, and ghost tracking while moving', () => {
  // 1. Pure pointer gesture router allows moving without cancelling copy/cut/paste
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: false,
    }),
    'paste_tap_or_move',
    'Dragging outside the blueprint ghost in Paste mode allows moving while quick tap snaps ghost'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: true,
      pointerType: 'mouse',
      hasLockedPasteAnchor: true,
    }),
    'position_blueprint',
    'Dragging directly on a locked blueprint ghost repositions the ghost'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: true,
      pointerType: 'mouse',
      hasLockedPasteAnchor: false,
    }),
    'paste_tap_or_move',
    'Desktop mouse press with an unlocked hover-following ghost allows tap-to-lock or drag-to-move'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: true,
      pointerType: 'touch',
      hasLockedPasteAnchor: false,
    }),
    'position_blueprint',
    'Touch drag directly on an unlocked ghost still slides the ghost'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: true,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: true,
    }),
    'clipboard_move',
    'Explicit Move toggle always routes pointer drags to movement even over the ghost'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'select_copy',
      selectionShape: 'box',
      button: 0,
      clipboardMoveMode: true,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: false,
    }),
    'clipboard_move',
    'Move toggle also lets players walk before box-selecting in Copy mode'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'paste',
      selectionShape: 'box',
      button: 2,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: true,
    }),
    'clipboard_move',
    'Right-click drag moves during Paste mode'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'select_cut',
      selectionShape: 'lasso',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: true,
      hitInsideBlueprintGhost: false,
    }),
    'clipboard_move',
    'Space + Left-drag moves during Cut lasso mode'
  );
  assert.equal(
    resolveCapytorioClipboardPointerAction({
      clipState: 'select_copy',
      selectionShape: 'lasso',
      button: 0,
      clipboardMoveMode: false,
      isSpaceHeld: false,
      hitInsideBlueprintGhost: false,
    }),
    'select_lasso',
    'Normal drag in Copy lasso mode still performs lasso selection'
  );

  // 2. Blueprint footprint hit-test & ghost tracking during hero movement
  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);
  const copied = engine.selectMachinesInBox(0, 0, 1, 0);
  engine.captureBlueprint(copied, 'copy');
  assert.equal(engine.clipboardToolState, 'paste');
  assert.equal(engine.pasteAnchor, null);

  // Position ghost at (2, 2)
  engine.setBlueprintAnchor(2, 2);
  assert.equal(engine.isTileInsideActiveBlueprint(2, 2, 0), true, 'Origin tile hits ghost footprint');
  assert.equal(engine.isTileInsideActiveBlueprint(10, 10, 0), false, 'Distant ground is outside ghost footprint');
  assert.equal(engine.isTileInsideActiveBlueprint(2, 3, 1), true, 'Padding=1 expands touch hit region by 1 tile');

  // Stepping slightly aside (< 10 tiles) keeps locked pasteAnchor intact
  engine.syncPasteGhostForHeroMovement(5, 5, 5, 5, 10);
  assert.deepEqual(engine.pasteAnchor, { gx: 2, gz: 2 }, 'Short step preserves locked anchor');

  // Walking far across the factory (> 10 tiles) auto-unlocks stale pasteAnchor & brings ghost along
  const moved = engine.syncPasteGhostForHeroMovement(20, 18, 22, 19, 10);
  assert.equal(moved, true);
  assert.equal(engine.pasteAnchor, null, 'Walking far unlocks stale pasteAnchor');
  assert.equal(engine.hoveredGx, 22, 'Ghost tracks re-projected pointer tile as player moves');
  assert.equal(engine.hoveredGz, 19);

  // When no mouse pointer is hovering (touch/keyboard-only), ghost follows hero tile
  engine.syncPasteGhostForHeroMovement(26, 24, null, null, 10);
  assert.equal(engine.hoveredGx, 26);
  assert.equal(engine.hoveredGz, 24);
});

test('Capytorio satin metal PBR calibration and icon-only Alt-Mode badge resolution', () => {
  const renderer = new Capytorio3DRenderer();
  try {
    const pbr = renderer.getPbrCalibrationSummary();
    assert.ok(pbr.steelDarkRoughness >= 0.65, 'Dark steel uses satin-matte industrial roughness');
    assert.ok(pbr.steelLightRoughness >= 0.5, 'Light steel avoids mirror-like sky glare');
    assert.ok(pbr.steelLightEnvMapIntensity <= 0.55, 'Light steel clamps sky IBL reflections');
    assert.ok(pbr.brassRoughness >= 0.44, 'Brass gears use brushed satin roughness');
    assert.ok(pbr.copperRoughness >= 0.44, 'Copper coils use brushed satin roughness');
  } finally {
    renderer.dispose();
  }

  // Verify icon renderer never draws canvas text labels in Alt-Mode badges
  const iconRendererSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/capygame/engine/CapytorioAltIconRenderer.ts'),
    'utf8'
  );
  assert.equal(iconRendererSrc.includes('fillText('), false, 'Alt-Mode badge renderer draws zero fillText');
  assert.equal(iconRendererSrc.includes('strokeText('), false, 'Alt-Mode badge renderer draws zero strokeText');

  const engine = new CapytorioFactoryEngine();
  engine.resetToBlankStarterField();
  // Power the grid so operational machines display crafting/item icons instead of no-power warning
  assert.equal(engine.placeMachine('generator', -6, -6, 0).ok, true);
  const gen = engine.getMachineAt(-6, -6);
  assert.ok(gen);
  gen.fuelTimer = 60;
  engine.step(0.1);

  assert.equal(engine.placeMachine('assembler', 0, 0, 0, 'iron_gear').ok, true);
  assert.equal(engine.placeMachine('assembler', 4, 0, 0, 'transport_belt').ok, true);
  assert.equal(engine.placeMachine('furnace', 8, 0, 0).ok, true);
  const furn = engine.getMachineAt(8, 0);
  assert.ok(furn);
  furn.outputBuffer.copper_plate = 2;

  assert.equal(engine.placeMachine('inserter', 0, 4, 0).ok, true);
  engine.setInserterConfigAt(0, 4, { filters: ['iron_plate'], filterMode: 'blacklist' });

  const spec: CapytorioAltBadgeSpec = {
    key: '',
    iconKind: 'item',
    itemShape: 'ore',
    machineType: '',
    variantItemId: '',
    accentCss: '#ffffff',
    warn: false,
    blacklist: false,
  };

  // Assembler crafting intermediate item -> item shape icon ('gear')
  const asmGear = engine.getMachineAt(0, 0)!;
  assert.equal(populateCapytorioAltBadgeSpec(engine, asmGear, spec), true);
  assert.equal(spec.iconKind, 'item');
  assert.equal(spec.itemShape, 'gear');
  assert.equal(spec.warn, false);

  // Assembler crafting placeable building -> machine icon ('belt')
  const asmBelt = engine.getMachineAt(4, 0)!;
  assert.equal(populateCapytorioAltBadgeSpec(engine, asmBelt, spec), true);
  assert.equal(spec.iconKind, 'machine');
  assert.equal(spec.machineType, 'belt');
  assert.equal(spec.variantItemId, 'transport_belt');

  // Furnace smelting copper plates -> item shape icon ('plate')
  assert.equal(populateCapytorioAltBadgeSpec(engine, furn, spec), true);
  assert.equal(spec.iconKind, 'item');
  assert.equal(spec.itemShape, 'plate');

  // Blacklisted filter inserter -> item icon + blacklist flag
  const ins = engine.getMachineAt(0, 4)!;
  assert.equal(populateCapytorioAltBadgeSpec(engine, ins, spec), true);
  assert.equal(spec.iconKind, 'item');
  assert.equal(spec.itemShape, 'plate');
  assert.equal(spec.blacklist, true);

  // Unpowered assembler -> warn_power alert icon
  engine.powerEfficiency = 0;
  assert.equal(populateCapytorioAltBadgeSpec(engine, asmGear, spec), true);
  assert.equal(spec.iconKind, 'warn_power');
  assert.equal(spec.warn, true);
});



