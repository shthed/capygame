import {
  CAPYTORIO_BEACON_SPEC,
  CAPYTORIO_FUEL_BURN_SECONDS,
  CAPYTORIO_HOTBAR_ORDER,
  CAPYTORIO_ITEM_CATALOG,
  CAPYTORIO_MACHINE_SPECS,
  CAPYTORIO_MODULE_EFFECTS,
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
  CAPYTORIO_RECIPES,
  CAPYTORIO_TECHS,
  TECH_BY_ID,
  getCapytorioItemMeta,
  getCapytorioMachineBasePowerDemandMw,
  resolveCapytorioItemShape,
  type CapytorioItemShape,
  type CapytorioMachineType,
  type CapytorioRecipeSpec,
  type CapytorioTechSpec,
} from './CapytorioData';
import type { CapytorioTileInspection } from './CapytorioFactoryEngine';

export type CapytorioPediaCategory =
  | 'buildings'
  | 'resources'
  | 'intermediates'
  | 'logistics'
  | 'science'
  | 'tech'
  | 'world';

export type CapytorioPediaIcon =
  | { kind: 'machine'; machineType: CapytorioMachineType; variantItemId?: string; color: string }
  | { kind: 'item'; shape: CapytorioItemShape; color: string }
  | { kind: 'world'; worldKind: 'tree' | 'beacon' | 'terrain' }
  | { kind: 'tech'; color: string };

export interface CapytorioPediaStat {
  label: string;
  value: string;
}

export interface CapytorioPediaEntry {
  id: string;
  kind: 'machine' | 'item' | 'tech' | 'world';
  title: string;
  shortName: string;
  subtitle: string;
  category: CapytorioPediaCategory;
  categoryLabel: string;
  description: string;
  sourceSummary: string;
  tips: string[];
  stats: CapytorioPediaStat[];
  icon: CapytorioPediaIcon;
  placeableToolId?: string;
  machineBaseType?: CapytorioMachineType;
  itemId?: string;
  techId?: string;
  buildCost: Array<{ item: string; count: number }>;
  producedByRecipes: CapytorioRecipeSpec[];
  usedInRecipes: CapytorioRecipeSpec[];
  stationRecipes: CapytorioRecipeSpec[];
  unlockedByTechs: CapytorioTechSpec[];
  usedAsTechCostIn: CapytorioTechSpec[];
  unlockedRecipesForTech: CapytorioRecipeSpec[];
  techPrerequisites: CapytorioTechSpec[];
  searchText: string;
}

const MACHINE_PRIMARY_ITEM_ALIAS: Record<CapytorioMachineType, string[]> = {
  drill: ['burner_mining_drill', 'electric_mining_drill'],
  belt: ['transport_belt'],
  inserter: ['inserter'],
  furnace: ['stone_furnace', 'steel_furnace', 'electric_furnace'],
  assembler: ['assembling_machine_1', 'assembling_machine_2', 'assembling_machine_3'],
  generator: ['boiler', 'steam_engine'],
  lab: ['lab'],
  splitter: ['splitter'],
  tunnel: ['underground_belt'],
  chest: ['wooden_chest', 'iron_chest'],
};

const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  iron_ore:
    'Primary metallic ore found in starter and outer deposits. Smelt in a Furnace to produce Iron Plates.',
  copper_ore:
    'Warm orange ore seam essential for Copper Plates, Electronic Circuits, Copper Cable, and Science Packs.',
  coal:
    'Combustible black mineral seam. Burns cleanly inside Steam Generators and combines with Crude Oil into Plastic Bars.',
  stone:
    'Quarry mineral used for Stone Furnaces, Stone Bricks, Concrete foundations, Rail tracks, Sulfur, and defensive walls.',
  crude_oil:
    'Pressurized dark hydrocarbon well clusters outside the starting area. Extract with a Pumpjack to refine Solid Fuel, Plastic, and Sulfur.',
  uranium_ore:
    'Luminous radioactive ore veins outside the starting area. Mine with Electric Drills and enrich in a Centrifuge for Nuclear Fuel Cells.',
  uranium_235:
    'Enriched fissile isotope produced by Uranium Enrichment in a Centrifuge for fabricating Uranium Fuel Cells.',
  uranium_fuel_cell:
    'High-density nuclear fuel assembly delivering 60s of sustained generator power per cell.',
  yuzu_sap:
    'Golden citrus extract crafted from harvested Fresh Oranges. Serves as a renewable biofuel and bio-science reagent.',
  orange:
    'Fresh citrus harvested from Wild Citrus Trees [E]. Burns inside Steam Generators as renewable bio-fuel.',
};

