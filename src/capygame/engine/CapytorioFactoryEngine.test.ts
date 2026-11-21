import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BELT_CURVE_INNER_ARC_M,
  BELT_CURVE_OUTER_ARC_M,
  CapytorioFactoryEngine,
  MAX_RECENT_CAPYTORIO_TOOLS,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
  evalBeltItemLocalPose,
  getBeltCurveShape,
  getBeltLaneArcMeters,
  resolveCapytorioPlaceableSpec,
  sampleCapytorioBaseResource,
  sampleCapytorioTreeAt,
  sanitizeCapytorioState,
  tileKey,
  worldToCapytorioGridX,
  worldToCapytorioGridZ,
} from './CapytorioFactoryEngine';
import {
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  CAPYTORIO_TILE_SIZE,
  CAPYTORIO_WORLD_ORIGIN_X,
  CAPYTORIO_WORLD_ORIGIN_Z,
  RECIPE_BY_ID,
  TECH_BY_ID,
  applyCapytorioLuaSources,
  getCapytorioItemMeta,
  getCapytorioSmeltSpec,
} from './CapytorioData';
import { parseCapytorioLuaCatalog } from './CapytorioLuaParser';

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

  // Center landing tile is clean build ground
  assert.equal(sampleCapytorioBaseResource(0, 0), null);
  assert.equal(sampleCapytorioBaseResource(-5, -5)?.resource, 'iron_ore');
  assert.equal(sampleCapytorioBaseResource(5, -5)?.resource, 'copper_ore');
  assert.equal(sampleCapytorioBaseResource(-5, 5)?.resource, 'coal');
  assert.equal(sampleCapytorioBaseResource(4, 5)?.resource, 'calcite');
  assert.equal(sampleCapytorioBaseResource(9, 4)?.resource, 'yuzu_sap');
});

test('Capytorio provides infinite unbounded procedural ore chunks far from origin', () => {
  let foundFarChunkOre = false;
  for (let gx = 160; gx <= 240; gx++) {
    for (let gz = -40; gz <= 40; gz++) {
      const sample = sampleCapytorioBaseResource(gx, gz);
      if (sample) {
        foundFarChunkOre = true;
        assert.ok(sample.initialAmount >= 400);
        break;
      }
    }
    if (foundFarChunkOre) break;
  }
  assert.equal(foundFarChunkOre, true, 'far away 16x16 chunks should contain procedural ore seams');

  const engine = new CapytorioFactoryEngine();
  // Verify machines can be placed arbitrarily far across the far hemisphere without clamping
  const beltFar = engine.placeMachine('belt', 250, -180, 1);
  assert.equal(beltFar.ok, true);
  assert.equal(worldToCapytorioGridX(capytorioGridToWorldX(250)), 250);
  assert.equal(worldToCapytorioGridZ(capytorioGridToWorldZ(-180)), -180);
  assert.equal(capytorioGridToWorldX(0), CAPYTORIO_WORLD_ORIGIN_X);
  assert.equal(capytorioGridToWorldZ(0), CAPYTORIO_WORLD_ORIGIN_Z);
});

