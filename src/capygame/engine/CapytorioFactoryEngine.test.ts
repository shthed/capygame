import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CapytorioFactoryEngine,
  MAX_RECENT_CAPYTORIO_TOOLS,
  capytorioGridToWorldX,
  capytorioGridToWorldZ,
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