const VARIANT_DESCRIPTIONS: Record<string, string> = {
  pumpjack: 'Heavy 3×3 nodding-donkey derrick placed directly over Crude Oil wells to pump continuous Crude Oil onto your logistics network.',
  centrifuge: 'High-speed 3×3 isotopic enrichment plant that refines mined Uranium Ore into fissile Uranium-235 and Uranium Fuel Cells.',
  pipe: 'Pressurized industrial fluid conduit connecting offshore pumps, boilers, refineries, and chemical plants.',
  pipe_to_ground: 'Subterranean fluid conduit elbow that routes pipelines cleanly underneath belt buses and rail yards.',
  pump: 'High-pressure inline impeller booster pump that regulates and accelerates pipeline flow.',
  oil_refinery: 'Heavy 3×3 fractional distillation complex with cracking towers and flare stack for processing fuels and chemical intermediates.',
  chemical_plant: 'Dual-chamber 3×3 chemical synthesis plant for plastic bars, sulfur, batteries, explosives, and solid fuel.',
  rail: 'Standard-gauge steel track segment on timber sleepers for building industrial Capytorio rail corridors.',
  train_stop: 'Automated railway station beacon and signal mast that marks loading and unloading zones along rail lines.',
  locomotive: 'Heavy 1×2 diesel-electric Capytorio rail engine aligned with track sleepers, featuring dual roof radiator fans and a high-capacity freight bay.',
  cargo_wagon: 'Armored 1×2 railway freight car built to haul bulk plates, circuits, and ore shipments along rail corridors.',
  roboport: '3×3 autonomous robotics hangar that launches hovering Logistic and Construction Robots to support factory automation.',
  steam_turbine: 'High-output 3×3 multi-stage steam turbine generator paired with nuclear reactors and high-temperature steam loops.',
  solar_panel: 'Clean 3×3 photovoltaic collector array delivering steady zero-fuel power to your factory grid.',
  accumulator: 'High-voltage 2×2 capacitor bank that buffers surplus electrical power and stabilizes peak demand.',
  nuclear_reactor: 'Containment-shielded 3×3 Cherenkov reactor core producing massive industrial grid power.',
  beacon: `3×3 module transmission tower that broadcasts +${Math.round(CAPYTORIO_BEACON_SPEC.baseSpeedBonus * 100)}% base speed plus ${Math.round(CAPYTORIO_BEACON_SPEC.transmissionEfficiency * 100)}% of socketed Speed and Efficiency module bonuses to nearby machines within ${CAPYTORIO_BEACON_SPEC.rangeTiles} tiles.`,
  radar: '3×3 rotating long-range reconnaissance dish that continuously scans surrounding factory sectors.',
  rocket_silo: '3×3 orbital launch bay with gantry arms and blast doors for assembling and launching the Capytorio Rocket.',
  offshore_pump: 'Shoreline intake pump placed on coastal water tiles to supply cooling water to steam boilers and refineries.',
  substation: '2×2 high-voltage transformer bay distributing power cleanly across wide factory blocks.',
  stone_wall: 'Reinforced beveled masonry fortification block for securing factory perimeters.',
  gate: 'Armored retractable blast gate that integrates seamlessly into Stone Wall defensive lines.',
  gun_turret: 'Automated sentry plinth with twin rotating autocannons for perimeter defense.',
  laser_turret: 'High-energy ruby crystal emitter turret on an armored gimbal pedestal.',
  speed_module: `Socketable machine upgrade that boosts crafting and mining speed by +${Math.round(CAPYTORIO_MODULE_EFFECTS.speed_module.speedDelta * 100)}% (with +${Math.round(CAPYTORIO_MODULE_EFFECTS.speed_module.powerDelta * 100)}% power draw).`,
  speed_module_2: `Tier-2 socketable upgrade boosting machine speed by +${Math.round(CAPYTORIO_MODULE_EFFECTS.speed_module_2.speedDelta * 100)}% (with +${Math.round(CAPYTORIO_MODULE_EFFECTS.speed_module_2.powerDelta * 100)}% power draw).`,
  efficiency_module: `Socketable machine upgrade that reduces electrical power draw by ${Math.round(CAPYTORIO_MODULE_EFFECTS.efficiency_module.powerDelta * 100)}% (down to a 20% floor).`,
  efficiency_module_2: `Tier-2 socketable upgrade reducing electrical power draw by ${Math.round(CAPYTORIO_MODULE_EFFECTS.efficiency_module_2.powerDelta * 100)}% (down to a 20% floor).`,
  productivity_module: `Socketable machine upgrade adding +${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module.prodDelta * 100)}% bonus output cycles (with ${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module.speedDelta * 100)}% speed and +${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module.powerDelta * 100)}% power draw).`,
  productivity_module_2: `Tier-2 socketable upgrade adding +${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module_2.prodDelta * 100)}% bonus output cycles (with ${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module_2.speedDelta * 100)}% speed and +${Math.round(CAPYTORIO_MODULE_EFFECTS.productivity_module_2.powerDelta * 100)}% power draw).`,
  repair_pack: 'Field maintenance toolkit that restores damaged structures to 100% integrity and grants a 30s +20% tune-up speed boost.',
};