test('Capytorio hand-mining, full Drill -> Belt -> Furnace -> Chest automation, and 100% demolish refund', () => {
  const engine = new CapytorioFactoryEngine();
  // Locate exact starter iron ore tile
  let oreGx = -5;
  let oreGz = -5;
  assert.equal(engine.getResourceAt(oreGx, oreGz)?.resource, 'iron_ore');

  const mined = engine.handMineAt(oreGx, oreGz, 3);
  assert.equal(mined, 'iron_ore');
  assert.equal(engine.getPocketItemCount('iron_ore'), 3);

  // Drill on non-ore tile fails gracefully with helpful message
  const badDrill = engine.placeMachine('drill', 0, 0, 1);
  assert.equal(badDrill.ok, false);

  // Build Drill at (-5,-5) facing East (+X) -> Belt (-4,-5) -> Belt (-3,-5) -> Furnace (-2,-5) -> Chest (-1,-5)
  assert.equal(engine.placeMachine('drill', -5, -5, 1).ok, true);
  assert.equal(engine.placeMachine('belt', -4, -5, 1).ok, true);
  assert.equal(engine.placeMachine('belt', -3, -5, 1).ok, true);
  assert.equal(engine.placeMachine('furnace', -2, -5, 1).ok, true);
  assert.equal(engine.placeMachine('chest', -1, -5, 1).ok, true);
  assert.equal(engine.placeMachine('generator', 0, -4, 1).ok, true);

  // Clicking an existing belt rotates it instead of erroring
  const rotateRes = engine.placeMachine('belt', -4, -5, 1);
  assert.equal(rotateRes.ok, true);
  assert.equal(rotateRes.machine?.dir, 2);
  // Rotate 3 more times back to East (1)
  engine.rotateMachineAt(-4, -5);
  engine.rotateMachineAt(-4, -5);
  engine.rotateMachineAt(-4, -5);
  assert.equal(engine.machines.get(tileKey(-4, -5))?.dir, 1);

  // Simulate 16 seconds of factory execution
  for (let i = 0; i < 320; i++) {
    engine.step(0.05);
  }

  const chest = engine.machines.get(tileKey(-1, -5));
  assert.ok(chest, 'chest exists');
  assert.ok((chest.outputBuffer.iron_plate ?? 0) >= 1, 'smelted iron plates arrived in chest');
  assert.ok(engine.getTotalProduced() >= 2);
  assert.ok(engine.getScore() > 50);

  // Auto-collect nearby chest empties plates into pocket
  const collected = engine.collectFromNearbyChestsAndOutputs(
    (-1) * CAPYTORIO_TILE_SIZE,
    (-5) * CAPYTORIO_TILE_SIZE
  );
  assert.ok(collected >= 1);
  assert.ok(engine.getPocketItemCount('iron_plate') > 24);

  // Demolish returns the furnace to pocket cleanly
  const prevFurnaces = engine.getPocketMachineCount('furnace');
  assert.equal(engine.demolishAt(-2, -5), 'furnace');
  assert.equal(engine.getPocketMachineCount('furnace'), prevFurnaces + 1);
});

