import type { CapytorioSerializedState } from '../CapytorioFactoryEngine';

export const CAPYTORIO_WORLD_ORIGIN_X_CONST = 1200;
export const CAPYTORIO_WORLD_ORIGIN_Z_CONST = 0;
export const CAPYTORIO_TILE_SIZE_CONST = 2.5;

export function capytorioGridToWorldXLite(gx: number): number {
  return CAPYTORIO_WORLD_ORIGIN_X_CONST + gx * CAPYTORIO_TILE_SIZE_CONST;
}

export function capytorioGridToWorldZLite(gz: number): number {
  return CAPYTORIO_WORLD_ORIGIN_Z_CONST + gz * CAPYTORIO_TILE_SIZE_CONST;
}

export function worldToCapytorioGridXLite(wx: number): number {
  return Math.round((wx - CAPYTORIO_WORLD_ORIGIN_X_CONST) / CAPYTORIO_TILE_SIZE_CONST);
}

export function worldToCapytorioGridZLite(wz: number): number {
  return Math.round((wz - CAPYTORIO_WORLD_ORIGIN_Z_CONST) / CAPYTORIO_TILE_SIZE_CONST);
}

/**
 * Lightweight zero-dependency structural guard for Capytorio saved state during cold boot.
 * Full machine/recipe/tech validation runs lazily when CapytorioFactoryEngine hydrates on mode entry,
 * keeping CapytorioFactoryEngine, FactorioBlueprintCodec, and Lua catalogs out of the boot bundle.
 */
export function sanitizeCapytorioStateShallow(
  raw: unknown
): CapytorioSerializedState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Partial<CapytorioSerializedState>;
  if (candidate.version !== 1) return undefined;
  if (!Array.isArray(candidate.machines)) return undefined;
  try {
    return structuredClone(candidate) as CapytorioSerializedState;
  } catch {
    return candidate as CapytorioSerializedState;
  }
}