const MACHINE_TIPS: Record<CapytorioMachineType, string[]> = {
  drill: [
    'Place directly on top of an Ore Seam tile. Its chute points toward the orange direction arrow.',
    'Press [R] while hovering or inspecting to rotate its output chute into a Belt, Furnace, or Chest.',
    'If no belt or chest is in front, mined ore outputs to the drill buffer.',
  ],
  belt: [
    'Automatically bends smoothly into curved corners when belts feed sideways into another belt.',
    'Press [E] (or click Pick up in the top-right info box) to scoop carried items right off the belt.',
    'Your Capybara glides faster when walking along belt direction arrows!',
  ],
  inserter: [
    'Picks up items from the tile directly BEHIND the arrow and drops them onto the tile IN FRONT.',
    'Smart Inserters only load ingredients that the target Furnace, Assembler, or Lab actually accepts.',
    'Press [R] to reverse or rotate pickup/drop direction cleanly.',
  ],
  furnace: [
    'Automatically detects smeltable ores loaded by hand [F], Inserters, or directly from Mining Drills.',
    'Outputs Iron Plate, Copper Plate, Steel, Brick, and any smelting recipe from recipe.lua.',
    'Connect an Inserter pointing out into a belt or Supply Chest so smelting never stalls at 20.',
  ],
  assembler: [
    'Open [Inspect / Click] to assign any unlocked crafting recipe from Logistics, Intermediates, Combat, or Science.',
    'Upgrade to Assembling Machine 2 or 3 for faster crafting throughput.',
    'Feed ingredients from belts via Smart Inserters or press [F] to quick-load from your pocket.',
  ],
  generator: [
    'Supplies 1.5 MW idle trickle and surges to 6.0 MW when burning Coal, Fresh Orange, or Yuzu Sap.',
    'Keep grid efficiency at 100% — brownouts slow down Drills, Furnaces, Assemblers, Inserters, and Labs.',
    'Use an Inserter from a Coal belt or press [F] / Feed Fuel inside the Inspector.',
  ],
  lab: [
    'Consumes automated Science Packs to advance the active Technology in the Tech Tree.',
    'You can also press Feed Sci inside Inventory or Tech panels to upload pocket Science Packs.',
    'Completing Technologies unlocks new recipes and awards permanent DNA + Coins.',
  ],
  splitter: [
    'Accepts items from incoming belts and alternates output evenly across Front, Left, and Right adjacent belts.',
    'Great for feeding a Copper + Iron bus into multiple Assembler lanes without bottlenecks.',
  ],
  tunnel: [
    'Pair two Underground Tunnels facing the same direction (up to 6 tiles apart) to pass items beneath other lines.',
    'Press [E] to scoop items cached inside a tunnel tile.',
  ],
  chest: [
    'Stores up to 120 finished items buffered from belts, drills, or inserters.',
    'Walking close to a Supply Chest automatically collects stored products straight into your pocket.',
  ],
};

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function getCategoryLabel(cat: CapytorioPediaCategory): string {
  switch (cat) {
    case 'buildings':
      return 'Buildings';
    case 'resources':
      return 'Ores & Flora';
    case 'intermediates':
      return 'Plates & Parts';
    case 'logistics':
      return 'Logistics';
    case 'science':
      return 'Science & Rocket';
    case 'tech':
      return 'Technology';
    case 'world':
    default:
      return 'World & Terrain';
  }
}

function mapItemCategoryToPedia(itemId: string, itemCat: string): CapytorioPediaCategory {
  if (CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[itemId]) {
    const mapped = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[itemId];
    if (
      mapped.baseType === 'belt' ||
      mapped.baseType === 'splitter' ||
      mapped.baseType === 'tunnel' ||
      mapped.baseType === 'inserter'
    ) {
      return 'logistics';
    }
    return 'buildings';
  }
  if (itemCat === 'ore' || itemId === 'orange') return 'resources';
  if (itemCat === 'science' || itemCat === 'rocket') return 'science';
  if (itemCat === 'logistics') return 'logistics';
  if (itemCat === 'production') return 'buildings';
  return 'intermediates';
}

