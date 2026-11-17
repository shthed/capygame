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
  calcite: 'calcite',
  stone: 'calcite',
  'yuzu-sap': 'yuzu_sap',
  'iron-plate': 'iron_plate',
  'copper-plate': 'copper_plate',
  'steel-plate': 'steel_plate',
  'stone-brick': 'stone_brick',
  'iron-gear-wheel': 'iron_gear',
  'iron-gear': 'iron_gear',
  'copper-cable': 'copper_cable',
  'electronic-circuit': 'electronic_circuit',
  'plastic-bar': 'plastic_bar',
  sulfur: 'sulfur',
  'advanced-circuit': 'advanced_circuit',
  'low-density-structure': 'low_density_structure',
  'rocket-fuel': 'rocket_fuel',
  'processing-unit': 'processing_unit',
  'rocket-part': 'rocket_part',
  'automation-science-pack': 'automation_science',
  'logistic-science-pack': 'logistic_science',
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
        if (src[i] === '\\' && i + 1 < len) {
          const esc = src[i + 1];
          if (esc === 'n') out += '\n';
          else if (esc === 't') out += '\t';
          else if (esc === 'r') out += '\r';
          else out += esc;
          i += 2;
        } else {
          out += src[i];
          i++;
        }
      }
      if (src[i] === quote) i++;
      tokens.push({ type: 'string', value: out });
      continue;
    }

    // Signed or unsigned numeric literal
    const isNegNum =
      ch === '-' &&
      ((src[i + 1] >= '0' && src[i + 1] <= '9') ||
        (src[i + 1] === '.' && src[i + 2] >= '0' && src[i + 2] <= '9')) &&
      (tokens.length === 0 ||
        tokens[tokens.length - 1].type === 'punct' &&
          ['=', ',', ';', '{', '(', '['].includes(tokens[tokens.length - 1].value));
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
        while (i < len && /[0-9.]/.test(src[i])) i++;
        if ((src[i] === 'e' || src[i] === 'E') && i + 1 < len) {
          i++;
          if (src[i] === '+' || src[i] === '-') i++;
          while (i < len && /[0-9]/.test(src[i])) i++;
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
    const t = this.peek();
    if (t.type === 'string') {
      this.consume();
      // Support string concatenation `..`
      let val = t.value;
      while (this.peek().value === '.' && this.peek(1).value === '.') {
        this.pos += 2;
        const rhs = this.parseExpression();
        val += String(rhs ?? '');
      }
      return val;
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
      if (this.env.has(t.value)) return this.env.get(t.value)!;
      // Consume simple function call fallback e.g. table.deepcopy(x) or mods["foo"]
      if (this.peek().value === '.' || this.peek().value === ':') {
        while (this.peek().value === '.' || this.peek().value === ':') {
          this.consume();
          if (this.peek().type === 'ident') this.consume();
        }
      }
      if (this.peek().value === '(') {
        this.consumeBalanced('(', ')');
      }
      return t.value;
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
      const inner = this.parseExpression();
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
  if (id.includes('rocket_part')) return 'rocket';
  if (id.endsWith('_ore') || id === 'coal' || id === 'calcite' || id === 'yuzu_sap') return 'ore';
  if (id.endsWith('_plate') || id.endsWith('_brick')) return 'plate';
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

export function createProceduralItemMeta(id: CapytorioItemId): CapytorioItemMeta {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  const colorHex = hslToRgbHex(hue, 72, 58);
  const cssColor = '#' + colorHex.toString(16).padStart(6, '0');
  return {
    id,
    name: formatProceduralTitle(id),
    shortName: formatProceduralShortName(id),
    category: inferProceduralCategory(id),
    colorHex,
    cssColor,
  };
}

export const CURATED_CAPYTORIO_ITEMS: Record<string, CapytorioItemMeta> = {
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', shortName: 'Fe Ore', category: 'ore', colorHex: 0x60a5fa, cssColor: '#60a5fa' },
  copper_ore: { id: 'copper_ore', name: 'Copper Ore', shortName: 'Cu Ore', category: 'ore', colorHex: 0xf97316, cssColor: '#f97316' },
  coal: { id: 'coal', name: 'Coal Seam', shortName: 'Coal', category: 'ore', colorHex: 0x475569, cssColor: '#64748b' },
  calcite: { id: 'calcite', name: 'Volcanic Calcite', shortName: 'Calcite', category: 'ore', colorHex: 0xf1f5f9, cssColor: '#f1f5f9' },
  yuzu_sap: { id: 'yuzu_sap', name: 'Bio-Yuzu Nutrient', shortName: 'Yuzu Sap', category: 'ore', colorHex: 0xfacc15, cssColor: '#facc15' },
  iron_plate: { id: 'iron_plate', name: 'Iron Plate', shortName: 'Fe Plate', category: 'plate', colorHex: 0xcbd5e1, cssColor: '#cbd5e1' },
  copper_plate: { id: 'copper_plate', name: 'Copper Plate', shortName: 'Cu Plate', category: 'plate', colorHex: 0xfb923c, cssColor: '#fb923c' },
  steel_plate: { id: 'steel_plate', name: 'Steel Beam', shortName: 'Steel', category: 'plate', colorHex: 0x94a3b8, cssColor: '#94a3b8' },
  stone_brick: { id: 'stone_brick', name: 'Calcite Brick', shortName: 'Brick', category: 'plate', colorHex: 0xe7e5e4, cssColor: '#e7e5e4' },
  iron_gear: { id: 'iron_gear', name: 'Iron Gear Wheel', shortName: 'Gear', category: 'intermediate', colorHex: 0x93c5fd, cssColor: '#93c5fd' },
  copper_cable: { id: 'copper_cable', name: 'Copper Cable', shortName: 'Cable', category: 'intermediate', colorHex: 0xfdba74, cssColor: '#fdba74' },
  electronic_circuit: { id: 'electronic_circuit', name: 'Green Circuit', shortName: 'G-Circuit', category: 'intermediate', colorHex: 0x22c55e, cssColor: '#22c55e' },
  plastic_bar: { id: 'plastic_bar', name: 'Bioplastic Bar', shortName: 'Plastic', category: 'intermediate', colorHex: 0xfef08a, cssColor: '#fef08a' },
  sulfur: { id: 'sulfur', name: 'Biosulfur Crystal', shortName: 'Sulfur', category: 'intermediate', colorHex: 0xeab308, cssColor: '#eab308' },
  advanced_circuit: { id: 'advanced_circuit', name: 'Red Circuit', shortName: 'R-Circuit', category: 'intermediate', colorHex: 0xef4444, cssColor: '#ef4444' },
  low_density_structure: { id: 'low_density_structure', name: 'Low-Density Alloy', shortName: 'LDS', category: 'intermediate', colorHex: 0xfbbf24, cssColor: '#fbbf24' },
  rocket_fuel: { id: 'rocket_fuel', name: 'Bio-Rocket Fuel', shortName: 'Fuel', category: 'intermediate', colorHex: 0xf43f5e, cssColor: '#f43f5e' },
  processing_unit: { id: 'processing_unit', name: 'Blue Processor', shortName: 'Blue CPU', category: 'intermediate', colorHex: 0x3b82f6, cssColor: '#3b82f6' },
  rocket_part: { id: 'rocket_part', name: 'Rocket Launch Core', shortName: 'Rocket Core', category: 'rocket', colorHex: 0xf59e0b, cssColor: '#f59e0b' },
  automation_science: { id: 'automation_science', name: 'Automation Science Pack', shortName: 'Red Sci', category: 'science', colorHex: 0xef4444, cssColor: '#ef4444' },
  logistic_science: { id: 'logistic_science', name: 'Logistic Science Pack', shortName: 'Green Sci', category: 'science', colorHex: 0x22c55e, cssColor: '#22c55e' },
  metallurgic_science: { id: 'metallurgic_science', name: 'Metallurgic Science Pack', shortName: 'Orange Sci', category: 'science', colorHex: 0xf97316, cssColor: '#f97316' },
  agricultural_science: { id: 'agricultural_science', name: 'Agricultural Science Pack', shortName: 'Lime Sci', category: 'science', colorHex: 0xa3e635, cssColor: '#a3e635' },
  electromagnetic_science: { id: 'electromagnetic_science', name: 'Electromagnetic Science Pack', shortName: 'Cyan Sci', category: 'science', colorHex: 0xe879f9, cssColor: '#e879f9' },
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
        rewardDna: Math.max(1, Math.round(getNumber(protoVal, 'reward_dna') ?? (repeatable ? 15 : 6 + techs.length * 2))),
        rewardCoins: Math.max(5, Math.round(getNumber(protoVal, 'reward_coins') ?? (repeatable ? 50 : 15 + techs.length * 5))),
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

      seenRecipeIds.add(id);
      recipes.push({
        id,
        name,
        station,
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
