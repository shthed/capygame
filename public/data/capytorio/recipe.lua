-- Capytorio Procedural Recipe Prototypes (Factorio data:extend format)
-- External parties can modify existing recipes or add new recipes/items directly in this file.
-- Both `./data/capytorio/recipe.lua` (runtime fetch) and the Vite build bundle read directly from this source.

data:extend({
  -- Furnace Smelting Recipes (auto-selected by input ore/plate)
  {
    type = "recipe",
    name = "smelt_iron",
    capytorio_label = "Iron Plate",
    category = "smelting",
    enabled = true,
    energy_required = 1.6,
    pocket_craftable = false,
    ingredients = {
      { type = "item", name = "iron_ore", amount = 1 },
    },
    results = {
      { type = "item", name = "iron_plate", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "smelt_copper",
    capytorio_label = "Copper Plate",
    category = "smelting",
    enabled = true,
    energy_required = 1.6,
    pocket_craftable = false,
    ingredients = {
      { type = "item", name = "copper_ore", amount = 1 },
    },
    results = {
      { type = "item", name = "copper_plate", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "smelt_calcite",
    capytorio_label = "Calcite Brick",
    category = "smelting",
    enabled = true,
    energy_required = 1.6,
    pocket_craftable = false,
    ingredients = {
      { type = "item", name = "calcite", amount = 1 },
    },
    results = {
      { type = "item", name = "stone_brick", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "smelt_steel",
    capytorio_label = "Steel Beam",
    category = "smelting",
    enabled = true,
    energy_required = 2.6,
    pocket_craftable = false,
    ingredients = {
      { type = "item", name = "iron_plate", amount = 2 },
    },
    results = {
      { type = "item", name = "steel_plate", amount = 1 },
    },
  },

  -- Starter Assembler & Pocket Craft Recipes
  {
    type = "recipe",
    name = "iron_gear",
    capytorio_label = "Iron Gear Wheel",
    category = "crafting",
    enabled = true,
    energy_required = 1.2,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "iron_plate", amount = 2 },
    },
    results = {
      { type = "item", name = "iron_gear", amount = 2 },
    },
  },
  {
    type = "recipe",
    name = "copper_cable",
    capytorio_label = "Copper Cable",
    category = "crafting",
    enabled = true,
    energy_required = 1.0,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "copper_plate", amount = 1 },
    },
    results = {
      { type = "item", name = "copper_cable", amount = 2 },
    },
  },
  {
    type = "recipe",
    name = "electronic_circuit",
    capytorio_label = "Green Circuit",
    category = "crafting",
    enabled = true,
    energy_required = 1.5,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "iron_plate", amount = 1 },
      { type = "item", name = "copper_cable", amount = 2 },
    },
    results = {
      { type = "item", name = "electronic_circuit", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "automation_science",
    capytorio_label = "Red Science Pack",
    category = "crafting",
    enabled = true,
    energy_required = 2.2,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "copper_plate", amount = 1 },
      { type = "item", name = "iron_gear", amount = 1 },
    },
    results = {
      { type = "item", name = "automation_science", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "logistic_science",
    capytorio_label = "Green Science Pack",
    category = "crafting",
    enabled = true,
    energy_required = 2.6,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "iron_gear", amount = 1 },
      { type = "item", name = "electronic_circuit", amount = 1 },
    },
    results = {
      { type = "item", name = "logistic_science", amount = 1 },
    },
  },

  -- Tier 1 Unlocked by automation_1
  {
    type = "recipe",
    name = "metallurgic_science",
    capytorio_label = "Orange Metallurgic Science",
    category = "crafting",
    enabled = false,
    energy_required = 3.0,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "steel_plate", amount = 1 },
      { type = "item", name = "calcite", amount = 1 },
    },
    results = {
      { type = "item", name = "metallurgic_science", amount = 1 },
    },
  },

  -- Tier 2 Unlocked by logistics_turbo
  {
    type = "recipe",
    name = "plastic_bar",
    capytorio_label = "Bioplastic Bar",
    category = "crafting",
    enabled = false,
    energy_required = 1.8,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "coal", amount = 1 },
      { type = "item", name = "yuzu_sap", amount = 1 },
    },
    results = {
      { type = "item", name = "plastic_bar", amount = 2 },
    },
  },
  {
    type = "recipe",
    name = "sulfur",
    capytorio_label = "Biosulfur Crystal",
    category = "crafting",
    enabled = false,
    energy_required = 1.8,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "coal", amount = 1 },
      { type = "item", name = "calcite", amount = 1 },
    },
    results = {
      { type = "item", name = "sulfur", amount = 2 },
    },
  },
  {
    type = "recipe",
    name = "agricultural_science",
    capytorio_label = "Lime Agricultural Science",
    category = "crafting",
    enabled = false,
    energy_required = 3.2,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "yuzu_sap", amount = 1 },
      { type = "item", name = "plastic_bar", amount = 1 },
    },
    results = {
      { type = "item", name = "agricultural_science", amount = 1 },
    },
  },

  -- Tier 3 Unlocked by metallurgy_foundry & bioflux_chemistry
  {
    type = "recipe",
    name = "advanced_circuit",
    capytorio_label = "Red Advanced Circuit",
    category = "crafting",
    enabled = false,
    energy_required = 2.8,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "electronic_circuit", amount = 2 },
      { type = "item", name = "plastic_bar", amount = 1 },
      { type = "item", name = "copper_cable", amount = 2 },
    },
    results = {
      { type = "item", name = "advanced_circuit", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "low_density_structure",
    capytorio_label = "Low-Density Alloy Frame",
    category = "crafting",
    enabled = false,
    energy_required = 3.0,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "steel_plate", amount = 1 },
      { type = "item", name = "copper_plate", amount = 2 },
      { type = "item", name = "plastic_bar", amount = 1 },
    },
    results = {
      { type = "item", name = "low_density_structure", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "rocket_fuel",
    capytorio_label = "Bio-Rocket Fuel",
    category = "crafting",
    enabled = false,
    energy_required = 2.6,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "coal", amount = 2 },
      { type = "item", name = "yuzu_sap", amount = 2 },
    },
    results = {
      { type = "item", name = "rocket_fuel", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "electromagnetic_science",
    capytorio_label = "Cyan Electromagnetic Science",
    category = "crafting",
    enabled = false,
    energy_required = 3.4,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "advanced_circuit", amount = 1 },
      { type = "item", name = "sulfur", amount = 1 },
    },
    results = {
      { type = "item", name = "electromagnetic_science", amount = 1 },
    },
  },

  -- Tier 4 Unlocked by electromagnetics_stack
  {
    type = "recipe",
    name = "processing_unit",
    capytorio_label = "Blue Processing Unit",
    category = "crafting",
    enabled = false,
    energy_required = 3.6,
    pocket_craftable = true,
    ingredients = {
      { type = "item", name = "electronic_circuit", amount = 2 },
      { type = "item", name = "advanced_circuit", amount = 1 },
      { type = "item", name = "sulfur", amount = 1 },
    },
    results = {
      { type = "item", name = "processing_unit", amount = 1 },
    },
  },
  {
    type = "recipe",
    name = "rocket_part",
    capytorio_label = "Rocket Launch Core",
    category = "crafting",
    enabled = false,
    energy_required = 4.0,
    pocket_craftable = false,
    ingredients = {
      { type = "item", name = "low_density_structure", amount = 1 },
      { type = "item", name = "rocket_fuel", amount = 1 },
      { type = "item", name = "processing_unit", amount = 1 },
    },
    results = {
      { type = "item", name = "rocket_part", amount = 1 },
    },
  },
})