function buildFuelSummary(id: string): string | null {
  if (id === 'coal') return `Generator Fuel (6.0 MW surge · ${CAPYTORIO_FUEL_BURN_SECONDS.coal.toFixed(1)}s burn)`;
  if (id === 'yuzu_sap') return `Bio-Fuel (6.0 MW surge · ${CAPYTORIO_FUEL_BURN_SECONDS.yuzu_sap.toFixed(1)}s burn)`;
  if (id === 'orange') return `Citrus Bio-Fuel (6.0 MW surge · ${CAPYTORIO_FUEL_BURN_SECONDS.orange.toFixed(1)}s burn)`;
  return null;
}

export function resolvePediaIdFromTileInspection(info: CapytorioTileInspection): string {
  if (info.machine) {
    return info.machine.variantItemId ?? info.machine.type;
  }
  if (info.spilledItems.length > 0) {
    return info.spilledItems[0].item;
  }
  if (info.tree) {
    return 'world:tree';
  }
  if (info.resource) {
    return info.resource.id;
  }
  if (info.isBeacon) {
    return 'world:beacon';
  }
  return 'world:terrain';
}

function buildWorldEntries(): CapytorioPediaEntry[] {
  const orangeRecipes = CAPYTORIO_RECIPES.filter((r) =>
    r.ingredients.some((i) => i.item === 'orange')
  );
  return [
    {
      id: 'world:tree',
      kind: 'world',
      title: 'Wild Citrus Tree',
      shortName: 'Citrus Tree',
      subtitle: 'Harvestable Meadow Flora',
      category: 'world',
      categoryLabel: 'World & Terrain',
      description:
        'A fruit-bearing Capybara grove tree scattered across starter and procedural chunks. Harvesting yields Fresh Oranges that burn cleanly inside Coal Steam Generators.',
      sourceSummary: 'Grows naturally across procedural meadow chunks',
      tips: [
        'Press [E] near a Wild Citrus Tree or click Chop in the Inspector to harvest +3 Fresh Oranges.',
        'Trees clear space for expanding belts and Assemblers while fueling early-game power.',
      ],
      stats: [
        { label: 'Yield', value: '+3 Fresh Orange' },
        { label: 'Fuel Value', value: '6.0 MW Steam Surge' },
        { label: 'Controls', value: '[E] or Click to Chop' },
      ],
      icon: { kind: 'world', worldKind: 'tree' },
      buildCost: [],
      producedByRecipes: [],
      usedInRecipes: orangeRecipes,
      stationRecipes: [],
      unlockedByTechs: [],
      usedAsTechCostIn: [],
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: 'world:tree wild citrus tree orange harvest chop flora wood fuel',
    },
    {
      id: 'world:beacon',
      kind: 'world',
      title: 'Surveyor Beacon',
      shortName: 'Survey Beacon',
      subtitle: 'Drop-Pod Landing Landmark',
      category: 'world',
      categoryLabel: 'World & Terrain',
      description:
        'Your Orbital Drop-Pod landing marker at origin (0, -3). Provides a permanent spatial anchor as your automated factory expands outward across infinite chunks.',
      sourceSummary: 'Anchored at Capytorio Base Origin (0, -3)',
      tips: [
        'Press [H] anytime while walking or building to warp your Capybara straight back to the Surveyor Beacon.',
        'Use surrounding clear meadow tiles as your main Bus and Rocket Silo hub.',
      ],
      stats: [
        { label: 'Coordinates', value: '(0, -3)' },
        { label: 'Fast Return', value: 'Hotkey [H]' },
        { label: 'Terrain', value: 'Indestructible Landmark' },
      ],
      icon: { kind: 'world', worldKind: 'beacon' },
      buildCost: [],
      producedByRecipes: [],
      usedInRecipes: [],
      stationRecipes: [],
      unlockedByTechs: [],
      usedAsTechCostIn: [],
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: 'world:beacon surveyor beacon home warp landing landmark origin',
    },
    {
      id: 'world:terrain',
      kind: 'world',
      title: 'Meadow Grass',
      shortName: 'Meadow Grass',
      subtitle: 'Buildable Factory Terrain',
      category: 'world',
      categoryLabel: 'World & Terrain',
      description:
        'Firm, unobstructed 2.5m × 2.5m factory grid tiles ready for Belts, Inserters, Foundries, Assemblers, Power Generators, and Blueprint stamps.',
      sourceSummary: 'Infinite procedural 16×16 terrain chunks',
      tips: [
        'Drag across empty Meadow Grass tiles with Belts or Machines selected to build continuous lines.',
        'Use [Ctrl+C] / [Ctrl+X] Box or Lasso selection to copy layouts and stamp them anywhere with ghosts.',
        'Alt + Left-Click any machine, belt, ore seam, or tree to jump straight to its Capytoriopedia page.',
      ],
      stats: [
        { label: 'Tile Grid', value: '2.5 m × 2.5 m' },
        { label: 'Chunk Size', value: '16 × 16 tiles' },
        { label: 'Buildable', value: 'Yes (all non-ore structures)' },
      ],
      icon: { kind: 'world', worldKind: 'terrain' },
      buildCost: [],
      producedByRecipes: [],
      usedInRecipes: [],
      stationRecipes: [],
      unlockedByTechs: [],
      usedAsTechCostIn: [],
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: 'world:terrain meadow grass ground floor grid buildable tile',
    },
  ];
}

