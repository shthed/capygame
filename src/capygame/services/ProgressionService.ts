import {
  BUILDING_CATALOG,
  BuildingType,
  CapyGameSettings,
  COSMETIC_COIN_COSTS,
  DEFAULT_CAPY_SETTINGS,
  INITIAL_PLAYER_STATS,
  MutationId,
  OBJECT_MARKERS_COIN_COST,
  OBJECT_MARKERS_DNA_COST,
  PlayerStats,
  PlayStyle,
  PRESTIGE_BASE_DNA_COST,
  REALITY_RESCALER_COIN_COST,
  REALITY_RESCALER_DNA_COST,
  SPORE_MUTATIONS,
  WorldBuilding,
} from '../types';
import {
  QuantizedGhostRun,
  loadBestYuzuGhostRun,
  parseAndValidateGhostRun,
  saveYuzuGhostRunDirect,
} from '../engine/physics/YuzuGhostRecorder';
import type { ForestMicroSpecimenId } from '../engine/forestMicroSpecimens';
import {
  mergeDiscoveredSpecimen,
  sanitizeDiscoveredSpecimens,
} from '../engine/UniverseScaleMath';
import {
  applyBountyEvent,
  sanitizeBountyState,
  type BountyCatalogSpec,
  type BountyEventType,
} from '../engine/GameplayFunMath';

import { sanitizeCapytorioStateShallow } from '../engine/capytorio/CapytorioStateGuard';
import { CAPYGAME_VERSION } from '../config/appVersion';
import {
  type ProceduralGameConfig,
  hasCompletedFirstRunSetup,
  loadSavedProceduralConfig,
  markFirstRunSetupComplete,
  parseAndValidateProceduralConfig,
  saveProceduralConfig,
} from '../config/ProceduralGameConfig';
import {
  type SaveSnapshotSummary,
  buildSaveSnapshotSummary,
} from './SaveSyncMath';

const SAVE_KEY = 'capy_game_save_v3';
const LEGACY_SAVE_KEY_V2 = 'capy_game_save_v2';
const SETTINGS_KEY = 'capy_game_settings_v1';
const SAVE_UPDATED_AT_KEY = 'capy_game_save_updated_ms';

const VALID_PLAY_STYLES: ReadonlySet<PlayStyle> = new Set([
  'sanctuary',
  'spore',
  'capytorio',
  'runner',
  'fallguys',
]);

const VALID_BUILDING_TYPES: ReadonlySet<BuildingType> = new Set([
  'hot_spring',
  'yuzu_orchard',
  'bamboo_grove',
  'zen_pagoda',
  'capy_statue',
  'trampoline_pad',
]);

const VALID_MUTATION_IDS: ReadonlySet<MutationId> = new Set(
  SPORE_MUTATIONS.map((m) => m.id)
);

export interface CapySaveBundle {
  schema: 'capygame-save-bundle-v2' | 'capygame-save-bundle-v1';
  appVersion?: string;
  exportedAtIso: string;
  updatedAtMs?: number;
  saveKey: typeof SAVE_KEY;
  settingsKey: typeof SETTINGS_KEY;
  stats: PlayerStats;
  settings: CapyGameSettings;
  proceduralConfig?: ProceduralGameConfig;
  yuzuGhostRun?: QuantizedGhostRun | null;
  firstRunSetupComplete?: boolean;
}

