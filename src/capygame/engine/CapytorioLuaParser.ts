import type {
  CapytorioItemId,
  CapytorioItemMeta,
  CapytorioRecipeId,
  CapytorioRecipeSpec,
  CapytorioTechId,
  CapytorioTechSpec,
} from './CapytorioData';

type LuaTokenType = 'string' | 'number' | 'ident' | 'punct' | 'eof';

interface LuaToken {
  type: LuaTokenType;
  value: string;
}

interface LuaTableValue {
  kind: 'table';
  array: LuaVal[];
  map: Record<string, LuaVal>;
}

type LuaVal = string | number | boolean | null | LuaTableValue;

function isTable(v: LuaVal | undefined): v is LuaTableValue {
  return typeof v === 'object' && v !== null && v.kind === 'table';
}

const FACTORIO_NAME_ALIASES: Record<string, string> = {
  'iron-ore': 'iron_ore',
  'copper-ore': 'copper_ore',
  coal: 'coal',
  stone: 'stone',
  calcite: 'stone',
  'crude-oil': 'crude_oil',
  'uranium-ore': 'uranium_ore',
  'uranium-235': 'uranium_235',
  'uranium-238': 'uranium_238',
  'uranium-fuel-cell': 'uranium_fuel_cell',
  pumpjack: 'pumpjack',
  wood: 'orange',
  orange: 'orange',
  'yuzu-sap': 'yuzu_sap',
  'iron-plate': 'iron_plate',
  'copper-plate': 'copper_plate',
  'steel-plate': 'steel_plate',
  'stone-brick': 'stone_brick',
  concrete: 'concrete',
  'hazard-concrete': 'hazard_concrete',
  'iron-stick': 'iron_stick',
  'iron-gear-wheel': 'iron_gear',
  'iron-gear': 'iron_gear',
  'copper-cable': 'copper_cable',
  'electronic-circuit': 'electronic_circuit',
  'plastic-bar': 'plastic_bar',
  sulfur: 'sulfur',
  battery: 'battery',
  explosives: 'explosives',
  'engine-unit': 'engine_unit',
  'electric-engine-unit': 'electric_engine_unit',
  'flying-robot-frame': 'flying_robot_frame',
  'advanced-circuit': 'advanced_circuit',
  'low-density-structure': 'low_density_structure',
  'solid-fuel': 'solid_fuel',
  'rocket-fuel': 'rocket_fuel',
  'rocket-control-unit': 'rocket_control_unit',
  'processing-unit': 'processing_unit',
  'rocket-part': 'rocket_part',
  pipe: 'pipe',
  'pipe-to-ground': 'pipe_to_ground',
  pump: 'pump',
  'wooden-chest': 'wooden_chest',
  'iron-chest': 'iron_chest',
  'steel-chest': 'steel_chest',
  'passive-provider-chest': 'passive_provider_chest',
  'requester-chest': 'requester_chest',
  'transport-belt': 'transport_belt',
  'fast-transport-belt': 'fast_transport_belt',
  'express-transport-belt': 'express_transport_belt',
  'underground-belt': 'underground_belt',
  'fast-underground-belt': 'fast_underground_belt',
  'express-underground-belt': 'express_underground_belt',
  splitter: 'splitter',
  'fast-splitter': 'fast_splitter',
  'express-splitter': 'express_splitter',
  'burner-inserter': 'burner_inserter',
  inserter: 'inserter',
  'long-handed-inserter': 'long_handed_inserter',
  'fast-inserter': 'fast_inserter',
  'bulk-inserter': 'bulk_inserter',
  'small-electric-pole': 'small_electric_pole',
  'medium-electric-pole': 'medium_electric_pole',
  'big-electric-pole': 'big_electric_pole',
  substation: 'substation',
  rail: 'rail',
  'train-stop': 'train_stop',
  locomotive: 'locomotive',
  'cargo-wagon': 'cargo_wagon',
  'logistic-robot': 'logistic_robot',
  'construction-robot': 'construction_robot',
  roboport: 'roboport',
  'burner-mining-drill': 'burner_mining_drill',
  'electric-mining-drill': 'electric_mining_drill',
  'offshore-pump': 'offshore_pump',
  'stone-furnace': 'stone_furnace',
  'steel-furnace': 'steel_furnace',
  'electric-furnace': 'electric_furnace',
  'assembling-machine-1': 'assembling_machine_1',
  'assembling-machine-2': 'assembling_machine_2',
  'assembling-machine-3': 'assembling_machine_3',
  'oil-refinery': 'oil_refinery',
  'chemical-plant': 'chemical_plant',
  centrifuge: 'centrifuge',
  boiler: 'boiler',
  'steam-engine': 'steam_engine',
  'steam-turbine': 'steam_turbine',
  'solar-panel': 'solar_panel',
  accumulator: 'accumulator',
  'nuclear-reactor': 'nuclear_reactor',
  'heat-exchanger': 'heat_exchanger',
  'heat-pipe': 'heat_pipe',
  lab: 'lab',
  beacon: 'beacon',
  'rocket-silo': 'rocket_silo',
  'repair-pack': 'repair_pack',
  'speed-module': 'speed_module',
  'speed-module-2': 'speed_module_2',
  'efficiency-module': 'efficiency_module',
  'efficiency-module-2': 'efficiency_module_2',
  'productivity-module': 'productivity_module',
  'productivity-module-2': 'productivity_module_2',
  'firearm-magazine': 'firearm_magazine',
  'piercing-rounds-magazine': 'piercing_rounds_magazine',
  grenade: 'grenade',
  'stone-wall': 'stone_wall',
  gate: 'gate',
  'gun-turret': 'gun_turret',
  'laser-turret': 'laser_turret',
  radar: 'radar',
  'light-armor': 'light_armor',
  'heavy-armor': 'heavy_armor',
  'modular-armor': 'modular_armor',
  'power-armor': 'power_armor',
  'automation-science-pack': 'automation_science',
  'logistic-science-pack': 'logistic_science',
  'military-science-pack': 'military_science',
  'chemical-science-pack': 'chemical_science',
  'production-science-pack': 'production_science',
  'utility-science-pack': 'utility_science',
  'space-science-pack': 'space_science',
  'metallurgic-science-pack': 'metallurgic_science',
  'agricultural-science-pack': 'agricultural_science',
  'electromagnetic-science-pack': 'electromagnetic_science',
};