export function buildCapytorioPediaCatalog(): CapytorioPediaEntry[] {
  const entries: CapytorioPediaEntry[] = [];
  const seenIds = new Set<string>();

  // Pre-index recipes by result, ingredient, station, and tech
  const recipesByResult = new Map<string, CapytorioRecipeSpec[]>();
  const recipesByIngredient = new Map<string, CapytorioRecipeSpec[]>();
  const recipesByStation = new Map<string, CapytorioRecipeSpec[]>();
  const recipesByTech = new Map<string, CapytorioRecipeSpec[]>();

  for (let i = 0; i < CAPYTORIO_RECIPES.length; i++) {
    const r = CAPYTORIO_RECIPES[i];
    const resList = recipesByResult.get(r.result) ?? [];
    resList.push(r);
    recipesByResult.set(r.result, resList);

    const stList = recipesByStation.get(r.station) ?? [];
    stList.push(r);
    recipesByStation.set(r.station, stList);

    if (r.requiredTechId) {
      const tList = recipesByTech.get(r.requiredTechId) ?? [];
      tList.push(r);
      recipesByTech.set(r.requiredTechId, tList);
    }

    for (let j = 0; j < r.ingredients.length; j++) {
      const ingId = r.ingredients[j].item;
      const ingList = recipesByIngredient.get(ingId) ?? [];
      if (!ingList.includes(r)) {
        ingList.push(r);
        recipesByIngredient.set(ingId, ingList);
      }
    }
  }

  const techCostUsersByItem = new Map<string, CapytorioTechSpec[]>();
  for (let i = 0; i < CAPYTORIO_TECHS.length; i++) {
    const tech = CAPYTORIO_TECHS[i];
    for (const [itemId, amt] of Object.entries(tech.cost)) {
      if ((amt ?? 0) > 0) {
        const list = techCostUsersByItem.get(itemId) ?? [];
        list.push(tech);
        techCostUsersByItem.set(itemId, list);
      }
    }
  }

  const collectUnlockTechs = (recipes: CapytorioRecipeSpec[]): CapytorioTechSpec[] => {
    const techSet = new Set<CapytorioTechSpec>();
    for (let i = 0; i < recipes.length; i++) {
      const tid = recipes[i].requiredTechId;
      if (tid) {
        const t = TECH_BY_ID.get(tid);
        if (t) techSet.add(t);
      }
    }
    return Array.from(techSet);
  };

  // 1. Base starter machines (hotbar order)
  for (const mType of CAPYTORIO_HOTBAR_ORDER) {
    const spec = CAPYTORIO_MACHINE_SPECS[mType];
    const aliases = MACHINE_PRIMARY_ITEM_ALIAS[mType] ?? [mType];
    const producedSet = new Set<CapytorioRecipeSpec>();
    const usedSet = new Set<CapytorioRecipeSpec>();
    for (const a of aliases) {
      for (const r of recipesByResult.get(a) ?? []) producedSet.add(r);
      for (const r of recipesByIngredient.get(a) ?? []) usedSet.add(r);
    }
    for (const r of recipesByResult.get(mType) ?? []) producedSet.add(r);
    for (const r of recipesByIngredient.get(mType) ?? []) usedSet.add(r);

    const producedByRecipes = Array.from(producedSet);
    const usedInRecipes = Array.from(usedSet);
    const stationRecipes =
      mType === 'furnace' || mType === 'assembler'
        ? (recipesByStation.get(mType) ?? []).slice(0, 24)
        : [];

    const stats: CapytorioPediaStat[] = [
      { label: 'Hotkey', value: `[${spec.hotkey}]` },
      {
        label: 'Power',
        value:
          spec.powerSupplyMw > 0
            ? `+${spec.powerSupplyMw.toFixed(1)} MW (Surge)`
            : spec.powerDemandMw > 0
              ? `-${spec.powerDemandMw.toFixed(2)} MW`
              : '0 MW (Passive)',
      },
      { label: 'Starter Kit', value: `×${spec.starterCount}` },
    ];
    if (mType === 'belt' || mType === 'splitter' || mType === 'tunnel') {
      stats.push({ label: 'Belt Lanes', value: '2 lanes (8 items/tile)' });
    }
    if (mType === 'chest') {
      stats.push({ label: 'Capacity', value: '120 items' });
    }

    const buildCost = Object.entries(spec.craftCost)
      .filter(([, cnt]) => (cnt ?? 0) > 0)
      .map(([item, count]) => ({ item, count: count ?? 1 }));

    const cat: CapytorioPediaCategory =
      mType === 'belt' || mType === 'inserter' || mType === 'splitter' || mType === 'tunnel'
        ? 'logistics'
        : 'buildings';

    const unlockedByTechs = collectUnlockTechs(producedByRecipes);
    entries.push({
      id: mType,
      kind: 'machine',
      title: spec.name,
      shortName: spec.shortName,
      subtitle: `${getCategoryLabel(cat)} · Starter Building`,
      category: cat,
      categoryLabel: getCategoryLabel(cat),
      description: spec.description,
      sourceSummary: 'Craft in Workbench [Buildings] or place from Starter Quickbar',
      tips: [
        ...(MACHINE_TIPS[mType] ?? []),
        'Press [Q] while hovering a built machine to pipette it into hand, or [X] to demolish & refund 100%.',
      ],
      stats,
      icon: { kind: 'machine', machineType: mType, color: hexToCss(spec.colorHex) },
      placeableToolId: mType,
      machineBaseType: mType,
      buildCost,
      producedByRecipes,
      usedInRecipes,
      stationRecipes,
      unlockedByTechs,
      usedAsTechCostIn: techCostUsersByItem.get(mType) ?? [],
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: `${mType} ${spec.name} ${spec.shortName} ${spec.description} ${aliases.join(' ')}`.toLowerCase(),
    });
    seenIds.add(mType);
  }

  // 2. All items & upgraded placeables from CAPYTORIO_ITEM_CATALOG
  for (const meta of Object.values(CAPYTORIO_ITEM_CATALOG)) {
    if (seenIds.has(meta.id)) continue;
    const placeable = CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE[meta.id];
    const baseSpec = placeable ? CAPYTORIO_MACHINE_SPECS[placeable.baseType] : null;
    const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
    const cat = mapItemCategoryToPedia(meta.id, meta.category);

    const producedByRecipes = recipesByResult.get(meta.id) ?? [];
    const usedInRecipes = recipesByIngredient.get(meta.id) ?? [];
    const unlockedByTechs = collectUnlockTechs(producedByRecipes);
    const usedAsTechCostIn = techCostUsersByItem.get(meta.id) ?? [];

    const stats: CapytorioPediaStat[] = [
      { label: 'Category', value: getCategoryLabel(cat) },
    ];
    let description = '';
    let sourceSummary = 'Crafted in Assembling Machine / Pocket';
    const tips: string[] = [];

    if (placeable && baseSpec) {
      description =
        VARIANT_DESCRIPTIONS[meta.id] ??
        `${meta.name} is a ${placeable.tierMult.toFixed(2)}× tier ${baseSpec.name}. ${baseSpec.description}`;
      sourceSummary =
        producedByRecipes.length > 0
          ? `Crafted via ${producedByRecipes[0].station === 'furnace' ? 'Foundry' : 'Assembler / Pocket'}`
          : 'Equip from Inventory to place';
      const variantPowerDemand = getCapytorioMachineBasePowerDemandMw({
        type: placeable.baseType,
        variantItemId: meta.id,
      });
      stats.push(
        { label: 'Base Machine', value: baseSpec.name },
        { label: 'Speed Tier', value: `${placeable.tierMult.toFixed(2)}×` },
        {
          label: 'Power',
          value:
            baseSpec.powerSupplyMw > 0
              ? `+${(baseSpec.powerSupplyMw * placeable.tierMult).toFixed(1)} MW`
              : variantPowerDemand > 0
                ? `-${variantPowerDemand.toFixed(2)} MW`
                : '0 MW',
        }
      );
      if (meta.id === 'roboport') {
        tips.push('Store Logistic or Construction Robots in your pocket or roboport to see mini-drones hover and patrol overhead.');
      } else if (meta.id === 'beacon') {
        tips.push(
          `Socket Speed or Efficiency Modules into a Beacon to broadcast +${Math.round(CAPYTORIO_BEACON_SPEC.baseSpeedBonus * 100)}% base speed and ${Math.round(CAPYTORIO_BEACON_SPEC.transmissionEfficiency * 100)}% module power within ${CAPYTORIO_BEACON_SPEC.rangeTiles} tiles.`
        );
      } else {
        tips.push(...(MACHINE_TIPS[placeable.baseType] ?? []));
      }
      tips.push('Equip from Inventory to assign this variant into Quickbar Slot 1.');
    } else if (meta.category === 'ore' || meta.id === 'orange') {
      description =
        RESOURCE_DESCRIPTIONS[meta.id] ??
        `Raw resource item harvested across Capytorio terrain. Feed into Furnaces or Assemblers to refine.`;
      sourceSummary =
        meta.id === 'orange'
          ? 'Harvested from Wild Citrus Trees [E]'
          : 'Mined from Resource Seams [E] or Mining Drill';
      if (meta.id !== 'orange') {
        stats.push({ label: 'Hand Mine', value: '+2 / tap [E]' });
      } else {
        stats.push({ label: 'Tree Harvest', value: '+3 / tree [E]' });
      }
      const fuelInfo = buildFuelSummary(meta.id);
      if (fuelInfo) stats.push({ label: 'Fuel', value: fuelInfo });
      tips.push('Stand near or point at a deposit and press [E] to hand-mine directly into your pocket.');
      tips.push('Place a Mining Drill directly over the ore seam to automate continuous extraction.');
    } else {
      const fuelInfo = buildFuelSummary(meta.id);
      if (meta.category === 'science') {
        description = `${meta.name} fuels Technology Research inside Science Labs and unlocks advanced factory tiers, DNA, and Coins.`;
        sourceSummary = 'Automated in Assembling Machines -> Inserted into Labs';
        stats.push({
          label: 'Researches',
          value: `${usedAsTechCostIn.length} Tech${usedAsTechCostIn.length === 1 ? '' : 's'}`,
        });
        tips.push('Route Science Packs by belt + Smart Inserter into a powered Science Lab.');
        tips.push('You can also click Feed Sci in the Tech or Character modal to upload pocket packs.');
      } else if (meta.id === 'rocket_part') {
        description =
          'Final orbital payload component for launching the Capytorio Rocket Silo and earning massive milestone rewards.';
        sourceSummary = 'Crafted after unlocking Electromagnetics / Rocket Silo Tech';
        tips.push('Click the Launch button on the bottom toolbar once Rocket Parts are crafted.');
      } else {
        description =
          VARIANT_DESCRIPTIONS[meta.id] ??
          `${meta.name} is an intermediate or refined industrial component defined in recipe.lua for factory automation.`;
        sourceSummary =
          producedByRecipes.length > 0
            ? producedByRecipes[0].station === 'furnace'
              ? 'Smelted in Electric Foundry'
              : 'Crafted in Assembling Machine / Workbench'
            : 'Catalog Component';
        if (fuelInfo) stats.push({ label: 'Fuel', value: fuelInfo });
        tips.push('Click any recipe below to inspect ingredients, crafting speed, or Tech unlocks.');
      }
    }

    if (producedByRecipes.length > 0) {
      stats.push({
        label: 'Craft Time',
        value: `${producedByRecipes[0].craftTimeSec}s (×${producedByRecipes[0].resultCount})`,
      });
    }

    const firstCost =
      producedByRecipes[0]?.ingredients.map((i) => ({ item: i.item, count: i.count })) ?? [];

    entries.push({
      id: meta.id,
      kind: placeable ? 'machine' : 'item',
      title: meta.name,
      shortName: meta.shortName,
      subtitle: placeable
        ? `${getCategoryLabel(cat)} · ${placeable.tierMult.toFixed(2)}× Tier`
        : `${getCategoryLabel(cat)}`,
      category: cat,
      categoryLabel: getCategoryLabel(cat),
      description,
      sourceSummary,
      tips,
      stats,
      icon: placeable
        ? {
            kind: 'machine',
            machineType: placeable.baseType,
            variantItemId: meta.id,
            color: hexToCss(placeable.tintHex ?? baseSpec?.colorHex ?? meta.colorHex),
          }
        : {
            kind: 'item',
            shape,
            color: meta.cssColor,
          },
      placeableToolId: placeable ? meta.id : undefined,
      machineBaseType: placeable?.baseType,
      itemId: meta.id,
      buildCost: firstCost,
      producedByRecipes,
      usedInRecipes,
      stationRecipes: placeable && (placeable.baseType === 'furnace' || placeable.baseType === 'assembler')
        ? (recipesByStation.get(placeable.baseType) ?? []).slice(0, 24)
        : [],
      unlockedByTechs,
      usedAsTechCostIn,
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: `${meta.id} ${meta.name} ${meta.shortName} ${cat} ${description}`.toLowerCase(),
    });
    seenIds.add(meta.id);
  }

  // 3. Technologies from technology.lua
  for (const tech of CAPYTORIO_TECHS) {
    const pediaId = `tech:${tech.id}`;
    const unlockedRecipesForTech = recipesByTech.get(tech.id) ?? [];
    const techPrerequisites = tech.prerequisites
      .map((pid) => TECH_BY_ID.get(pid))
      .filter((t): t is CapytorioTechSpec => Boolean(t));
    const costEntries = Object.entries(tech.cost)
      .filter(([, cnt]) => (cnt ?? 0) > 0)
      .map(([item, count]) => ({ item, count: count ?? 1 }));

    const stats: CapytorioPediaStat[] = [
      { label: 'Research Effect', value: tech.effectSummary },
      { label: 'Completion Reward', value: `+${tech.rewardDna} DNA · +${tech.rewardCoins} Coins` },
      { label: 'Repeatable', value: tech.repeatable ? 'Yes (Infinite)' : 'One-time unlock' },
    ];

    entries.push({
      id: pediaId,
      kind: 'tech',
      title: tech.name,
      shortName: tech.name,
      subtitle: tech.subtitle || 'Technology Research',
      category: 'tech',
      categoryLabel: 'Technology',
      description: `${tech.effectSummary}. Research this node in a powered Science Lab by feeding the required Science Packs.`,
      sourceSummary:
        techPrerequisites.length > 0
          ? `Requires: ${techPrerequisites.map((p) => p.name).join(', ')}`
          : 'Starter Research (No prerequisites)',
      tips: [
        'Select this Technology in the Tech window to make it active.',
        'Automate Science Packs into Labs or click Feed Sci to research faster.',
      ],
      stats,
      icon: { kind: 'tech', color: '#a855f7' },
      techId: tech.id,
      buildCost: costEntries,
      producedByRecipes: [],
      usedInRecipes: [],
      stationRecipes: [],
      unlockedByTechs: [],
      usedAsTechCostIn: [],
      unlockedRecipesForTech,
      techPrerequisites,
      searchText: `${tech.id} ${tech.name} ${tech.subtitle} ${tech.effectSummary} technology`.toLowerCase(),
    });
    seenIds.add(pediaId);
  }

  // 4. World Flora, Landmark & Terrain
  for (const w of buildWorldEntries()) {
    entries.push(w);
    seenIds.add(w.id);
  }

  return entries;
}