export type SaveBundleImportResult =
  | {
      ok: true;
      schema: 'capygame-save-bundle-v2' | 'capygame-save-bundle-v1' | 'legacy-raw';
      exportedAtIso: string;
      updatedAtMs: number;
      stats: PlayerStats;
      settings: CapyGameSettings;
      proceduralConfig: ProceduralGameConfig | null;
      yuzuGhostRun: QuantizedGhostRun | null;
      firstRunSetupComplete: boolean | null;
      summary: SaveSnapshotSummary;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export class ProgressionService {
  private static cachedStats: PlayerStats | null = null;
  private static cachedSettings: CapyGameSettings | null = null;
  private static saveTimerId: ReturnType<typeof setTimeout> | null = null;
  private static pendingFlush = false;
  private static lifecycleHooked = false;

  private static ensureLifecycleHooks(): void {
    if (this.lifecycleHooked || typeof window === 'undefined') return;
    this.lifecycleHooked = true;
    const flush = () => this.flushPendingSave();
    window.addEventListener('pagehide', flush);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushPendingSave();
        }
      });
    }
  }

  public static sanitizePlayerStats(raw: unknown, warnings?: string[]): PlayerStats {
    if (!raw || typeof raw !== 'object') {
      warnings?.push('Missing stats object; using initial defaults.');
      return structuredClone(INITIAL_PLAYER_STATS);
    }
    const parsed = raw as Partial<PlayerStats> & Record<string, unknown>;
    const cleanNum = (val: unknown, fallback: number, min = 0): number => {
      if (typeof val === 'number' && Number.isFinite(val)) {
        return Math.max(min, Math.round(val));
      }
      return fallback;
    };

    const rawActiveMutations = Array.isArray(parsed.activeMutations)
      ? parsed.activeMutations.filter(
          (id): id is MutationId => typeof id === 'string' && VALID_MUTATION_IDS.has(id as MutationId)
        )
      : [];
    const rawUnlockedMutations = Array.isArray(parsed.unlockedMutations)
      ? parsed.unlockedMutations.filter(
          (id): id is MutationId => typeof id === 'string' && VALID_MUTATION_IDS.has(id as MutationId)
        )
      : [...rawActiveMutations];
    for (const activeId of rawActiveMutations) {
      if (!rawUnlockedMutations.includes(activeId)) {
        rawUnlockedMutations.push(activeId);
      }
    }

    const rawBuildings = Array.isArray(parsed.buildings)
      ? parsed.buildings
          .filter((b): b is WorldBuilding => {
            if (!b || typeof b !== 'object') return false;
            const candidate = b as Partial<WorldBuilding>;
            return (
              typeof candidate.type === 'string' &&
              VALID_BUILDING_TYPES.has(candidate.type as BuildingType) &&
              typeof candidate.x === 'number' &&
              Number.isFinite(candidate.x) &&
              typeof candidate.z === 'number' &&
              Number.isFinite(candidate.z)
            );
          })
          .map((b, idx) => ({
            id:
              typeof b.id === 'string' && b.id.trim().length > 0
                ? b.id
                : `b_imp_${idx}_${Date.now()}`,
            type: b.type,
            name:
              typeof b.name === 'string' && b.name.trim().length > 0
                ? b.name
                : BUILDING_CATALOG.find((item) => item.type === b.type)?.name ?? b.type,
            level: cleanNum(b.level, 1, 1),
            x: Math.max(-45, Math.min(45, b.x)),
            z: Math.max(-45, Math.min(45, b.z)),
            description:
              typeof b.description === 'string'
                ? b.description
                : BUILDING_CATALOG.find((item) => item.type === b.type)?.description ?? '',
          }))
      : [];

    const rawCosmetics = Array.isArray(parsed.unlockedCosmetics)
      ? parsed.unlockedCosmetics.filter((c): c is string => typeof c === 'string' && c.length > 0)
      : [];
    const unlockedCosmetics =
      rawCosmetics.length > 0 ? Array.from(new Set(rawCosmetics)) : [...INITIAL_PLAYER_STATS.unlockedCosmetics];

    const rawMode =
      (parsed.selectedPlayStyle as unknown as string) === 'breakout'
        ? 'capytorio'
        : parsed.selectedPlayStyle;
    const selectedPlayStyle: PlayStyle =
      typeof rawMode === 'string' && VALID_PLAY_STYLES.has(rawMode as PlayStyle)
        ? (rawMode as PlayStyle)
        : INITIAL_PLAYER_STATS.selectedPlayStyle;

    const rawUpgrades =
      parsed.upgrades && typeof parsed.upgrades === 'object'
        ? (parsed.upgrades as Partial<PlayerStats['upgrades']>)
        : {};

    return {
      ...INITIAL_PLAYER_STATS,
      dna: cleanNum(parsed.dna, INITIAL_PLAYER_STATS.dna, 0),
      coins: cleanNum(parsed.coins, INITIAL_PLAYER_STATS.coins, 0),
      prestigeLevel: cleanNum(parsed.prestigeLevel, INITIAL_PLAYER_STATS.prestigeLevel, 1),
      selectedPlayStyle,
      activeHat:
        typeof parsed.activeHat === 'string' && parsed.activeHat.length > 0
          ? parsed.activeHat
          : INITIAL_PLAYER_STATS.activeHat,
      activeSkin:
        typeof parsed.activeSkin === 'string' && parsed.activeSkin.length > 0
          ? parsed.activeSkin
          : INITIAL_PLAYER_STATS.activeSkin,
      activeMutations: Array.from(new Set(rawActiveMutations)),
      unlockedMutations: Array.from(new Set(rawUnlockedMutations)),
      evolutionStage: cleanNum(parsed.evolutionStage, 1, 1),
      highScoreSpore: cleanNum(parsed.highScoreSpore, 0, 0),
      highScoreCapytorio: cleanNum(
        parsed.highScoreCapytorio ?? (parsed as Record<string, unknown>).highScoreBreakout,
        0,
        0
      ),
      highScoreRunner: cleanNum(parsed.highScoreRunner, 0, 0),
      highScoreFallGuys: cleanNum(parsed.highScoreFallGuys, 0, 0),
      capytorioFactory: sanitizeCapytorioStateShallow(parsed.capytorioFactory),
      upgrades: {
        herdSize: cleanNum(rawUpgrades.herdSize, INITIAL_PLAYER_STATS.upgrades.herdSize, 1),
        yuzuMagnet: cleanNum(rawUpgrades.yuzuMagnet, INITIAL_PLAYER_STATS.upgrades.yuzuMagnet, 1),
        speedBoost: cleanNum(rawUpgrades.speedBoost, INITIAL_PLAYER_STATS.upgrades.speedBoost, 1),
        paddleSize: cleanNum(rawUpgrades.paddleSize, INITIAL_PLAYER_STATS.upgrades.paddleSize, 1),
        bounciness: cleanNum(rawUpgrades.bounciness, INITIAL_PLAYER_STATS.upgrades.bounciness, 1),
      },
      buildings:
        rawBuildings.length > 0 ? rawBuildings : structuredClone(INITIAL_PLAYER_STATS.buildings),
      unlockedCosmetics,
      unlockedObjectMarkers: Boolean(parsed.unlockedObjectMarkers),
      unlockedRealityRescaler: Boolean(parsed.unlockedRealityRescaler),
      discoveredForestSpecimens: sanitizeDiscoveredSpecimens(parsed.discoveredForestSpecimens),
      bounties: sanitizeBountyState(parsed.bounties),
    };
  }

  public static sanitizeGameSettings(raw: unknown, warnings?: string[]): CapyGameSettings {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      warnings?.push('Missing settings object; using default simulation settings.');
      return { ...DEFAULT_CAPY_SETTINGS };
    }
    const parsed = raw as Record<string, unknown>;
    const cleanBool = (val: unknown, fallback: boolean): boolean =>
      val === undefined ? fallback : Boolean(val);
    const cleanNum = (val: unknown, fallback: number, min: number, max: number): number =>
      typeof val === 'number' && Number.isFinite(val)
        ? Math.max(min, Math.min(max, val))
        : fallback;

    const gpuQualityPreset: CapyGameSettings['gpuQualityPreset'] =
      parsed.gpuQualityPreset === 'performance' ||
      parsed.gpuQualityPreset === 'balanced' ||
      parsed.gpuQualityPreset === 'high' ||
      parsed.gpuQualityPreset === 'ultra'
        ? parsed.gpuQualityPreset
        : DEFAULT_CAPY_SETTINGS.gpuQualityPreset;

    const gpuBackendPreference: CapyGameSettings['gpuBackendPreference'] = 'webgl2';

    const gpuVisualFilter: CapyGameSettings['gpuVisualFilter'] =
      parsed.gpuVisualFilter === 'natural_pbr' ||
      parsed.gpuVisualFilter === 'cinema_filmic' ||
      parsed.gpuVisualFilter === 'vibrant_hdr' ||
      parsed.gpuVisualFilter === 'golden_hour' ||
      parsed.gpuVisualFilter === 'noir_contrast' ||
      parsed.gpuVisualFilter === 'retro_crt'
        ? parsed.gpuVisualFilter
        : DEFAULT_CAPY_SETTINGS.gpuVisualFilter;

    const gpuToneMapping: CapyGameSettings['gpuToneMapping'] =
      parsed.gpuToneMapping === 'agx' ||
      parsed.gpuToneMapping === 'aces' ||
      parsed.gpuToneMapping === 'neutral' ||
      parsed.gpuToneMapping === 'reinhard'
        ? parsed.gpuToneMapping
        : DEFAULT_CAPY_SETTINGS.gpuToneMapping;

    const gpuTextureFilter: CapyGameSettings['gpuTextureFilter'] =
      parsed.gpuTextureFilter === 'trilinear_aniso' ||
      parsed.gpuTextureFilter === 'bilinear' ||
      parsed.gpuTextureFilter === 'nearest_retro'
        ? parsed.gpuTextureFilter
        : DEFAULT_CAPY_SETTINGS.gpuTextureFilter;

    const gpuAnisotropy: CapyGameSettings['gpuAnisotropy'] =
      parsed.gpuAnisotropy === 1 ||
      parsed.gpuAnisotropy === 4 ||
      parsed.gpuAnisotropy === 8 ||
      parsed.gpuAnisotropy === 16
        ? parsed.gpuAnisotropy
        : DEFAULT_CAPY_SETTINGS.gpuAnisotropy;

    const gpuShadowQuality: CapyGameSettings['gpuShadowQuality'] =
      parsed.gpuShadowQuality === 'pcf_soft' ||
      parsed.gpuShadowQuality === 'pcf' ||
      parsed.gpuShadowQuality === 'vsm' ||
      parsed.gpuShadowQuality === 'off'
        ? parsed.gpuShadowQuality
        : DEFAULT_CAPY_SETTINGS.gpuShadowQuality;

    const gpuAntiAliasing: CapyGameSettings['gpuAntiAliasing'] =
      parsed.gpuAntiAliasing === 'msaa_fxaa' ||
      parsed.gpuAntiAliasing === 'fxaa' ||
      parsed.gpuAntiAliasing === 'none'
        ? parsed.gpuAntiAliasing
        : DEFAULT_CAPY_SETTINGS.gpuAntiAliasing;

    const touchControlsMode: CapyGameSettings['touchControlsMode'] =
      parsed.touchControlsMode === 'auto' ||
      parsed.touchControlsMode === 'always' ||
      parsed.touchControlsMode === 'hidden'
        ? parsed.touchControlsMode
        : DEFAULT_CAPY_SETTINGS.touchControlsMode;

    const weatherMode: CapyGameSettings['weatherMode'] =
      parsed.weatherMode === 'auto' ||
      parsed.weatherMode === 'clear' ||
      parsed.weatherMode === 'rain' ||
      parsed.weatherMode === 'storm' ||
      parsed.weatherMode === 'mist' ||
      parsed.weatherMode === 'snow'
        ? parsed.weatherMode
        : DEFAULT_CAPY_SETTINGS.weatherMode;

    const manualCapyLodTier: CapyGameSettings['manualCapyLodTier'] =
      parsed.manualCapyLodTier === 0 ||
      parsed.manualCapyLodTier === 1 ||
      parsed.manualCapyLodTier === 2 ||
      parsed.manualCapyLodTier === 3
        ? parsed.manualCapyLodTier
        : DEFAULT_CAPY_SETTINGS.manualCapyLodTier;

    const flightTrajectoryUserSelected = Boolean(parsed.flightTrajectoryUserSelected);

    return {
      advancedMode: Boolean(parsed.advancedMode),
      cameraFollowBehind: cleanBool(parsed.cameraFollowBehind, DEFAULT_CAPY_SETTINGS.cameraFollowBehind),
      capytorioCameraMode: parsed.capytorioCameraMode === 'chase' ? 'chase' : 'oblique',
      capytorioBeltEndSpill: Boolean(parsed.capytorioBeltEndSpill),
      mouselookEnabled: cleanBool(parsed.mouselookEnabled, DEFAULT_CAPY_SETTINGS.mouselookEnabled),
      mouselookSensitivity:
        typeof parsed.mouselookSensitivity === 'number' &&
        Number.isFinite(parsed.mouselookSensitivity)
          ? Math.max(0.2, Math.min(2.5, Math.round(parsed.mouselookSensitivity * 20) / 20))
          : DEFAULT_CAPY_SETTINGS.mouselookSensitivity,
      invertMouseY: cleanBool(parsed.invertMouseY, DEFAULT_CAPY_SETTINGS.invertMouseY),
      cameraDistance: cleanNum(parsed.cameraDistance, DEFAULT_CAPY_SETTINGS.cameraDistance, 0.45, 2.2),
      turnSensitivity: cleanNum(parsed.turnSensitivity, DEFAULT_CAPY_SETTINGS.turnSensitivity, 0.5, 2.0),
      fov: Math.round(cleanNum(parsed.fov, DEFAULT_CAPY_SETTINGS.fov, 45, 75)),
      worldFogEnabled: false,
      drawDistance:
        typeof parsed.drawDistance === 'number' && Number.isFinite(parsed.drawDistance)
          ? Math.max(90, Math.min(1350, Math.round(parsed.drawDistance)))
          : gpuQualityPreset === 'performance'
            ? 135
            : DEFAULT_CAPY_SETTINGS.drawDistance,
      touchControlsMode,
      showAboutOnStartup: cleanBool(parsed.showAboutOnStartup, DEFAULT_CAPY_SETTINGS.showAboutOnStartup),
      autoCapyLod: cleanBool(parsed.autoCapyLod, DEFAULT_CAPY_SETTINGS.autoCapyLod),
      manualCapyLodTier,
      lock60FpsGovernor: cleanBool(parsed.lock60FpsGovernor, DEFAULT_CAPY_SETTINGS.lock60FpsGovernor),
      maxFpsLimit:
        typeof parsed.maxFpsLimit === 'number' && Number.isFinite(parsed.maxFpsLimit)
          ? parsed.maxFpsLimit <= 0
            ? 0
            : Math.max(24, Math.min(240, Math.round(parsed.maxFpsLimit)))
          : DEFAULT_CAPY_SETTINGS.maxFpsLimit,
      fpsTarget: Math.round(cleanNum(parsed.fpsTarget, DEFAULT_CAPY_SETTINGS.fpsTarget, 24, 240)),
      showFpsButton: cleanBool(parsed.showFpsButton, DEFAULT_CAPY_SETTINGS.showFpsButton),
      dayNightAutoCycle: cleanBool(parsed.dayNightAutoCycle, DEFAULT_CAPY_SETTINGS.dayNightAutoCycle),
      timeOfDayHours: cleanNum(parsed.timeOfDayHours, DEFAULT_CAPY_SETTINGS.timeOfDayHours, 0, 24),
      weatherMode,
      flightTrajectory:
        flightTrajectoryUserSelected && parsed.flightTrajectory === 'straight'
          ? 'straight'
          : 'spiral',
      flightTrajectoryUserSelected,
      showObjectMarkers: Boolean(parsed.showObjectMarkers),
      realityScaleGamma: cleanNum(parsed.realityScaleGamma, DEFAULT_CAPY_SETTINGS.realityScaleGamma, 0.28, 1.0),
      astrophysicsPalette: parsed.astrophysicsPalette === 'hubble' ? 'hubble' : 'natural',
      gpuBackendPreference,
      gpuQualityPreset,
      gpuPostProcessing: cleanBool(parsed.gpuPostProcessing, DEFAULT_CAPY_SETTINGS.gpuPostProcessing),
      gpuVisualFilter,
      gpuToneMapping,
      gpuExposure: cleanNum(parsed.gpuExposure, DEFAULT_CAPY_SETTINGS.gpuExposure, 0.5, 2.0),
      gpuTextureFilter,
      gpuAnisotropy,
      gpuShadowQuality,
      gpuAntiAliasing,
      gpuResolutionScale: cleanNum(parsed.gpuResolutionScale, DEFAULT_CAPY_SETTINGS.gpuResolutionScale, 0.5, 1.5),
      gpuBloomEnabled: cleanBool(parsed.gpuBloomEnabled, DEFAULT_CAPY_SETTINGS.gpuBloomEnabled),
      gpuBloomStrength: cleanNum(parsed.gpuBloomStrength, DEFAULT_CAPY_SETTINGS.gpuBloomStrength, 0.0, 1.5),
      gpuSsaoEnabled: cleanBool(parsed.gpuSsaoEnabled, DEFAULT_CAPY_SETTINGS.gpuSsaoEnabled),
      gpuSharpenAmount: cleanNum(parsed.gpuSharpenAmount, DEFAULT_CAPY_SETTINGS.gpuSharpenAmount, 0.0, 1.0),
      masterVolume: cleanNum(parsed.masterVolume, DEFAULT_CAPY_SETTINGS.masterVolume, 0.0, 1.0),
      sfxVolume: cleanNum(parsed.sfxVolume, DEFAULT_CAPY_SETTINGS.sfxVolume, 0.0, 1.0),
      musicVolume: cleanNum(parsed.musicVolume, DEFAULT_CAPY_SETTINGS.musicVolume, 0.0, 1.0),
      uiSoundsEnabled: cleanBool(parsed.uiSoundsEnabled, DEFAULT_CAPY_SETTINGS.uiSoundsEnabled),
    };
  }

  public static getLastLocalSaveTimestampMs(): number {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SAVE_UPDATED_AT_KEY);
        if (raw) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) {
            return Math.round(parsed);
          }
        }
      }
    } catch {
      // Ignore storage access errors
    }
    return Date.now();
  }

  public static recordLocalSaveTimestampMs(timestampMs: number = Date.now()): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const clean = Number.isFinite(timestampMs) && timestampMs > 0 ? Math.round(timestampMs) : Date.now();
        localStorage.setItem(SAVE_UPDATED_AT_KEY, String(clean));
      }
    } catch {
      // Ignore storage quota errors
    }
  }

  public static getLocalSnapshotSummary(
    statsOverride?: PlayerStats,
    proceduralConfigOverride?: ProceduralGameConfig,
    ghostOverride?: QuantizedGhostRun | null
  ): SaveSnapshotSummary {
    const stats = this.sanitizePlayerStats(statsOverride ?? this.loadStats());
    const proceduralConfig = proceduralConfigOverride ?? loadSavedProceduralConfig();
    const yuzuGhostRun =
      ghostOverride !== undefined ? ghostOverride : loadBestYuzuGhostRun();
    const updatedAtMs = this.getLastLocalSaveTimestampMs();
    return buildSaveSnapshotSummary({
      stats,
      proceduralConfig,
      yuzuGhostRun,
      updatedAtMs,
      exportedAtIso: new Date(updatedAtMs).toISOString(),
    });
  }

  public static exportSaveBundleJson(
    statsOverride?: PlayerStats,
    settingsOverride?: CapyGameSettings,
    ghostOverride?: QuantizedGhostRun | null,
    proceduralConfigOverride?: ProceduralGameConfig
  ): string {
    const nowMs = Date.now();
    const bundle: CapySaveBundle = {
      schema: 'capygame-save-bundle-v2',
      appVersion: CAPYGAME_VERSION,
      exportedAtIso: new Date(nowMs).toISOString(),
      updatedAtMs: nowMs,
      saveKey: SAVE_KEY,
      settingsKey: SETTINGS_KEY,
      stats: this.sanitizePlayerStats(statsOverride ?? this.loadStats()),
      settings: this.sanitizeGameSettings(settingsOverride ?? this.loadSettings()),
      proceduralConfig: proceduralConfigOverride ?? loadSavedProceduralConfig(),
      yuzuGhostRun:
        ghostOverride !== undefined ? ghostOverride : loadBestYuzuGhostRun(),
      firstRunSetupComplete: hasCompletedFirstRunSetup(),
    };
    return JSON.stringify(bundle, null, 2);
  }

  public static parseAndValidateSaveBundle(jsonText: string): SaveBundleImportResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, error: 'Invalid JSON syntax. Please check your backup file.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Backup JSON must be an object containing stats or settings.' };
    }

    const obj = parsed as Record<string, unknown>;
    const warnings: string[] = [];
    const hasStatsKey = typeof obj.stats === 'object' && obj.stats !== null;
    const hasSettingsKey = typeof obj.settings === 'object' && obj.settings !== null;
    const looksLikeRawStats =
      !hasStatsKey &&
      !hasSettingsKey &&
      ('dna' in obj || 'coins' in obj || 'buildings' in obj || 'upgrades' in obj);
    const looksLikeRawSettings =
      !hasStatsKey &&
      !hasSettingsKey &&
      ('fov' in obj || 'gpuQualityPreset' in obj || 'drawDistance' in obj);

    if (!hasStatsKey && !hasSettingsKey && !looksLikeRawStats && !looksLikeRawSettings) {
      return {
        ok: false,
        error:
          'Unrecognized save format. Expected capygame-save-bundle-v2 or v1 with stats and/or settings.',
      };
    }

    const stats = hasStatsKey
      ? this.sanitizePlayerStats(obj.stats, warnings)
      : looksLikeRawStats
        ? this.sanitizePlayerStats(obj, warnings)
        : this.sanitizePlayerStats(this.loadStats());

    const settings = hasSettingsKey
      ? this.sanitizeGameSettings(obj.settings, warnings)
      : looksLikeRawSettings
        ? this.sanitizeGameSettings(obj, warnings)
        : this.sanitizeGameSettings(this.loadSettings());

    let proceduralConfig: ProceduralGameConfig | null = null;
    if (
      'proceduralConfig' in obj &&
      obj.proceduralConfig !== null &&
      obj.proceduralConfig !== undefined
    ) {
      const cfgResult = parseAndValidateProceduralConfig(JSON.stringify(obj.proceduralConfig));
      if (cfgResult.ok) {
        proceduralConfig = cfgResult.config;
        for (let i = 0; i < cfgResult.warnings.length; i++) {
          warnings.push(`worldConfig: ${cfgResult.warnings[i]}`);
        }
      } else {
        warnings.push('Ignored malformed proceduralConfig payload in backup.');
      }
    }

    let yuzuGhostRun: QuantizedGhostRun | null = null;
    if ('yuzuGhostRun' in obj && obj.yuzuGhostRun !== null && obj.yuzuGhostRun !== undefined) {
      const validGhost = parseAndValidateGhostRun(obj.yuzuGhostRun);
      if (validGhost) {
        yuzuGhostRun = validGhost;
      } else {
        warnings.push('Ignored malformed yuzuGhostRun payload in backup.');
      }
    }

    const firstRunSetupComplete =
      typeof obj.firstRunSetupComplete === 'boolean' ? obj.firstRunSetupComplete : null;

    const schema: 'capygame-save-bundle-v2' | 'capygame-save-bundle-v1' | 'legacy-raw' =
      obj.schema === 'capygame-save-bundle-v2'
        ? 'capygame-save-bundle-v2'
        : obj.schema === 'capygame-save-bundle-v1'
          ? 'capygame-save-bundle-v1'
          : 'legacy-raw';

    const parsedIsoMs =
      typeof obj.exportedAtIso === 'string' ? Date.parse(obj.exportedAtIso) : Number.NaN;
    const updatedAtMs =
      typeof obj.updatedAtMs === 'number' && Number.isFinite(obj.updatedAtMs) && obj.updatedAtMs > 0
        ? Math.round(obj.updatedAtMs)
        : Number.isFinite(parsedIsoMs) && parsedIsoMs > 0
          ? Math.round(parsedIsoMs)
          : Date.now();
    const exportedAtIso =
      typeof obj.exportedAtIso === 'string' && obj.exportedAtIso.trim().length > 0
        ? obj.exportedAtIso
        : new Date(updatedAtMs).toISOString();

    const summary = buildSaveSnapshotSummary({
      stats,
      proceduralConfig: proceduralConfig ?? loadSavedProceduralConfig(),
      yuzuGhostRun,
      updatedAtMs,
      exportedAtIso,
    });

    return {
      ok: true,
      schema,
      exportedAtIso,
      updatedAtMs,
      stats,
      settings,
      proceduralConfig,
      yuzuGhostRun,
      firstRunSetupComplete,
      summary,
      warnings,
    };
  }

  public static importSaveBundleJson(jsonText: string): SaveBundleImportResult {
    const res = this.parseAndValidateSaveBundle(jsonText);
    if (!res.ok) return res;
    this.saveStats(res.stats);
    this.saveSettings(res.settings);
    if (res.proceduralConfig) {
      saveProceduralConfig(res.proceduralConfig);
    }
    if (res.yuzuGhostRun) {
      saveYuzuGhostRunDirect(res.yuzuGhostRun);
    }
    if (res.firstRunSetupComplete === true) {
      markFirstRunSetupComplete();
    }
    this.recordLocalSaveTimestampMs(res.updatedAtMs);
    return res;
  }

  public static loadStats(forceReload: boolean = false): PlayerStats {
    this.ensureLifecycleHooks();
    if (this.cachedStats && !forceReload) return this.cachedStats;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const candidateKeys = [SAVE_KEY, LEGACY_SAVE_KEY_V2, 'capy_game_save_v1'];
      for (let i = 0; i < candidateKeys.length; i++) {
        const key = candidateKeys[i];
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const loaded = this.sanitizePlayerStats(JSON.parse(raw));
          this.cachedStats = loaded;
          return loaded;
        } catch (e) {
          console.warn(`Failed to parse CapyGame stats from ${key}`, e);
        }
      }
    }
    const fallback: PlayerStats = structuredClone(INITIAL_PLAYER_STATS);
    this.cachedStats = fallback;
    return fallback;
  }

  public static flushPendingSave(): void {
    if (this.saveTimerId !== null) {
      clearTimeout(this.saveTimerId);
      this.saveTimerId = null;
    }
    if (!this.pendingFlush || !this.cachedStats) return;
    this.pendingFlush = false;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.cachedStats));
      this.recordLocalSaveTimestampMs();
    } catch (e) {
      // On QuotaExceededError, retry saving core progression without large factory payload
      const isQuotaError =
        e instanceof Error &&
        (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      if (isQuotaError && this.cachedStats.capytorioFactory) {
        try {
          const compactStats: PlayerStats = {
            ...this.cachedStats,
            capytorioFactory: undefined,
          };
          localStorage.setItem(SAVE_KEY, JSON.stringify(compactStats));
          console.warn('Storage quota exceeded; saved core CapyGame stats without factory snapshot.');
          return;
        } catch (retryErr) {
          console.warn('Failed to flush compact CapyGame stats', retryErr);
          return;
        }
      }
      console.warn('Failed to flush CapyGame stats', e);
    }
  }

  public static scheduleSaveStats(stats: PlayerStats, delayMs: number = 250): void {
    this.ensureLifecycleHooks();
    this.cachedStats = stats;
    this.pendingFlush = true;
    if (this.saveTimerId !== null) {
      clearTimeout(this.saveTimerId);
    }
    this.saveTimerId = setTimeout(() => {
      this.saveTimerId = null;
      this.flushPendingSave();
    }, delayMs);
  }

  public static saveStats(stats: PlayerStats) {
    this.ensureLifecycleHooks();
    this.cachedStats = stats;
    this.pendingFlush = true;
    this.flushPendingSave();
  }

  public static resetStats(): PlayerStats {
    const fresh: PlayerStats = structuredClone(INITIAL_PLAYER_STATS);
    this.saveStats(fresh);
    return fresh;
  }

  public static loadSettings(forceReload: boolean = false): CapyGameSettings {
    if (this.cachedSettings && !forceReload) return this.cachedSettings;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const loaded = this.sanitizeGameSettings(JSON.parse(raw));
          this.cachedSettings = loaded;
          return loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load CapyGame settings', e);
    }
    const fallback: CapyGameSettings = { ...DEFAULT_CAPY_SETTINGS };
    this.cachedSettings = fallback;
    return fallback;
  }

  public static saveSettings(settings: CapyGameSettings) {
    this.cachedSettings = settings;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
    } catch (e) {
      console.warn('Failed to save CapyGame settings', e);
    }
  }

  public static getMutationBonuses(stats: PlayerStats) {
    let speedBonus = 0;
    let magnetBonus = 0;
    for (const mutId of stats.activeMutations) {
      const m = SPORE_MUTATIONS.find((item) => item.id === mutId);
      if (m) {
        speedBonus += m.speedBonus;
        magnetBonus += m.magnetBonus;
      }
    }
    return { speedBonus, magnetBonus };
  }

  public static recordProgress(
    stats: PlayerStats,
    dnaAmount: number = 0,
    mode?: PlayStyle,
    modeScore?: number,
    coinMultiplierBonus: number = 1.0
  ): PlayerStats {
    const finalDna = Math.max(0, Math.round(dnaAmount));
    const prestigeMult = Math.max(1, stats.prestigeLevel || 1);
    const statueLevels = (stats.buildings || []).reduce(
      (sum, b) => (b.type === 'capy_statue' ? sum + Math.max(1, b.level || 1) : sum),
      0
    );
    const statueMult = 1 + statueLevels * 0.15;
    const bonusCoins =
      finalDna > 0
        ? Math.max(1, Math.round(finalDna * 2 * prestigeMult * statueMult * coinMultiplierBonus))
        : 0;

    const next: PlayerStats = {
      ...stats,
      dna: stats.dna + finalDna,
      coins: (stats.coins || 0) + bonusCoins,
    };

    if (mode && typeof modeScore === 'number') {
      if (mode === 'spore' && modeScore > next.highScoreSpore) {
        next.highScoreSpore = Math.round(modeScore);
      } else if (mode === 'capytorio' && modeScore > next.highScoreCapytorio) {
        next.highScoreCapytorio = Math.round(modeScore);
      } else if (mode === 'runner' && modeScore > next.highScoreRunner) {
        next.highScoreRunner = Math.round(modeScore);
      } else if (mode === 'fallguys' && modeScore > next.highScoreFallGuys) {
        next.highScoreFallGuys = Math.round(modeScore);
      }
    }

    this.scheduleSaveStats(next);
    return next;
  }

  public static getBuildingCoinCost(
    type: BuildingType,
    costMultiplier: number = 1.0
  ): number {
    const base = BUILDING_CATALOG.find((b) => b.type === type)?.coinCost ?? 10;
    return Math.max(0, Math.round(base * costMultiplier));
  }

  public static getBuildingUpgradeCoinCost(
    type: BuildingType,
    currentLevel: number,
    costMultiplier: number = 1.0
  ): number {
    return Math.max(
      5,
      Math.round(this.getBuildingCoinCost(type, costMultiplier) * 0.75 * Math.max(1, currentLevel))
    );
  }

  public static getAbilityUpgradeDnaCost(currentLevel: number): number {
    return 5 * Math.max(1, currentLevel);
  }

  public static getCosmeticCoinCost(hatId: string): number {
    return COSMETIC_COIN_COSTS[hatId] ?? 15;
  }

  public static getPrestigeDnaCost(prestigeLevel: number): number {
    return PRESTIGE_BASE_DNA_COST * Math.max(1, prestigeLevel || 1);
  }

  public static upgradeBuilding(
    stats: PlayerStats,
    buildingId: string,
    costMultiplier: number = 1.0
  ): PlayerStats | null {
    const building = stats.buildings.find((b) => b.id === buildingId);
    if (!building) return null;

    const coinCost = this.getBuildingUpgradeCoinCost(
      building.type,
      building.level,
      costMultiplier
    );
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const updatedBuildings = stats.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: b.level + 1 } : b
    );

    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      buildings: updatedBuildings,
    };
    this.saveStats(updated);
    return updated;
  }

  public static placeBuilding(
    stats: PlayerStats,
    type: WorldBuilding['type'],
    name: string,
    x: number,
    z: number,
    description: string,
    costMultiplier: number = 1.0
  ): PlayerStats | null {
    const coinCost = this.getBuildingCoinCost(type, costMultiplier);
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const newBuilding: WorldBuilding = {
      id: 'b_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      name,
      level: 1,
      x,
      z,
      description,
    };
    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      buildings: [...stats.buildings, newBuilding],
    };
    this.saveStats(updated);
    return updated;
  }

  public static buyUpgrade(
    stats: PlayerStats,
    upgradeKey: keyof PlayerStats['upgrades']
  ): PlayerStats | null {
    const currentLevel = stats.upgrades[upgradeKey] || 1;
    const dnaCost = this.getAbilityUpgradeDnaCost(currentLevel);
    if (stats.dna < dnaCost) return null;

    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - dnaCost,
      upgrades: {
        ...stats.upgrades,
        [upgradeKey]: currentLevel + 1,
      },
    };
    this.saveStats(updated);
    return updated;
  }

  public static unlockOrToggleMutation(
    stats: PlayerStats,
    mutationId: MutationId
  ): { stats: PlayerStats; action: 'unlocked' | 'toggled' } | null {
    const mut = SPORE_MUTATIONS.find((m) => m.id === mutationId);
    if (!mut) return null;

    const prevUnlocked = stats.unlockedMutations ?? [...stats.activeMutations];

    if (stats.activeMutations.includes(mutationId)) {
      const ensuredUnlocked = prevUnlocked.includes(mutationId)
        ? prevUnlocked
        : [...prevUnlocked, mutationId];
      const updated: PlayerStats = {
        ...stats,
        activeMutations: stats.activeMutations.filter((id) => id !== mutationId),
        unlockedMutations: ensuredUnlocked,
      };
      this.saveStats(updated);
      return { stats: updated, action: 'toggled' };
    }

    if (prevUnlocked.includes(mutationId)) {
      const nextMutations = [...stats.activeMutations, mutationId];
      const updated: PlayerStats = {
        ...stats,
        activeMutations: nextMutations,
        unlockedMutations: prevUnlocked,
        evolutionStage: Math.max(stats.evolutionStage, prevUnlocked.length + 1),
      };
      this.saveStats(updated);
      return { stats: updated, action: 'toggled' };
    }

    if (stats.dna < mut.dnaCost) return null;

    const nextUnlocked = [...prevUnlocked, mutationId];
    const nextMutations = [...stats.activeMutations, mutationId];
    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - mut.dnaCost,
      activeMutations: nextMutations,
      unlockedMutations: nextUnlocked,
      evolutionStage: Math.max(stats.evolutionStage, nextUnlocked.length + 1),
    };
    this.saveStats(updated);
    return { stats: updated, action: 'unlocked' };
  }

  public static unlockOrEquipCosmetic(
    stats: PlayerStats,
    hatId: string
  ): { stats: PlayerStats; action: 'equipped' | 'unlocked' } | null {
    const unlocked = stats.unlockedCosmetics ?? ['yuzu'];
    if (unlocked.includes(hatId)) {
      const updated: PlayerStats = { ...stats, activeHat: hatId };
      this.saveStats(updated);
      return { stats: updated, action: 'equipped' };
    }

    const coinCost = this.getCosmeticCoinCost(hatId);
    const currentCoins = stats.coins ?? 0;
    if (currentCoins < coinCost) return null;

    const updated: PlayerStats = {
      ...stats,
      coins: currentCoins - coinCost,
      activeHat: hatId,
      unlockedCosmetics: [...unlocked, hatId],
    };
    this.saveStats(updated);
    return { stats: updated, action: 'unlocked' };
  }

  public static unlockCosmicInstrument(
    stats: PlayerStats,
    instrument: 'markers' | 'rescaler',
    currency: 'dna' | 'coins'
  ): PlayerStats | null {
    if (instrument === 'markers') {
      if (stats.unlockedObjectMarkers) return stats;
      if (currency === 'dna') {
        if (stats.dna < OBJECT_MARKERS_DNA_COST) return null;
        const updated: PlayerStats = {
          ...stats,
          dna: stats.dna - OBJECT_MARKERS_DNA_COST,
          unlockedObjectMarkers: true,
        };
        this.saveStats(updated);
        return updated;
      }
      if ((stats.coins ?? 0) < OBJECT_MARKERS_COIN_COST) return null;
      const updated: PlayerStats = {
        ...stats,
        coins: (stats.coins ?? 0) - OBJECT_MARKERS_COIN_COST,
        unlockedObjectMarkers: true,
      };
      this.saveStats(updated);
      return updated;
    }

    if (stats.unlockedRealityRescaler) return stats;
    if (currency === 'dna') {
      if (stats.dna < REALITY_RESCALER_DNA_COST) return null;
      const updated: PlayerStats = {
        ...stats,
        dna: stats.dna - REALITY_RESCALER_DNA_COST,
        unlockedRealityRescaler: true,
      };
      this.saveStats(updated);
      return updated;
    }
    if ((stats.coins ?? 0) < REALITY_RESCALER_COIN_COST) return null;
    const updated: PlayerStats = {
      ...stats,
      coins: (stats.coins ?? 0) - REALITY_RESCALER_COIN_COST,
      unlockedRealityRescaler: true,
    };
    this.saveStats(updated);
    return updated;
  }

  public static prestige(stats: PlayerStats): PlayerStats | null {
    const currentPrestige = Math.max(1, stats.prestigeLevel || 1);
    const reqDna = this.getPrestigeDnaCost(currentPrestige);
    if (stats.dna < reqDna) return null;

    const updated: PlayerStats = {
      ...stats,
      dna: stats.dna - reqDna,
      coins: (stats.coins || 0) + 50 * currentPrestige,
      prestigeLevel: currentPrestige + 1,
    };
    this.saveStats(updated);
    return updated;
  }

  public static discoverForestSpecimen(
    stats: PlayerStats,
    specimenId: ForestMicroSpecimenId
  ): { stats: PlayerStats; isNew: boolean } {
    const merged = mergeDiscoveredSpecimen(stats.discoveredForestSpecimens, specimenId);
    if (!merged.isNew) {
      return { stats, isNew: false };
    }
    const updated: PlayerStats = {
      ...stats,
      discoveredForestSpecimens: merged.list,
    };
    this.scheduleSaveStats(updated, 150);
    return { stats: updated, isNew: true };
  }

  public static recordBountyProgress(
    stats: PlayerStats,
    eventType: BountyEventType,
    amount: number = 1
  ): { stats: PlayerStats; completed: BountyCatalogSpec[] } {
    const res = applyBountyEvent(stats.bounties, eventType, amount);
    if (!res.changed) {
      return { stats, completed: [] };
    }
    let bonusCoins = 0;
    let bonusDna = 0;
    for (let i = 0; i < res.completedBounties.length; i++) {
      bonusCoins += res.completedBounties[i].coinReward;
      bonusDna += res.completedBounties[i].dnaReward;
    }
    const updated: PlayerStats = {
      ...stats,
      coins: (stats.coins || 0) + bonusCoins,
      dna: (stats.dna || 0) + bonusDna,
      bounties: res.nextItems,
    };
    this.scheduleSaveStats(updated, 200);
    return { stats: updated, completed: res.completedBounties };
  }
}