test('Capytorio Splitters, Underground Tunnels, Smart Inserters, Labs & Tech Unlock', () => {
  const engine = new CapytorioFactoryEngine();
  const completedTechs: string[] = [];

  // Test Splitter round-robin & Tunnel jump across 3 tiles
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', 1, 0, 1).ok, true);
  assert.equal(engine.placeMachine('tunnel', 4, 0, 1).ok, true);
  assert.equal(engine.placeMachine('splitter', 5, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 6, 0, 1).ok, true);
  assert.equal(engine.placeMachine('chest', 5, -1, 0).ok, true);
  assert.equal(engine.placeMachine('chest', 5, 1, 2).ok, true);

  // Seed 6 copper ores onto belt (0,0) and step
  for (let n = 0; n < 6; n++) {
    const startBelt = engine.machines.get(tileKey(0, 0))!;
    startBelt.beltItems.push({ item: 'copper_ore', progress: 0.99 });
    for (let s = 0; s < 30; s++) {
      engine.step(0.05);
    }
  }
  const cE = engine.machines.get(tileKey(6, 0))!.outputBuffer.copper_ore ?? 0;
  const cN = engine.machines.get(tileKey(5, -1))!.outputBuffer.copper_ore ?? 0;
  const cS = engine.machines.get(tileKey(5, 1))!.outputBuffer.copper_ore ?? 0;
  assert.equal(cE + cN + cS, 6, 'all items jumped tunnel and split evenly');
  assert.ok(cE >= 1 && cN >= 1 && cS >= 1, 'round-robin splitter hits all 3 outputs');

  // Power with Generator + Coal so Assembler + Inserter + Lab run at full efficiency
  assert.equal(engine.placeMachine('generator', -2, 3, 1).ok, true);
  engine.machines.get(tileKey(-2, 3))!.inputBuffer.coal = 4;

  // Test Assembler -> Inserter -> Lab -> Automation I completion
  assert.equal(engine.placeMachine('assembler', -1, 3, 1, 'automation_science').ok, true);
  const asm = engine.machines.get(tileKey(-1, 3))!;
  asm.inputBuffer.copper_plate = 8;
  asm.inputBuffer.iron_gear = 8;

  // Inserter picking from Assembler (-1,3) into Lab (1,3)
  assert.equal(engine.placeMachine('inserter', 0, 3, 1).ok, true);
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

  // 3. Place Assembler with 'copper_cable', test Smart Pipette [Q], manual Load Inputs [F], & Take Outputs
  assert.equal(engine.placeMachine('assembler', 6, 0, 2, 'copper_cable').ok, true);
  engine.selectedTool = 'mine';
  const pick = engine.pipetteAt(6, 0);
  assert.equal(pick.picked, true);
  assert.equal(pick.tool, 'assembler');
  assert.equal(engine.selectedRecipeId, 'copper_cable');

  const emptyPick = engine.pipetteAt(99, 99);
  assert.equal(emptyPick.picked, false);
  assert.equal(engine.selectedTool, 'mine');

  const movedIn = engine.insertPocketInputsForMachine(6, 0, 2);
  assert.equal(movedIn, 2);
  for (let i = 0; i < 60; i++) engine.step(0.05);
  const takenOut = engine.takeMachineOutputsToPocket(6, 0);
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

  // Locate a deterministic citrus tree around the meadow
  let treeGx = 0;
  let treeGz = 0;
  let found = false;
  for (let gx = -24; gx <= 24 && !found; gx++) {
    for (let gz = -24; gz <= 24 && !found; gz++) {
      if (sampleCapytorioTreeAt(gx, gz)) {
        treeGx = gx;
        treeGz = gz;
        found = true;
      }
    }
  }
  assert.equal(found, true, 'expected deterministic citrus trees in meadow');
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

  // Place a drill on starter iron (-5,-5) & test tree auto-harvest on building placement + zero-coin milestone callback
  assert.equal(engine.placeMachine('drill', -5, -5, 1).ok, true);
  let treeGx2 = 0;
  let treeGz2 = 0;
  let found2 = false;
  for (let gx = -24; gx <= 24 && !found2; gx++) {
    for (let gz = -24; gz <= 24 && !found2; gz++) {
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

test('Capytorio belt items squish up tightly when backed up and stay on belt when beltEndSpillEnabled is false (default)', () => {
  const engine = new CapytorioFactoryEngine();
  assert.equal(engine.beltEndSpillEnabled, false, 'Belt end item spill must be disabled by default');

  // 2-tile straight belt East: (0,0) -> (1,0) with open end at (1,0)
  assert.equal(engine.placeMachine('belt', 0, 0, 1).ok, true);
  assert.equal(engine.placeMachine('belt', 1, 0, 1).ok, true);

  const b0 = engine.machines.get(tileKey(0, 0))!;
  const b1 = engine.machines.get(tileKey(1, 0))!;
  b1.beltItems.push({ item: 'iron_ore', progress: 0.92, lane: 0 });
  b1.beltItems.push({ item: 'iron_ore', progress: 0.45, lane: 0 });
  b0.beltItems.push({ item: 'iron_ore', progress: 0.85, lane: 0 });

  for (let i = 0; i < 30; i++) {
    engine.step(0.05);
  }

  // With spill disabled by default, all 3 items squish tightly onto the end belt and ZERO spill onto ground
  assert.equal(engine.spilledItems.length, 0);
  assert.equal(b1.beltItems.length, 3, 'Squish compression packs up to 3 items in a single congested lane');
  assert.ok((b1.beltItems[0].squish ?? 0) > 0.7, 'Leading backed-up item exhibits high squish');
  assert.ok((b1.beltItems[1].squish ?? 0) > 0.5, 'Trailing backed-up item exhibits squish');
  assert.equal(b1.beltItems[0].edgeProgress ?? 0, 0, 'No edge overhang when spill is disabled');
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