export function getCapytorioPediaEntry(
  entryId: string,
  catalog?: CapytorioPediaEntry[]
): CapytorioPediaEntry | null {
  const list = catalog ?? buildCapytorioPediaCatalog();
  const direct = list.find((e) => e.id === entryId);
  if (direct) return direct;

  // Fallback for procedurally introduced mod items not yet in catalog snapshot
  const meta = getCapytorioItemMeta(entryId);
  if (meta) {
    const shape = meta.shape ?? resolveCapytorioItemShape(meta.id, meta.category);
    return {
      id: meta.id,
      kind: 'item',
      title: meta.name,
      shortName: meta.shortName,
      subtitle: 'Factorio Item',
      category: 'intermediates',
      categoryLabel: 'Plates & Parts',
      description: `Dynamic catalog item (${meta.id}) parsed from active recipe.lua / technology.lua.`,
      sourceSummary: 'Recipe / Mod Catalog',
      tips: ['Alt + Left-Click any world entity or slot to inspect its Capytoriopedia entry.'],
      stats: [{ label: 'Item ID', value: meta.id }],
      icon: { kind: 'item', shape, color: meta.cssColor },
      itemId: meta.id,
      buildCost: [],
      producedByRecipes: CAPYTORIO_RECIPES.filter((r) => r.result === meta.id),
      usedInRecipes: CAPYTORIO_RECIPES.filter((r) =>
        r.ingredients.some((i) => i.item === meta.id)
      ),
      stationRecipes: [],
      unlockedByTechs: [],
      usedAsTechCostIn: [],
      unlockedRecipesForTech: [],
      techPrerequisites: [],
      searchText: `${meta.id} ${meta.name}`.toLowerCase(),
    };
  }

  return list[0] ?? null;
}
