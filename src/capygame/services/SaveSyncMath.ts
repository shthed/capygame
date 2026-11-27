import type { PlayerStats } from '../types';
import type { ProceduralGameConfig } from '../config/ProceduralGameConfig';
import type { QuantizedGhostRun } from '../engine/physics/YuzuGhostRecorder';

export interface SaveSnapshotSummary {
  updatedAtMs: number;
  updatedAtIso: string;
  coins: number;
  dna: number;
  prestigeLevel: number;
  sanctuaryBuildings: number;
  capytorioEntities: number;
  specimensDiscovered: number;
  yuzuBestMs: number | null;
  worldPresetName: string;
  worldSeed: number | null;
}

export type SyncConflictRecommendation = 'local' | 'remote' | 'equal';

export interface SaveSnapshotComparison {
  recommendation: SyncConflictRecommendation;
  timeDiffMs: number;
  hasMeaningfulDifference: boolean;
  reason: string;
}

export function buildSaveSnapshotSummary(input: {
  stats: PlayerStats;
  proceduralConfig?: ProceduralGameConfig | null;
  yuzuGhostRun?: QuantizedGhostRun | null;
  updatedAtMs?: number;
  exportedAtIso?: string;
}): SaveSnapshotSummary {
  const parsedIsoMs =
    typeof input.exportedAtIso === 'string' ? Date.parse(input.exportedAtIso) : Number.NaN;
  const updatedAtMs =
    typeof input.updatedAtMs === 'number' && Number.isFinite(input.updatedAtMs) && input.updatedAtMs > 0
      ? Math.round(input.updatedAtMs)
      : Number.isFinite(parsedIsoMs) && parsedIsoMs > 0
        ? Math.round(parsedIsoMs)
        : Date.now();
  const updatedAtIso =
    typeof input.exportedAtIso === 'string' && input.exportedAtIso.trim().length > 0
      ? input.exportedAtIso
      : new Date(updatedAtMs).toISOString();

  const capyFactory = input.stats.capytorioFactory;
  const capytorioEntities =
    capyFactory && Array.isArray(capyFactory.machines) ? capyFactory.machines.length : 0;

  return {
    updatedAtMs,
    updatedAtIso,
    coins: Math.max(0, Math.round(input.stats.coins || 0)),
    dna: Math.max(0, Math.round(input.stats.dna || 0)),
    prestigeLevel: Math.max(1, Math.round(input.stats.prestigeLevel || 1)),
    sanctuaryBuildings: Array.isArray(input.stats.buildings) ? input.stats.buildings.length : 0,
    capytorioEntities,
    specimensDiscovered: Array.isArray(input.stats.discoveredForestSpecimens)
      ? input.stats.discoveredForestSpecimens.length
      : 0,
    yuzuBestMs:
      input.yuzuGhostRun && Number.isFinite(input.yuzuGhostRun.durationMs)
        ? Math.round(input.yuzuGhostRun.durationMs)
        : null,
    worldPresetName: input.proceduralConfig?.meta.configName ?? 'Standard World',
    worldSeed:
      typeof input.proceduralConfig?.meta.seed === 'number'
        ? input.proceduralConfig.meta.seed
        : null,
  };
}

export function compareSaveSnapshots(
  local: SaveSnapshotSummary,
  remote: SaveSnapshotSummary,
  remoteLabel: string = 'Cloud backup'
): SaveSnapshotComparison {
  const timeDiffMs = remote.updatedAtMs - local.updatedAtMs;

  const sameProgress =
    local.coins === remote.coins &&
    local.dna === remote.dna &&
    local.prestigeLevel === remote.prestigeLevel &&
    local.sanctuaryBuildings === remote.sanctuaryBuildings &&
    local.capytorioEntities === remote.capytorioEntities &&
    local.specimensDiscovered === remote.specimensDiscovered &&
    local.yuzuBestMs === remote.yuzuBestMs &&
    local.worldSeed === remote.worldSeed;

  if (sameProgress && Math.abs(timeDiffMs) < 2000) {
    return {
      recommendation: 'equal',
      timeDiffMs,
      hasMeaningfulDifference: false,
      reason: `Local and ${remoteLabel.toLowerCase()} snapshots match.`,
    };
  }

  const localScore =
    local.prestigeLevel * 10_000 +
    local.capytorioEntities * 250 +
    local.sanctuaryBuildings * 120 +
    local.specimensDiscovered * 200 +
    local.coins +
    local.dna * 4;
  const remoteScore =
    remote.prestigeLevel * 10_000 +
    remote.capytorioEntities * 250 +
    remote.sanctuaryBuildings * 120 +
    remote.specimensDiscovered * 200 +
    remote.coins +
    remote.dna * 4;

  if (Math.abs(timeDiffMs) >= 5000) {
    if (timeDiffMs > 0) {
      return {
        recommendation: 'remote',
        timeDiffMs,
        hasMeaningfulDifference: !sameProgress,
        reason: `${remoteLabel} has a newer timestamp.`,
      };
    }
    return {
      recommendation: 'local',
      timeDiffMs,
      hasMeaningfulDifference: !sameProgress,
      reason: 'This device has a newer save timestamp.',
    };
  }

  if (remoteScore > localScore) {
    return {
      recommendation: 'remote',
      timeDiffMs,
      hasMeaningfulDifference: true,
      reason: `${remoteLabel} contains further game progression.`,
    };
  }
  if (localScore > remoteScore) {
    return {
      recommendation: 'local',
      timeDiffMs,
      hasMeaningfulDifference: true,
      reason: 'This device contains further game progression.',
    };
  }

  return {
    recommendation: 'equal',
    timeDiffMs,
    hasMeaningfulDifference: !sameProgress,
    reason: 'Snapshots have equivalent progression.',
  };
}

export function formatSaveTimestamp(isoOrMs: string | number | null | undefined): string {
  if (isoOrMs === null || isoOrMs === undefined) return 'Never';
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ms) || ms <= 0) return 'Unknown time';
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export function formatGhostTimeSec(durationMs: number | null | undefined): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return 'None';
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}
