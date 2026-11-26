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

export type CapytorioClipboardPointerAction =
  | 'none'
  | 'clipboard_move'
  | 'position_blueprint'
  | 'paste_tap_or_move'
  | 'select_box'
  | 'select_lasso';

export interface CapytorioClipboardPointerInput {
  clipState: 'off' | 'select_copy' | 'select_cut' | 'paste';
  selectionShape: 'box' | 'lasso';
  button: number;
  clipboardMoveMode: boolean;
  isSpaceHeld: boolean;
  hitInsideBlueprintGhost: boolean;
  pointerType?: string;
  hasLockedPasteAnchor?: boolean;
}

/**
 * Pure interaction router for Capytorio Copy/Cut/Paste pointer gestures.
 * Allows moving across the factory while carrying a blueprint or copy/cut tool via:
 * - Explicit Move mode toggle in the clipboard bar
 * - Right-click drag or Middle-click drag
 * - Space + Left-drag (hand tool)
 * - Dragging on desktop while the paste ghost is unlocked (click locks; drag walks)
 * - Dragging outside the blueprint footprint in Paste mode (quick tap snaps the ghost; drag walks)
 */
export function resolveCapytorioClipboardPointerAction(
  input: CapytorioClipboardPointerInput
): CapytorioClipboardPointerAction {
  if (input.clipState === 'off') return 'none';

  // Right-drag, Middle-drag, explicit Move mode, or Space-hold always allow moving without cancelling clipboard
  if (
    input.clipboardMoveMode ||
    input.button === 1 ||
    input.button === 2 ||
    (input.isSpaceHeld && input.button === 0)
  ) {
    return 'clipboard_move';
  }

  if (input.clipState === 'paste' && input.button === 0) {
    // On mouse, an unlocked ghost tracks hover continuously; left-click locks it and left-drag walks.
    if (input.pointerType === 'mouse' && input.hasLockedPasteAnchor === false) {
      return 'paste_tap_or_move';
    }
    return input.hitInsideBlueprintGhost ? 'position_blueprint' : 'paste_tap_or_move';
  }

  if (
    (input.clipState === 'select_copy' || input.clipState === 'select_cut') &&
    input.button === 0
  ) {
    return input.selectionShape === 'lasso' ? 'select_lasso' : 'select_box';
  }

  return 'none';
}

