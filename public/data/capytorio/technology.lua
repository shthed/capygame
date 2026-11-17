-- Capytorio Procedural Technology Tree (Factorio data:extend format)
-- External parties can update tech costs, prerequisites, unlock effects, or add new technologies directly here.

data:extend({
  {
    type = "technology",
    name = "automation_1",
    capytorio_label = "Automation I",
    subtitle = "Foundational Machine Speed & Metallurgy Pack",
    effect_summary = "+25% Craft Speed · Unlocks Orange Science · +2 Drills & +8 Belts",
    reward_dna = 4,
    reward_coins = 15,
    prerequisites = {},
    effects = {
      { type = "unlock-recipe", recipe = "metallurgic_science" },
    },
    unit = {
      count = 4,
      ingredients = {
        { "automation_science", 1 },
      },
      time = 10,
    },
  },
  {
    type = "technology",
    name = "logistics_turbo",
    capytorio_label = "Turbo Belts & Stack Inserters",
    subtitle = "High-speed belt throughput & multi-item arm swings",
    effect_summary = "+45% Belt Speed · Inserter Stack 2 · Unlocks Plastic, Sulfur & Lime Science",
    reward_dna = 6,
    reward_coins = 20,
    prerequisites = { "automation_1" },
    effects = {
      { type = "unlock-recipe", recipe = "plastic_bar" },
      { type = "unlock-recipe", recipe = "sulfur" },
      { type = "unlock-recipe", recipe = "agricultural_science" },
    },
    unit = {
      count = 1,
      ingredients = {
        { "automation_science", 6 },
        { "logistic_science", 4 },
      },
      time = 15,
    },
  },
  {
    type = "technology",
    name = "metallurgy_foundry",
    capytorio_label = "Vulcanus Calcite Casting",
    subtitle = "Productivity-boosted smelting & LDS frames",
    effect_summary = "+25% Drill & Smelt Yield · Unlocks Red Circuits & Low-Density Alloy",
    reward_dna = 8,
    reward_coins = 25,
    prerequisites = { "logistics_turbo" },
    effects = {
      { type = "unlock-recipe", recipe = "advanced_circuit" },
      { type = "unlock-recipe", recipe = "low_density_structure" },
    },
    unit = {
      count = 1,
      ingredients = {
        { "automation_science", 8 },
        { type = "item", name = "logistic_science", amount = 6 },
        { "metallurgic_science", 4 },
      },
      time = 20,
    },
  },
  {
    type = "technology",
    name = "bioflux_chemistry",
    capytorio_label = "Gleba Bioflux Chemistry",
    subtitle = "Yuzu-sourced bio-fuel & electromagnetic science",
    effect_summary = "+25% Generator Output · Unlocks Rocket Fuel & Cyan Science",
    reward_dna = 10,
    reward_coins = 30,
    prerequisites = { "metallurgy_foundry" },
    effects = {
      { type = "unlock-recipe", recipe = "rocket_fuel" },
      { type = "unlock-recipe", recipe = "electromagnetic_science" },
    },
    unit = {
      count = 1,
      ingredients = {
        { "logistic_science", 8 },
        { "metallurgic_science", 6 },
        { "agricultural_science", 4 },
      },
      time = 25,
    },
  },
  {
    type = "technology",
    name = "electromagnetics_stack",
    capytorio_label = "Fulgora Electromagnetics",
    subtitle = "Blue processing units & rocket assembly integration",
    effect_summary = "Inserter Stack 3 · Unlocks Processing Units & Rocket Launch Core",
    reward_dna = 12,
    reward_coins = 40,
    prerequisites = { "bioflux_chemistry" },
    effects = {
      { type = "unlock-recipe", recipe = "processing_unit" },
      { type = "unlock-recipe", recipe = "rocket_part" },
    },
    unit = {
      count = 1,
      ingredients = {
        { "metallurgic_science", 8 },
        { "agricultural_science", 6 },
        { "electromagnetic_science", 5 },
      },
      time = 30,
    },
  },
  {
    type = "technology",
    name = "rocket_silo_prod",
    capytorio_label = "Infinite Rocket Productivity",
    subtitle = "Endless Space Age scaling bonus (+15% factory yield per level)",
    effect_summary = "+15% Factory Productivity & Launches Orbital Yuzu Payload (+15 DNA)",
    reward_dna = 15,
    reward_coins = 50,
    prerequisites = { "electromagnetics_stack" },
    effects = {},
    upgrade = true,
    max_level = "infinite",
    unit = {
      count = 1,
      ingredients = {
        { "automation_science", 6 },
        { "logistic_science", 6 },
        { "metallurgic_science", 4 },
        { "agricultural_science", 4 },
        { "electromagnetic_science", 4 },
      },
      time = 30,
    },
  },
})