export function normalizeFactorioId(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return '';
  if (FACTORIO_NAME_ALIASES[trimmed]) {
    return FACTORIO_NAME_ALIASES[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (FACTORIO_NAME_ALIASES[lower]) {
    return FACTORIO_NAME_ALIASES[lower];
  }
  return lower.replace(/[\s-]+/g, '_');
}

function readLongBracket(src: string, startPos: number): { text: string; nextPos: number } | null {
  if (src[startPos] !== '[') return null;
  let eqCount = 0;
  let p = startPos + 1;
  while (src[p] === '=') {
    eqCount++;
    p++;
  }
  if (src[p] !== '[') return null;
  p++;
  if (src[p] === '\r' && src[p + 1] === '\n') p += 2;
  else if (src[p] === '\n') p += 1;

  const closing = ']' + '='.repeat(eqCount) + ']';
  const closeIdx = src.indexOf(closing, p);
  if (closeIdx === -1) {
    return { text: src.slice(p), nextPos: src.length };
  }
  return { text: src.slice(p, closeIdx), nextPos: closeIdx + closing.length };
}

function tokenizeLua(src: string): LuaToken[] {
  const tokens: LuaToken[] = [];
  const len = src.length;
  let i = 0;

  while (i < len) {
    const ch = src[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Comments: --[[ ... ]] or -- ...
    if (ch === '-' && src[i + 1] === '-') {
      if (src[i + 2] === '[') {
        const block = readLongBracket(src, i + 2);
        if (block) {
          i = block.nextPos;
          continue;
        }
      }
      while (i < len && src[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Long literal bracket strings [[ ... ]]
    if (ch === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) {
      const longStr = readLongBracket(src, i);
      if (longStr) {
        tokens.push({ type: 'string', value: longStr.text });
        i = longStr.nextPos;
        continue;
      }
    }

    // Quoted strings "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let out = '';
      while (i < len && src[i] !== quote) {
        if (src[i] === '\\') {
          if (i + 1 < len) {
            const esc = src[i + 1];
            if (esc === 'n') out += '\n';
            else if (esc === 't') out += '\t';
            else if (esc === 'r') out += '\r';
            else out += esc;
            i += 2;
          } else {
            out += '\\';
            i++;
          }
        } else {
          out += src[i];
          i++;
        }
      }
      if (i < len && src[i] === quote) i++;
      tokens.push({ type: 'string', value: out });
      continue;
    }

    // Lua string concatenation operator `..` (must precede `.5` leading-dot number check so `1..2` tokenizes as `1`, `.`, `.`, `2`)
    if (ch === '.' && src[i + 1] === '.') {
      tokens.push({ type: 'punct', value: '.' });
      tokens.push({ type: 'punct', value: '.' });
      i += 2;
      continue;
    }

    // Signed or unsigned numeric literal
    const isNegNum =
      ch === '-' &&
      ((src[i + 1] >= '0' && src[i + 1] <= '9') ||
        (src[i + 1] === '.' && src[i + 2] >= '0' && src[i + 2] <= '9')) &&
      (tokens.length === 0 ||
        (tokens[tokens.length - 1].type === 'punct' &&
          ['=', ',', ';', '{', '(', '['].includes(tokens[tokens.length - 1].value)));
    if (
      isNegNum ||
      (ch >= '0' && ch <= '9') ||
      (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')
    ) {
      const start = i;
      if (ch === '-') i++;
      if (src[i] === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        i += 2;
        while (i < len && /[0-9a-fA-F]/.test(src[i])) i++;
      } else {
        let seenDot = false;
        while (i < len) {
          const c = src[i];
          if (c >= '0' && c <= '9') {
            i++;
          } else if (c === '.' && !seenDot && src[i + 1] !== '.') {
            seenDot = true;
            i++;
          } else {
            break;
          }
        }
        if ((src[i] === 'e' || src[i] === 'E') && i + 1 < len) {
          const expSign = src[i + 1] === '+' || src[i + 1] === '-' ? 1 : 0;
          const firstDigitIdx = i + 1 + expSign;
          if (firstDigitIdx < len && src[firstDigitIdx] >= '0' && src[firstDigitIdx] <= '9') {
            i = firstDigitIdx;
            while (i < len && src[i] >= '0' && src[i] <= '9') i++;
          }
        }
      }
      tokens.push({ type: 'number', value: src.slice(start, i) });
      continue;
    }

    // Identifiers
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      const start = i;
      i++;
      while (
        i < len &&
        ((src[i] >= 'a' && src[i] <= 'z') ||
          (src[i] >= 'A' && src[i] <= 'Z') ||
          (src[i] >= '0' && src[i] <= '9') ||
          src[i] === '_')
      ) {
        i++;
      }
      tokens.push({ type: 'ident', value: src.slice(start, i) });
      continue;
    }

    // Single-char punctuation
    tokens.push({ type: 'punct', value: ch });
    i++;
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class LuaDataExtendParser {
  private pos = 0;
  private readonly env = new Map<string, LuaVal>();

  constructor(private readonly tokens: LuaToken[]) {}

  private peek(offset = 0): LuaToken {
    return this.tokens[Math.min(this.tokens.length - 1, this.pos + offset)];
  }

  private consume(): LuaToken {
    const t = this.peek();
    if (t.type !== 'eof') this.pos++;
    return t;
  }

  public extractExtendTables(): LuaTableValue[] {
    const tables: LuaTableValue[] = [];

    while (this.peek().type !== 'eof') {
      const t = this.peek();

      // Match `local name = expr`
      if (t.type === 'ident' && t.value === 'local') {
        this.consume();
        if (this.peek().type === 'ident' && this.peek(1).value === '=') {
          const name = this.consume().value;
          this.consume(); // '='
          const val = this.parseExpression();
          this.env.set(name, val);
          continue;
        }
      }

      // Match `data:extend({ ... })` or `data.extend({ ... })` or `data:extend { ... }`
      if (
        t.type === 'ident' &&
        t.value === 'data' &&
        (this.peek(1).value === ':' || this.peek(1).value === '.') &&
        this.peek(2).type === 'ident' &&
        this.peek(2).value === 'extend'
      ) {
        this.pos += 3;
        const hasParen = this.peek().value === '(';
        if (hasParen) this.consume();
        if (this.peek().value === '{') {
          tables.push(this.parseTable());
        }
        if (hasParen && this.peek().value === ')') {
          this.consume();
        }
        continue;
      }

      // Match bare top-level return { ... } or { ... } list of prototypes
      if (t.type === 'ident' && t.value === 'return' && this.peek(1).value === '{') {
        this.consume();
        tables.push(this.parseTable());
        continue;
      }

      // Match simple global assignment `ident = expr`
      if (t.type === 'ident' && this.peek(1).value === '=') {
        const name = this.consume().value;
        this.consume();
        this.env.set(name, this.parseExpression());
        continue;
      }

      this.consume();
    }

    return tables;
  }

  private parseExpression(): LuaVal {
    let val = this.parsePrimaryExpression();
    // Binary Lua string concatenation `..` works on strings, numbers, identifiers, and member accesses
    while (this.peek().value === '.' && this.peek(1).value === '.') {
      this.pos += 2;
      const rhs = this.parsePrimaryExpression();
      val = `${val ?? ''}${rhs ?? ''}`;
    }
    return val;
  }

  private parsePrimaryExpression(): LuaVal {
    const t = this.peek();
    if (t.type === 'string') {
      this.consume();
      return t.value;
    }
    if (t.type === 'number') {
      this.consume();
      const num = Number(t.value);
      return Number.isFinite(num) ? num : 0;
    }
    if (t.type === 'ident') {
      this.consume();
      if (t.value === 'true') return true;
      if (t.value === 'false') return false;
      if (t.value === 'nil') return null;
      if (t.value === 'not') {
        const inner = this.parsePrimaryExpression();
        return inner === false || inner === null;
      }
      let curVal: LuaVal | undefined = this.env.has(t.value) ? this.env.get(t.value) : undefined;
      let hadPostfix = false;
      while (true) {
        const next = this.peek();
        if (next.value === '.' && this.peek(1).value !== '.') {
          hadPostfix = true;
          this.consume();
          const prop = this.peek().type === 'ident' ? this.consume().value : '';
          curVal = isTable(curVal) && prop ? curVal.map[prop] : undefined;
        } else if (next.value === ':') {
          hadPostfix = true;
          this.consume();
          if (this.peek().type === 'ident') this.consume();
          if (this.peek().value === '(') {
            this.consumeBalanced('(', ')');
          }
          curVal = undefined;
        } else if (next.value === '[') {
          hadPostfix = true;
          this.consume();
          const keyExpr = this.parseExpression();
          if (this.peek().value === ']') this.consume();
          if (isTable(curVal)) {
            if (typeof keyExpr === 'number' && Number.isInteger(keyExpr) && keyExpr >= 1) {
              curVal = curVal.array[keyExpr - 1] ?? curVal.map[String(keyExpr)];
            } else if (keyExpr !== null && typeof keyExpr !== 'object') {
              curVal = curVal.map[String(keyExpr)];
            } else {
              curVal = undefined;
            }
          } else {
            curVal = undefined;
          }
        } else if (next.value === '(') {
          hadPostfix = true;
          this.consumeBalanced('(', ')');
          curVal = undefined;
        } else {
          break;
        }
      }
      if (curVal !== undefined) return curVal;
      return hadPostfix ? null : t.value;
    }
    if (t.value === '{') {
      return this.parseTable();
    }
    if (t.value === '(') {
      this.consume();
      const inner = this.parseExpression();
      if (this.peek().value === ')') this.consume();
      return inner;
    }
    if (t.value === '-') {
      this.consume();
      const inner = this.parsePrimaryExpression();
      return typeof inner === 'number' ? -inner : 0;
    }
    this.consume();
    return null;
  }

  private consumeBalanced(openCh: string, closeCh: string): void {
    if (this.peek().value !== openCh) return;
    let depth = 0;
    while (this.peek().type !== 'eof') {
      const ch = this.consume().value;
      if (ch === openCh) depth++;
      else if (ch === closeCh) {
        depth--;
        if (depth <= 0) break;
      }
    }
  }

  private parseTable(): LuaTableValue {
    const out: LuaTableValue = { kind: 'table', array: [], map: {} };
    if (this.peek().value !== '{') return out;
    this.consume(); // '{'

    while (this.peek().type !== 'eof' && this.peek().value !== '}') {
      const t = this.peek();

      // `[keyExpr] = valueExpr`
      if (t.value === '[') {
        this.consume();
        const keyVal = this.parseExpression();
        if (this.peek().value === ']') this.consume();
        if (this.peek().value === '=') this.consume();
        const val = this.parseExpression();
        if (keyVal !== null && typeof keyVal !== 'object') {
          out.map[String(keyVal)] = val;
        }
      } else if (t.type === 'ident' && this.peek(1).value === '=') {
        // `ident = valueExpr`
        const key = this.consume().value;
        this.consume(); // '='
        out.map[key] = this.parseExpression();
      } else {
        // Positional array entry
        out.array.push(this.parseExpression());
      }

      if (this.peek().value === ',' || this.peek().value === ';') {
        this.consume();
      }
    }

    if (this.peek().value === '}') {
      this.consume();
    }
    return out;
  }
}

function getString(tbl: LuaTableValue, key: string): string | undefined {
  const v = tbl.map[key];
  return typeof v === 'string' ? v : undefined;
}

function getNumber(tbl: LuaTableValue, key: string): number | undefined {
  const v = tbl.map[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function getBoolean(tbl: LuaTableValue, key: string): boolean | undefined {
  const v = tbl.map[key];
  return typeof v === 'boolean' ? v : undefined;
}

function getTable(tbl: LuaTableValue, key: string): LuaTableValue | undefined {
  const v = tbl.map[key];
  return isTable(v) ? v : undefined;
}

function parseItemAmountEntry(entry: LuaVal): { item: CapytorioItemId; count: number } | null {
  if (!isTable(entry)) return null;
  const rawName = getString(entry, 'name') ?? (typeof entry.array[0] === 'string' ? entry.array[0] : undefined);
  if (!rawName) return null;
  const item = normalizeFactorioId(rawName);
  if (!item) return null;
  let amt = getNumber(entry, 'amount') ?? (typeof entry.array[1] === 'number' ? entry.array[1] : undefined);
  if (amt === undefined) {
    const minAmt = getNumber(entry, 'amount_min');
    const maxAmt = getNumber(entry, 'amount_max');
    if (minAmt !== undefined && maxAmt !== undefined) {
      amt = Math.max(1, Math.round((minAmt + maxAmt) * 0.5));
    }
  }
  const count = Math.max(1, Math.round(amt ?? 1));
  return { item, count };
}

function formatProceduralTitle(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatProceduralShortName(id: string): string {
  const cleaned = id
    .replace(/_science_pack$/, ' Sci')
    .replace(/_science$/, ' Sci')
    .replace(/_plate$/, ' Plate')
    .replace(/_ore$/, ' Ore');
  const titled = formatProceduralTitle(cleaned);
  return titled.length <= 12 ? titled : titled.slice(0, 12);
}

function inferProceduralCategory(id: string): CapytorioItemMeta['category'] {
  if (id.includes('science')) return 'science';
  if (id.includes('rocket_part') || id === 'rocket_silo') return 'rocket';
  if (
    id.endsWith('_ore') ||
    id === 'coal' ||
    id === 'stone' ||
    id === 'calcite' ||
    id === 'crude_oil' ||
    id === 'yuzu_sap' ||
    id === 'orange'
  ) return 'ore';
  if (id.endsWith('_plate') || id.endsWith('_brick') || id.includes('concrete')) return 'plate';
  if (
    id.includes('belt') ||
    id.includes('splitter') ||
    id.includes('inserter') ||
    id.includes('chest') ||
    id.includes('pole') ||
    id === 'substation' ||
    id === 'rail' ||
    id === 'locomotive' ||
    id === 'cargo_wagon' ||
    id === 'train_stop' ||
    id.includes('robot') ||
    id === 'roboport' ||
    id === 'pipe' ||
    id === 'pipe_to_ground' ||
    id === 'pump'
  ) {
    return 'logistics';
  }
  if (
    id.includes('drill') ||
    id.includes('furnace') ||
    id.includes('assembling') ||
    id.includes('boiler') ||
    id.includes('steam') ||
    id.includes('solar') ||
    id === 'accumulator' ||
    id === 'nuclear_reactor' ||
    id === 'heat_exchanger' ||
    id === 'heat_pipe' ||
    id === 'lab' ||
    id === 'beacon' ||
    id === 'oil_refinery' ||
    id === 'chemical_plant' ||
    id === 'centrifuge' ||
    id === 'offshore_pump' ||
    id === 'repair_pack' ||
    id.includes('module')
  ) {
    return 'production';
  }
  if (
    id.includes('magazine') ||
    id === 'grenade' ||
    id.includes('turret') ||
    id === 'stone_wall' ||
    id === 'gate' ||
    id === 'radar' ||
    id.includes('armor')
  ) {
    return 'combat';
  }
  return 'intermediate';
}

function hslToRgbHex(hDeg: number, sPct: number, lPct: number): number {
  const h = ((hDeg % 360) + 360) % 360;
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

export type CapytorioItemShape =
  | 'ore'
  | 'plate'
  | 'gear'
  | 'circuit'
  | 'science'
  | 'coil'
  | 'fruit'
  | 'crate'
  | 'battery'
  | 'ammo'
  | 'grenade'
  | 'armor'
  | 'engine'
  | 'barrel'
  | 'brick'
  | 'module';

export const CAPYTORIO_ITEM_SHAPES: readonly CapytorioItemShape[] = [
  'ore',
  'plate',
  'gear',
  'circuit',
  'science',
  'coil',
  'fruit',
  'crate',
  'battery',
  'ammo',
  'grenade',
  'armor',
  'engine',
  'barrel',
  'brick',
  'module',
];

export function resolveCapytorioItemShape(
  id: CapytorioItemId,
  category?: CapytorioItemMeta['category']
): CapytorioItemShape {
  if (id === 'orange' || id === 'yuzu_sap') return 'fruit';
  if (category === 'science' || id.includes('science')) return 'science';
  if (id === 'grenade' || id.includes('grenade')) return 'grenade';
  if (id === 'battery' || id.includes('battery')) return 'battery';
  if (id.includes('magazine') || id.includes('ammo') || id.includes('rounds')) return 'ammo';
  if (id.includes('armor')) return 'armor';
  if (
    id === 'engine_unit' ||
    id === 'electric_engine_unit' ||
    id === 'flying_robot_frame' ||
    id === 'logistic_robot' ||
    id === 'construction_robot'
  ) {
    return 'engine';
  }
  if (
    id === 'rocket_fuel' ||
    id === 'solid_fuel' ||
    id === 'explosives' ||
    id.includes('barrel') ||
    id.includes('fuel')
  ) {
    return 'barrel';
  }
  if (
    id === 'stone_brick' ||
    id === 'concrete' ||
    id === 'hazard_concrete' ||
    id === 'stone_wall' ||
    id === 'plastic_bar' ||
    id.includes('brick') ||
    id.includes('concrete')
  ) {
    return 'brick';
  }
  if (
    id.includes('module') ||
    id === 'rocket_control_unit' ||
    id === 'rocket_part' ||
    id === 'repair_pack'
  ) {
    return 'module';
  }
  if (id === 'iron_gear' || id.includes('gear')) {
    return 'gear';
  }
  if (
    id === 'electronic_circuit' ||
    id === 'advanced_circuit' ||
    id === 'processing_unit' ||
    id.includes('circuit')
  ) {
    return 'circuit';
  }
  if (id === 'copper_cable' || id === 'iron_stick' || id.includes('cable') || id.includes('wire')) {
    return 'coil';
  }
  if (
    category === 'ore' ||
    id === 'coal' ||
    id === 'stone' ||
    id === 'calcite' ||
    id === 'crude_oil' ||
    id === 'uranium_ore' ||
    id === 'sulfur' ||
    id.endsWith('_ore')
  ) {
    return 'ore';
  }
  if (
    category === 'plate' ||
    id === 'low_density_structure' ||
    id.endsWith('_plate')
  ) {
    return 'plate';
  }
  return 'crate';
}

export function createProceduralItemMeta(id: CapytorioItemId): CapytorioItemMeta {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  const colorHex = hslToRgbHex(hue, 72, 58);
  const cssColor = '#' + colorHex.toString(16).padStart(6, '0');
  const category = inferProceduralCategory(id);
  return {
    id,
    name: formatProceduralTitle(id),
    shortName: formatProceduralShortName(id),
    category,
    shape: resolveCapytorioItemShape(id, category),
    colorHex,
    cssColor,
  };
}

export const CURATED_CAPYTORIO_ITEMS: Record<string, CapytorioItemMeta> = {
  // Raw Factorio Resources & Citrus Harvest
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', shortName: 'Fe Ore', category: 'ore', shape: 'ore', colorHex: 0x60a5fa, cssColor: '#60a5fa' },
  copper_ore: { id: 'copper_ore', name: 'Copper Ore', shortName: 'Cu Ore', category: 'ore', shape: 'ore', colorHex: 0xc2410c, cssColor: '#c2410c' },
  coal: { id: 'coal', name: 'Coal', shortName: 'Coal', category: 'ore', shape: 'ore', colorHex: 0x18181b, cssColor: '#3f3f46' },
  stone: { id: 'stone', name: 'Stone', shortName: 'Stone', category: 'ore', shape: 'ore', colorHex: 0xd6d3d1, cssColor: '#d6d3d1' },
  crude_oil: { id: 'crude_oil', name: 'Crude Oil', shortName: 'Crude Oil', category: 'ore', shape: 'ore', colorHex: 0x1f142b, cssColor: '#6d28d9' },
  uranium_ore: { id: 'uranium_ore', name: 'Uranium Ore', shortName: 'U-Ore', category: 'ore', shape: 'ore', colorHex: 0x4ade80, cssColor: '#4ade80' },
  uranium_235: { id: 'uranium_235', name: 'Uranium-235', shortName: 'U-235', category: 'intermediate', shape: 'ore', colorHex: 0x22c55e, cssColor: '#22c55e' },
  uranium_238: { id: 'uranium_238', name: 'Uranium-238', shortName: 'U-238', category: 'intermediate', shape: 'ore', colorHex: 0x15803d, cssColor: '#15803d' },
  uranium_fuel_cell: { id: 'uranium_fuel_cell', name: 'Uranium Fuel Cell', shortName: 'U-Cell', category: 'intermediate', shape: 'module', colorHex: 0x84cc16, cssColor: '#84cc16' },
  orange: { id: 'orange', name: 'Fresh Orange', shortName: 'Orange', category: 'ore', shape: 'fruit', colorHex: 0xf97316, cssColor: '#fb923c' },
  yuzu_sap: { id: 'yuzu_sap', name: 'Bio-Yuzu Nutrient', shortName: 'Yuzu Sap', category: 'ore', shape: 'fruit', colorHex: 0xfacc15, cssColor: '#facc15' },

  // Plates & Bricks
  iron_plate: { id: 'iron_plate', name: 'Iron Plate', shortName: 'Fe Plate', category: 'plate', shape: 'plate', colorHex: 0xe2e8f0, cssColor: '#e2e8f0' },
  copper_plate: { id: 'copper_plate', name: 'Copper Plate', shortName: 'Cu Plate', category: 'plate', shape: 'plate', colorHex: 0xfb923c, cssColor: '#fb923c' },
  steel_plate: { id: 'steel_plate', name: 'Steel Plate', shortName: 'Steel', category: 'plate', shape: 'plate', colorHex: 0x64748b, cssColor: '#94a3b8' },
  stone_brick: { id: 'stone_brick', name: 'Stone Brick', shortName: 'Brick', category: 'plate', shape: 'brick', colorHex: 0xd6d3d1, cssColor: '#d6d3d1' },
  concrete: { id: 'concrete', name: 'Concrete', shortName: 'Concrete', category: 'plate', shape: 'brick', colorHex: 0x9ca3af, cssColor: '#9ca3af' },
  hazard_concrete: { id: 'hazard_concrete', name: 'Hazard Concrete', shortName: 'Haz-Conc', category: 'plate', shape: 'brick', colorHex: 0xeab308, cssColor: '#eab308' },

  // Logistics (packaged buildings use 'crate'; robots use 'engine')
  wooden_chest: { id: 'wooden_chest', name: 'Wooden Chest', shortName: 'Wood Chst', category: 'logistics', shape: 'crate', colorHex: 0xb45309, cssColor: '#b45309' },
  iron_chest: { id: 'iron_chest', name: 'Iron Chest', shortName: 'Iron Chst', category: 'logistics', shape: 'crate', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  steel_chest: { id: 'steel_chest', name: 'Steel Chest', shortName: 'Steel Chst', category: 'logistics', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  passive_provider_chest: { id: 'passive_provider_chest', name: 'Passive Provider Chest', shortName: 'Prov Chst', category: 'logistics', shape: 'crate', colorHex: 0xdc2626, cssColor: '#dc2626' },
  requester_chest: { id: 'requester_chest', name: 'Requester Chest', shortName: 'Req Chst', category: 'logistics', shape: 'crate', colorHex: 0x2563eb, cssColor: '#2563eb' },
  transport_belt: { id: 'transport_belt', name: 'Transport Belt', shortName: 'Belt T1', category: 'logistics', shape: 'crate', colorHex: 0xfacc15, cssColor: '#facc15' },
  fast_transport_belt: { id: 'fast_transport_belt', name: 'Fast Transport Belt', shortName: 'Fast Belt', category: 'logistics', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  express_transport_belt: { id: 'express_transport_belt', name: 'Express Transport Belt', shortName: 'Exp Belt', category: 'logistics', shape: 'crate', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  underground_belt: { id: 'underground_belt', name: 'Underground Belt', shortName: 'UG Belt', category: 'logistics', shape: 'crate', colorHex: 0xeab308, cssColor: '#eab308' },
  fast_underground_belt: { id: 'fast_underground_belt', name: 'Fast Underground Belt', shortName: 'Fast UG', category: 'logistics', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  express_underground_belt: { id: 'express_underground_belt', name: 'Express Underground Belt', shortName: 'Exp UG', category: 'logistics', shape: 'crate', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  splitter: { id: 'splitter', name: 'Splitter', shortName: 'Splitter', category: 'logistics', shape: 'crate', colorHex: 0xeab308, cssColor: '#eab308' },
  fast_splitter: { id: 'fast_splitter', name: 'Fast Splitter', shortName: 'Fast Spl', category: 'logistics', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  express_splitter: { id: 'express_splitter', name: 'Express Splitter', shortName: 'Exp Spl', category: 'logistics', shape: 'crate', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  burner_inserter: { id: 'burner_inserter', name: 'Burner Inserter', shortName: 'Brn Ins', category: 'logistics', shape: 'crate', colorHex: 0x78716c, cssColor: '#78716c' },
  inserter: { id: 'inserter', name: 'Inserter', shortName: 'Inserter', category: 'logistics', shape: 'crate', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  long_handed_inserter: { id: 'long_handed_inserter', name: 'Long-Handed Inserter', shortName: 'Long Ins', category: 'logistics', shape: 'crate', colorHex: 0xdc2626, cssColor: '#dc2626' },
  fast_inserter: { id: 'fast_inserter', name: 'Fast Inserter', shortName: 'Fast Ins', category: 'logistics', shape: 'crate', colorHex: 0x3b82f6, cssColor: '#3b82f6' },
  bulk_inserter: { id: 'bulk_inserter', name: 'Bulk Inserter', shortName: 'Bulk Ins', category: 'logistics', shape: 'crate', colorHex: 0x22c55e, cssColor: '#22c55e' },
  small_electric_pole: { id: 'small_electric_pole', name: 'Small Electric Pole', shortName: 'Sm Pole', category: 'logistics', shape: 'crate', colorHex: 0xa16207, cssColor: '#a16207' },
  medium_electric_pole: { id: 'medium_electric_pole', name: 'Medium Electric Pole', shortName: 'Med Pole', category: 'logistics', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  big_electric_pole: { id: 'big_electric_pole', name: 'Big Electric Pole', shortName: 'Big Pole', category: 'logistics', shape: 'crate', colorHex: 0x475569, cssColor: '#475569' },
  substation: { id: 'substation', name: 'Substation', shortName: 'Substation', category: 'logistics', shape: 'crate', colorHex: 0x0284c7, cssColor: '#0284c7' },
  pipe: { id: 'pipe', name: 'Pipe', shortName: 'Pipe', category: 'logistics', shape: 'crate', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  pipe_to_ground: { id: 'pipe_to_ground', name: 'Pipe to Ground', shortName: 'UG Pipe', category: 'logistics', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  pump: { id: 'pump', name: 'Pump', shortName: 'Pump', category: 'logistics', shape: 'crate', colorHex: 0x0ea5e9, cssColor: '#0ea5e9' },
  rail: { id: 'rail', name: 'Rail', shortName: 'Rail', category: 'logistics', shape: 'crate', colorHex: 0x78716c, cssColor: '#78716c' },
  train_stop: { id: 'train_stop', name: 'Train Stop', shortName: 'Train Stop', category: 'logistics', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  locomotive: { id: 'locomotive', name: 'Locomotive', shortName: 'Locomotive', category: 'logistics', shape: 'crate', colorHex: 0xdc2626, cssColor: '#dc2626' },
  cargo_wagon: { id: 'cargo_wagon', name: 'Cargo Wagon', shortName: 'Wagon', category: 'logistics', shape: 'crate', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  logistic_robot: { id: 'logistic_robot', name: 'Logistic Robot', shortName: 'Logi Bot', category: 'logistics', shape: 'engine', colorHex: 0xfbbf24, cssColor: '#fbbf24' },
  construction_robot: { id: 'construction_robot', name: 'Construction Robot', shortName: 'Con Bot', category: 'logistics', shape: 'engine', colorHex: 0xe2e8f0, cssColor: '#e2e8f0' },
  roboport: { id: 'roboport', name: 'Roboport', shortName: 'Roboport', category: 'logistics', shape: 'crate', colorHex: 0x3b82f6, cssColor: '#3b82f6' },

  // Production & Power
  burner_mining_drill: { id: 'burner_mining_drill', name: 'Burner Mining Drill', shortName: 'Brn Drill', category: 'production', shape: 'crate', colorHex: 0x78716c, cssColor: '#78716c' },
  electric_mining_drill: { id: 'electric_mining_drill', name: 'Electric Mining Drill', shortName: 'El Drill', category: 'production', shape: 'crate', colorHex: 0x0ea5e9, cssColor: '#0ea5e9' },
  pumpjack: { id: 'pumpjack', name: 'Pumpjack', shortName: 'Pumpjack', category: 'production', shape: 'crate', colorHex: 0x334155, cssColor: '#475569' },
  offshore_pump: { id: 'offshore_pump', name: 'Offshore Pump', shortName: 'Water Pump', category: 'production', shape: 'crate', colorHex: 0x0284c7, cssColor: '#0284c7' },
  stone_furnace: { id: 'stone_furnace', name: 'Stone Furnace', shortName: 'Stn Furn', category: 'production', shape: 'crate', colorHex: 0xa8a29e, cssColor: '#a8a29e' },
  steel_furnace: { id: 'steel_furnace', name: 'Steel Furnace', shortName: 'Stl Furn', category: 'production', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  electric_furnace: { id: 'electric_furnace', name: 'Electric Furnace', shortName: 'El Furn', category: 'production', shape: 'crate', colorHex: 0xf97316, cssColor: '#f97316' },
  assembling_machine_1: { id: 'assembling_machine_1', name: 'Assembling Machine 1', shortName: 'Asmb 1', category: 'production', shape: 'crate', colorHex: 0x60a5fa, cssColor: '#60a5fa' },
  assembling_machine_2: { id: 'assembling_machine_2', name: 'Assembling Machine 2', shortName: 'Asmb 2', category: 'production', shape: 'crate', colorHex: 0x2563eb, cssColor: '#2563eb' },
  assembling_machine_3: { id: 'assembling_machine_3', name: 'Assembling Machine 3', shortName: 'Asmb 3', category: 'production', shape: 'crate', colorHex: 0xeab308, cssColor: '#eab308' },
  oil_refinery: { id: 'oil_refinery', name: 'Oil Refinery', shortName: 'Refinery', category: 'production', shape: 'crate', colorHex: 0x334155, cssColor: '#334155' },
  chemical_plant: { id: 'chemical_plant', name: 'Chemical Plant', shortName: 'Chem Plnt', category: 'production', shape: 'crate', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  centrifuge: { id: 'centrifuge', name: 'Centrifuge', shortName: 'Centrifuge', category: 'production', shape: 'crate', colorHex: 0x22c55e, cssColor: '#22c55e' },
  boiler: { id: 'boiler', name: 'Boiler', shortName: 'Boiler', category: 'production', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  steam_engine: { id: 'steam_engine', name: 'Steam Engine', shortName: 'Steam Eng', category: 'production', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  steam_turbine: { id: 'steam_turbine', name: 'Steam Turbine', shortName: 'Turbine', category: 'production', shape: 'crate', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  solar_panel: { id: 'solar_panel', name: 'Solar Panel', shortName: 'Solar', category: 'production', shape: 'crate', colorHex: 0x1d4ed8, cssColor: '#1d4ed8' },
  accumulator: { id: 'accumulator', name: 'Accumulator', shortName: 'Accum', category: 'production', shape: 'crate', colorHex: 0x0ea5e9, cssColor: '#0ea5e9' },
  nuclear_reactor: { id: 'nuclear_reactor', name: 'Nuclear Reactor', shortName: 'Reactor', category: 'production', shape: 'crate', colorHex: 0x16a34a, cssColor: '#16a34a' },
  heat_exchanger: { id: 'heat_exchanger', name: 'Heat Exchanger', shortName: 'Heat Exch', category: 'production', shape: 'crate', colorHex: 0xea580c, cssColor: '#ea580c' },
  heat_pipe: { id: 'heat_pipe', name: 'Heat Pipe', shortName: 'Heat Pipe', category: 'production', shape: 'crate', colorHex: 0xf97316, cssColor: '#f97316' },
  lab: { id: 'lab', name: 'Lab', shortName: 'Lab', category: 'production', shape: 'crate', colorHex: 0xa855f7, cssColor: '#a855f7' },
  beacon: { id: 'beacon', name: 'Beacon', shortName: 'Beacon', category: 'production', shape: 'crate', colorHex: 0x38bdf8, cssColor: '#38bdf8' },
  rocket_silo: { id: 'rocket_silo', name: 'Rocket Silo', shortName: 'Silo', category: 'rocket', shape: 'crate', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  repair_pack: { id: 'repair_pack', name: 'Repair Pack', shortName: 'Repair', category: 'production', shape: 'module', colorHex: 0xeab308, cssColor: '#eab308' },
  speed_module: { id: 'speed_module', name: 'Speed Module', shortName: 'Spd Mod', category: 'production', shape: 'module', colorHex: 0x3b82f6, cssColor: '#3b82f6' },
  speed_module_2: { id: 'speed_module_2', name: 'Speed Module 2', shortName: 'Spd Mod 2', category: 'production', shape: 'module', colorHex: 0x1d4ed8, cssColor: '#1d4ed8' },
  efficiency_module: { id: 'efficiency_module', name: 'Efficiency Module', shortName: 'Eff Mod', category: 'production', shape: 'module', colorHex: 0x22c55e, cssColor: '#22c55e' },
  efficiency_module_2: { id: 'efficiency_module_2', name: 'Efficiency Module 2', shortName: 'Eff Mod 2', category: 'production', shape: 'module', colorHex: 0x15803d, cssColor: '#15803d' },
  productivity_module: { id: 'productivity_module', name: 'Productivity Module', shortName: 'Prd Mod', category: 'production', shape: 'module', colorHex: 0xef4444, cssColor: '#ef4444' },
  productivity_module_2: { id: 'productivity_module_2', name: 'Productivity Module 2', shortName: 'Prd Mod 2', category: 'production', shape: 'module', colorHex: 0xb91c1c, cssColor: '#b91c1c' },

  // Intermediates
  iron_stick: { id: 'iron_stick', name: 'Iron Stick', shortName: 'Fe Stick', category: 'intermediate', shape: 'coil', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  iron_gear: { id: 'iron_gear', name: 'Iron Gear Wheel', shortName: 'Gear', category: 'intermediate', shape: 'gear', colorHex: 0xcbd5e1, cssColor: '#cbd5e1' },
  copper_cable: { id: 'copper_cable', name: 'Copper Cable', shortName: 'Cable', category: 'intermediate', shape: 'coil', colorHex: 0xf97316, cssColor: '#f97316' },
  electronic_circuit: { id: 'electronic_circuit', name: 'Electronic Circuit', shortName: 'G-Circuit', category: 'intermediate', shape: 'circuit', colorHex: 0x22c55e, cssColor: '#22c55e' },
  plastic_bar: { id: 'plastic_bar', name: 'Plastic Bar', shortName: 'Plastic', category: 'intermediate', shape: 'brick', colorHex: 0xf8fafc, cssColor: '#f8fafc' },
  sulfur: { id: 'sulfur', name: 'Sulfur', shortName: 'Sulfur', category: 'intermediate', shape: 'ore', colorHex: 0xfde047, cssColor: '#fde047' },
  battery: { id: 'battery', name: 'Battery', shortName: 'Battery', category: 'intermediate', shape: 'battery', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  explosives: { id: 'explosives', name: 'Explosives', shortName: 'Explosiv', category: 'intermediate', shape: 'barrel', colorHex: 0xef4444, cssColor: '#ef4444' },
  engine_unit: { id: 'engine_unit', name: 'Engine Unit', shortName: 'Engine', category: 'intermediate', shape: 'engine', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  electric_engine_unit: { id: 'electric_engine_unit', name: 'Electric Engine Unit', shortName: 'El Eng', category: 'intermediate', shape: 'engine', colorHex: 0xef4444, cssColor: '#ef4444' },
  flying_robot_frame: { id: 'flying_robot_frame', name: 'Flying Robot Frame', shortName: 'Bot Frm', category: 'intermediate', shape: 'engine', colorHex: 0xeab308, cssColor: '#eab308' },
  advanced_circuit: { id: 'advanced_circuit', name: 'Advanced Circuit', shortName: 'R-Circuit', category: 'intermediate', shape: 'circuit', colorHex: 0xef4444, cssColor: '#ef4444' },
  low_density_structure: { id: 'low_density_structure', name: 'Low Density Structure', shortName: 'LDS', category: 'intermediate', shape: 'plate', colorHex: 0xfbbf24, cssColor: '#fbbf24' },
  solid_fuel: { id: 'solid_fuel', name: 'Solid Fuel', shortName: 'Solid Fl', category: 'intermediate', shape: 'barrel', colorHex: 0x334155, cssColor: '#64748b' },
  rocket_fuel: { id: 'rocket_fuel', name: 'Rocket Fuel', shortName: 'Rkt Fuel', category: 'intermediate', shape: 'barrel', colorHex: 0xf43f5e, cssColor: '#f43f5e' },
  rocket_control_unit: { id: 'rocket_control_unit', name: 'Rocket Control Unit', shortName: 'RCU', category: 'intermediate', shape: 'module', colorHex: 0x06b6d4, cssColor: '#06b6d4' },
  processing_unit: { id: 'processing_unit', name: 'Processing Unit', shortName: 'Blue CPU', category: 'intermediate', shape: 'circuit', colorHex: 0x2563eb, cssColor: '#2563eb' },
  rocket_part: { id: 'rocket_part', name: 'Rocket Part', shortName: 'Rocket Core', category: 'rocket', shape: 'module', colorHex: 0xf59e0b, cssColor: '#f59e0b' },

  // Combat & Defense
  firearm_magazine: { id: 'firearm_magazine', name: 'Firearm Magazine', shortName: 'Ammo', category: 'combat', shape: 'ammo', colorHex: 0xeab308, cssColor: '#eab308' },
  piercing_rounds_magazine: { id: 'piercing_rounds_magazine', name: 'Piercing Rounds Mag', shortName: 'AP Ammo', category: 'combat', shape: 'ammo', colorHex: 0xef4444, cssColor: '#ef4444' },
  grenade: { id: 'grenade', name: 'Grenade', shortName: 'Grenade', category: 'combat', shape: 'grenade', colorHex: 0x4d7c0f, cssColor: '#65a30d' },
  stone_wall: { id: 'stone_wall', name: 'Wall', shortName: 'Wall', category: 'combat', shape: 'brick', colorHex: 0xa8a29e, cssColor: '#a8a29e' },
  gate: { id: 'gate', name: 'Gate', shortName: 'Gate', category: 'combat', shape: 'crate', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  gun_turret: { id: 'gun_turret', name: 'Gun Turret', shortName: 'Gun Tur', category: 'combat', shape: 'crate', colorHex: 0xf97316, cssColor: '#f97316' },
  laser_turret: { id: 'laser_turret', name: 'Laser Turret', shortName: 'Las Tur', category: 'combat', shape: 'crate', colorHex: 0xef4444, cssColor: '#ef4444' },
  radar: { id: 'radar', name: 'Radar', shortName: 'Radar', category: 'combat', shape: 'crate', colorHex: 0x64748b, cssColor: '#64748b' },
  light_armor: { id: 'light_armor', name: 'Light Armor', shortName: 'Lt Armor', category: 'combat', shape: 'armor', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  heavy_armor: { id: 'heavy_armor', name: 'Heavy Armor', shortName: 'Hv Armor', category: 'combat', shape: 'armor', colorHex: 0x475569, cssColor: '#475569' },
  modular_armor: { id: 'modular_armor', name: 'Modular Armor', shortName: 'Mod Armor', category: 'combat', shape: 'armor', colorHex: 0x3b82f6, cssColor: '#3b82f6' },
  power_armor: { id: 'power_armor', name: 'Power Armor', shortName: 'Pwr Armor', category: 'combat', shape: 'armor', colorHex: 0xf59e0b, cssColor: '#f59e0b' },

  // Science Packs
  automation_science: { id: 'automation_science', name: 'Automation Science Pack', shortName: 'Red Sci', category: 'science', shape: 'science', colorHex: 0xef4444, cssColor: '#ef4444' },
  logistic_science: { id: 'logistic_science', name: 'Logistic Science Pack', shortName: 'Green Sci', category: 'science', shape: 'science', colorHex: 0x22c55e, cssColor: '#22c55e' },
  military_science: { id: 'military_science', name: 'Military Science Pack', shortName: 'Gray Sci', category: 'science', shape: 'science', colorHex: 0x64748b, cssColor: '#94a3b8' },
  chemical_science: { id: 'chemical_science', name: 'Chemical Science Pack', shortName: 'Blue Sci', category: 'science', shape: 'science', colorHex: 0x38bdf8, cssColor: '#38bdf8' },
  production_science: { id: 'production_science', name: 'Production Science Pack', shortName: 'Purple Sci', category: 'science', shape: 'science', colorHex: 0xa855f7, cssColor: '#a855f7' },
  utility_science: { id: 'utility_science', name: 'Utility Science Pack', shortName: 'Yellow Sci', category: 'science', shape: 'science', colorHex: 0xfacc15, cssColor: '#facc15' },
  space_science: { id: 'space_science', name: 'Space Science Pack', shortName: 'White Sci', category: 'science', shape: 'science', colorHex: 0xf8fafc, cssColor: '#f8fafc' },
  metallurgic_science: { id: 'metallurgic_science', name: 'Metallurgic Science Pack', shortName: 'Orange Sci', category: 'science', shape: 'science', colorHex: 0xf97316, cssColor: '#f97316' },
  agricultural_science: { id: 'agricultural_science', name: 'Agricultural Science Pack', shortName: 'Lime Sci', category: 'science', shape: 'science', colorHex: 0xa3e635, cssColor: '#a3e635' },
  electromagnetic_science: { id: 'electromagnetic_science', name: 'Electromagnetic Science Pack', shortName: 'Cyan Sci', category: 'science', shape: 'science', colorHex: 0xe879f9, cssColor: '#e879f9' },
};

export interface ParsedCapytorioLuaCatalog {
  recipes: CapytorioRecipeSpec[];
  techs: CapytorioTechSpec[];
  items: Record<string, CapytorioItemMeta>;
}

export function parseCapytorioLuaCatalog(
  recipeLuaSource: string,
  technologyLuaSource: string
): ParsedCapytorioLuaCatalog {
  const items: Record<string, CapytorioItemMeta> = { ...CURATED_CAPYTORIO_ITEMS };
  const ensureItem = (id: CapytorioItemId) => {
    if (id && !items[id]) {
      items[id] = createProceduralItemMeta(id);
    }
  };

  // 1. Parse technologies first so recipe unlock effects can link cleanly
  const techParser = new LuaDataExtendParser(tokenizeLua(technologyLuaSource));
  const techExtendTables = techParser.extractExtendTables();
  const techs: CapytorioTechSpec[] = [];
  const recipeUnlockedByTech = new Map<string, CapytorioTechId>();

  for (const extendTbl of techExtendTables) {
    for (const protoVal of extendTbl.array) {
      if (!isTable(protoVal)) continue;
      if (getString(protoVal, 'type') !== 'technology') continue;
      const rawTechId = getString(protoVal, 'name');
      if (!rawTechId) continue;
      const id = normalizeFactorioId(rawTechId);

      // Parse prerequisites
      const prereqTbl = getTable(protoVal, 'prerequisites');
      const prerequisites: CapytorioTechId[] = [];
      if (prereqTbl) {
        for (const pv of prereqTbl.array) {
          if (typeof pv === 'string' && pv.trim()) {
            prerequisites.push(normalizeFactorioId(pv));
          }
        }
      }

      // Parse effects (unlock-recipe)
      const unlockedList: string[] = [];
      const effectsTbl = getTable(protoVal, 'effects');
      if (effectsTbl) {
        for (const ev of effectsTbl.array) {
          if (!isTable(ev)) continue;
          if (getString(ev, 'type') === 'unlock-recipe') {
            const recName = getString(ev, 'recipe');
            if (recName) {
              const normRec = normalizeFactorioId(recName);
              unlockedList.push(normRec);
              if (!recipeUnlockedByTech.has(normRec)) {
                recipeUnlockedByTech.set(normRec, id);
              }
            }
          }
        }
      }

      // Parse unit { count, ingredients, time }
      const cost: Partial<Record<CapytorioItemId, number>> = {};
      const unitTbl = getTable(protoVal, 'unit');
      if (unitTbl) {
        const unitCount = Math.max(1, Math.round(getNumber(unitTbl, 'count') ?? 1));
        const unitIngTbl = getTable(unitTbl, 'ingredients');
        if (unitIngTbl) {
          for (const entry of unitIngTbl.array) {
            const parsed = parseItemAmountEntry(entry);
            if (!parsed) continue;
            ensureItem(parsed.item);
            cost[parsed.item] = (cost[parsed.item] ?? 0) + parsed.count * unitCount;
          }
        }
      }

      const maxLevel = protoVal.map['max_level'];
      const repeatable =
        getBoolean(protoVal, 'upgrade') === true ||
        maxLevel === 'infinite' ||
        (typeof maxLevel === 'number' && maxLevel > 1);

      const label = getString(protoVal, 'capytorio_label') ?? formatProceduralTitle(id);
      const subtitle =
        getString(protoVal, 'subtitle') ??
        (unlockedList.length > 0
          ? `Unlocks ${unlockedList.map(formatProceduralTitle).join(', ')}`
          : 'Factorio Prototype Research');
      const effectSummary =
        getString(protoVal, 'effect_summary') ??
        (unlockedList.length > 0
          ? `Unlocks ${unlockedList.map(formatProceduralTitle).join(', ')}`
          : `+${Math.round(getNumber(protoVal, 'reward_dna') ?? 8)} DNA Reward`);

      techs.push({
        id,
        name: label,
        subtitle,
        cost,
        prerequisites,
        effectSummary,
        repeatable: repeatable || undefined,
        rewardDna: Math.max(1, Math.round(getNumber(protoVal, 'reward_dna') ?? (repeatable ? 15 : 4 + techs.length))),
        rewardCoins: Math.max(0, Math.round(getNumber(protoVal, 'reward_coins') ?? 0)),
      });
    }
  }

  // 2. Parse recipes (handles top-level and Factorio `normal` nested variants, plus 1.1 & 2.0 shapes)
  const recParser = new LuaDataExtendParser(tokenizeLua(recipeLuaSource));
  const recExtendTables = recParser.extractExtendTables();
  const recipes: CapytorioRecipeSpec[] = [];
  const seenRecipeIds = new Set<string>();

  for (const extendTbl of recExtendTables) {
    for (const protoVal of extendTbl.array) {
      if (!isTable(protoVal)) continue;
      if (getString(protoVal, 'type') !== 'recipe') continue;
      const rawRecName = getString(protoVal, 'name');
      if (!rawRecName) continue;
      const id = normalizeFactorioId(rawRecName);
      if (!id || seenRecipeIds.has(id)) continue;

      const normalTbl = getTable(protoVal, 'normal') ?? protoVal;
      const ingTbl = getTable(normalTbl, 'ingredients') ?? getTable(protoVal, 'ingredients');
      if (!ingTbl) continue;

      const ingredients: Array<{ item: CapytorioItemId; count: number }> = [];
      for (const ingEntry of ingTbl.array) {
        const parsed = parseItemAmountEntry(ingEntry);
        if (!parsed) continue;
        ensureItem(parsed.item);
        ingredients.push(parsed);
      }
      if (ingredients.length === 0) continue;

      // Extract primary result item + count
      let result: CapytorioItemId | undefined;
      let resultCount = 1;
      const resultsTbl = getTable(normalTbl, 'results') ?? getTable(protoVal, 'results');
      if (resultsTbl && resultsTbl.array.length > 0) {
        const firstRes = parseItemAmountEntry(resultsTbl.array[0]);
        if (firstRes) {
          result = firstRes.item;
          resultCount = firstRes.count;
        }
      }
      if (!result) {
        const singleRes = getString(normalTbl, 'result') ?? getString(protoVal, 'result');
        if (singleRes) {
          result = normalizeFactorioId(singleRes);
          resultCount = Math.max(
            1,
            Math.round(getNumber(normalTbl, 'result_count') ?? getNumber(protoVal, 'result_count') ?? 1)
          );
        }
      }
      if (!result) continue;
      ensureItem(result);

      const category = getString(protoVal, 'category') ?? 'crafting';
      const station: 'furnace' | 'assembler' = category === 'smelting' ? 'furnace' : 'assembler';
      const energyRequired = Math.max(
        0.2,
        getNumber(normalTbl, 'energy_required') ?? getNumber(protoVal, 'energy_required') ?? 1.5
      );
      const requiredTechId = recipeUnlockedByTech.get(id);
      const explicitEnabled = getBoolean(normalTbl, 'enabled') ?? getBoolean(protoVal, 'enabled');
      const unlockedByDefault =
        explicitEnabled !== undefined ? explicitEnabled : requiredTechId ? false : true;
      const explicitPocket = getBoolean(protoVal, 'pocket_craftable');
      const pocketCraftable =
        explicitPocket !== undefined
          ? explicitPocket
          : station === 'assembler' && category !== 'rocket-building' && id !== 'rocket_part';

      const name =
        getString(protoVal, 'capytorio_label') ??
        items[result]?.name ??
        formatProceduralTitle(id);

      const rawSubgroup = getString(protoVal, 'subgroup');
      const resultMeta = items[result];
      let group: 'logistics' | 'production' | 'intermediate' | 'combat' | 'science' = 'intermediate';
      if (rawSubgroup === 'logistics' || rawSubgroup === 'transport' || rawSubgroup === 'belt' || rawSubgroup === 'inserter' || rawSubgroup === 'energy-pipe-distribution') {
        group = 'logistics';
      } else if (rawSubgroup === 'production' || rawSubgroup === 'extraction-machine' || rawSubgroup === 'smelting-machine' || rawSubgroup === 'energy' || rawSubgroup === 'module') {
        group = 'production';
      } else if (rawSubgroup === 'combat' || rawSubgroup === 'military' || rawSubgroup === 'defensive-structure' || rawSubgroup === 'armor') {
        group = 'combat';
      } else if (rawSubgroup === 'science' || rawSubgroup === 'science-pack' || rawSubgroup === 'rocket' || resultMeta?.category === 'science' || resultMeta?.category === 'rocket') {
        group = 'science';
      } else if (resultMeta?.category === 'logistics') {
        group = 'logistics';
      } else if (resultMeta?.category === 'production') {
        group = 'production';
      } else if (resultMeta?.category === 'combat') {
        group = 'combat';
      }

      seenRecipeIds.add(id);
      recipes.push({
        id,
        name,
        station,
        group,
        ingredients,
        result,
        resultCount,
        craftTimeSec: +energyRequired.toFixed(2),
        unlockedByDefault,
        requiredTechId,
        pocketCraftable,
      });
    }
  }

  return { recipes, techs, items };
}
