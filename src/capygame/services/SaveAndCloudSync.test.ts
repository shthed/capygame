import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CAPY_SETTINGS, INITIAL_PLAYER_STATS } from '../types';
import { DEFAULT_PROCEDURAL_GAME_CONFIG, cloneProceduralConfig } from '../config/ProceduralGameConfig';
import { ProgressionService } from './ProgressionService';
import {
  buildSaveSnapshotSummary,
  compareSaveSnapshots,
  formatGhostTimeSec,
} from './SaveSyncMath';
import {
  CloudAuthExpiredError,
  CloudSyncService,
  DRIVE_SAVE_FILE_NAME,
  PLAY_GAMES_SNAPSHOT_SLOT,
  SCOPES,
  buildDriveMultipartBody,
  deleteDriveSaveFile,
  downloadDriveSaveFile,
  fetchGoogleUserProfile,
  findDriveSaveFile,
  getConfiguredGoogleClientId,
  isGoogleDriveSyncConfigured,
  isPlayGamesBridgeAvailable,
  sanitizeHttpsAvatarUrl,
  uploadDriveSaveFile,
} from './CloudSyncService';

test('Save Bundle v2: exports and restores full profile including proceduralConfig, stats, settings, and ghost PB', () => {
  const customStats = structuredClone(INITIAL_PLAYER_STATS);
  customStats.coins = 1234;
  customStats.dna = 567;
  customStats.prestigeLevel = 4;

  const customSettings = { ...DEFAULT_CAPY_SETTINGS, advancedMode: true, fov: 68 };
  const customProcedural = cloneProceduralConfig(DEFAULT_PROCEDURAL_GAME_CONFIG);
  customProcedural.meta.configName = 'Lunar Citrus Lab';
  customProcedural.meta.seed = 424242;

  const ghost = {
    version: 1 as const,
    durationMs: 18450,
    frameCount: 2,
    sampleDtMs: 50,
    recordedAtIso: '2026-11-26T18:00:00.000Z',
    data: [0, 100, 0, 0, 0, 1, 10, 120, -20, 10, 0, 3],
  };

  const json = ProgressionService.exportSaveBundleJson(
    customStats,
    customSettings,
    ghost,
    customProcedural
  );

  const parsedRaw = JSON.parse(json) as Record<string, unknown>;
  assert.equal(parsedRaw.schema, 'capygame-save-bundle-v2');
  assert.equal(typeof parsedRaw.updatedAtMs, 'number');

  const res = ProgressionService.parseAndValidateSaveBundle(json);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.schema, 'capygame-save-bundle-v2');
  assert.equal(res.stats.coins, 1234);
  assert.equal(res.stats.dna, 567);
  assert.equal(res.stats.prestigeLevel, 4);
  assert.equal(res.settings.advancedMode, true);
  assert.equal(res.settings.fov, 68);
  assert.equal(res.proceduralConfig?.meta.seed, 424242);
  assert.equal(res.proceduralConfig?.meta.configName, 'Lunar Citrus Lab');
  assert.equal(res.yuzuGhostRun?.durationMs, 18450);
  assert.equal(res.summary.coins, 1234);
  assert.equal(res.summary.worldSeed, 424242);
  assert.equal(res.summary.yuzuBestMs, 18450);
});

test('Save Bundle backward compatibility: parses legacy v1 bundles and rejects malformed payloads', () => {
  const v1Payload = JSON.stringify({
    schema: 'capygame-save-bundle-v1',
    exportedAtIso: '2026-11-20T12:00:00.000Z',
    stats: { dna: 88, coins: 333, prestigeLevel: 2 },
    settings: { fov: 999, gpuQualityPreset: 'high' },
  });

  const res = ProgressionService.parseAndValidateSaveBundle(v1Payload);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.schema, 'capygame-save-bundle-v1');
  assert.equal(res.stats.dna, 88);
  assert.equal(res.stats.coins, 333);
  assert.equal(res.settings.fov, 75); // Clamped to safe max
  assert.equal(res.proceduralConfig, null);

  const badJson = ProgressionService.parseAndValidateSaveBundle('{not valid');
  assert.equal(badJson.ok, false);

  const unrecognized = ProgressionService.parseAndValidateSaveBundle('{"hello":"world"}');
  assert.equal(unrecognized.ok, false);
});

test('SaveSyncMath: compares local and remote snapshots accurately by timestamp and progression', () => {
  const localStats = structuredClone(INITIAL_PLAYER_STATS);
  localStats.coins = 200;
  localStats.dna = 50;

  const remoteStats = structuredClone(INITIAL_PLAYER_STATS);
  remoteStats.coins = 900;
  remoteStats.dna = 250;
  remoteStats.prestigeLevel = 3;

  const localSummary = buildSaveSnapshotSummary({
    stats: localStats,
    updatedAtMs: 1_700_000_000_000,
  });
  const remoteNewer = buildSaveSnapshotSummary({
    stats: remoteStats,
    updatedAtMs: 1_700_000_060_000,
  });

  const cmpRemote = compareSaveSnapshots(localSummary, remoteNewer);
  assert.equal(cmpRemote.recommendation, 'remote');
  assert.equal(cmpRemote.hasMeaningfulDifference, true);

  const cmpSame = compareSaveSnapshots(localSummary, { ...localSummary });
  assert.equal(cmpSame.recommendation, 'equal');
  assert.equal(cmpSame.hasMeaningfulDifference, false);

  assert.equal(formatGhostTimeSec(14250), '14.25s');
  assert.equal(formatGhostTimeSec(null), 'None');
});

test('CloudSyncService: Google Drive v3 REST helpers handle find, download, upload (POST/PATCH), delete, and 401 expiry', async () => {
  assert.equal(getConfiguredGoogleClientId(''), '');
  assert.equal(getConfiguredGoogleClientId('   '), '');
  assert.equal(
    getConfiguredGoogleClientId(' 12345-abc.apps.googleusercontent.com '),
    '12345-abc.apps.googleusercontent.com'
  );
  assert.equal(isGoogleDriveSyncConfigured(''), false);
  assert.equal(isGoogleDriveSyncConfigured('   '), false);
  assert.equal(isGoogleDriveSyncConfigured('12345-abc.apps.googleusercontent.com'), true);
  assert.deepEqual([...SCOPES], [
    'https://www.googleapis.com/auth/drive.file',
    'openid',
    'profile',
    'email',
  ]);
  assert.equal(sanitizeHttpsAvatarUrl('https://lh3.googleusercontent.com/avatar.png'), 'https://lh3.googleusercontent.com/avatar.png');
  assert.equal(sanitizeHttpsAvatarUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeHttpsAvatarUrl('http://insecure.example/a.png'), undefined);

  const multipart = buildDriveMultipartBody({ name: DRIVE_SAVE_FILE_NAME }, '{"ok":true}', 'test_boundary');
  assert.ok(multipart.contentType.includes('test_boundary'));
  assert.ok(multipart.body.includes(DRIVE_SAVE_FILE_NAME));
  assert.ok(multipart.body.includes('{"ok":true}'));

  const requests: Array<{ url: string; method: string }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    requests.push({ url, method });

    if (url.includes('/oauth2/v3/userinfo')) {
      return new Response(
        JSON.stringify({
          sub: 'u_123',
          name: 'Capy Explorer',
          email: 'capy@example.com',
          picture: 'https://lh3.googleusercontent.com/u_123.png',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'GET' && url.includes('alt=media')) {
      return new Response('{"schema":"capygame-save-bundle-v2"}', { status: 200 });
    }

    if (method === 'GET' && url.includes('/drive/v3/files')) {
      return new Response(
        JSON.stringify({
          files: [
            {
              id: 'file_abc',
              name: DRIVE_SAVE_FILE_NAME,
              modifiedTime: '2026-11-26T18:30:00.000Z',
              size: '512',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'POST' || method === 'PATCH') {
      return new Response(
        JSON.stringify({
          id: method === 'POST' ? 'file_new' : 'file_abc',
          name: DRIVE_SAVE_FILE_NAME,
          modifiedTime: '2026-11-26T18:35:00.000Z',
          size: '600',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const profile = await fetchGoogleUserProfile('tok_123', fakeFetch);
  assert.equal(profile.email, 'capy@example.com');
  assert.equal(profile.provider, 'google_drive');

  const meta = await findDriveSaveFile('tok_123', fakeFetch);
  assert.ok(meta);
  assert.equal(meta?.fileId, 'file_abc');

  const downloaded = await downloadDriveSaveFile('tok_123', meta!, fakeFetch);
  assert.equal(downloaded.jsonText, '{"schema":"capygame-save-bundle-v2"}');

  const created = await uploadDriveSaveFile('tok_123', '{"v":2}', null, fakeFetch);
  assert.equal(created.fileId, 'file_new');
  assert.equal(requests.some((r) => r.method === 'POST'), true);

  const updated = await uploadDriveSaveFile('tok_123', '{"v":2}', 'file_abc', fakeFetch);
  assert.equal(updated.fileId, 'file_abc');
  assert.equal(requests.some((r) => r.method === 'PATCH'), true);

  await deleteDriveSaveFile('tok_123', 'file_abc', fakeFetch);
  assert.equal(requests.some((r) => r.method === 'DELETE'), true);

  // 401 must throw CloudAuthExpiredError
  const expiredFetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;
  await assert.rejects(() => findDriveSaveFile('expired_tok', expiredFetch), CloudAuthExpiredError);
});

test('CloudSyncService: Android Play Games native bridge integrates sign-in, load, save, and delete', async () => {
  const store = new Map<string, { data: string; updatedAtMs: number; description?: string }>();
  const globalAny = globalThis as unknown as { window?: Record<string, unknown> };
  const prevWindow = globalAny.window;

  try {
    globalAny.window = {
      CapyPlayGamesBridge: {
        signIn: async () => ({
          playerId: 'pgs_player_42',
          displayName: 'CapytainPlay',
          avatarUrl: 'https://lh3.googleusercontent.com/pgs.png',
        }),
        signOut: async () => undefined,
        getCurrentPlayer: async () => ({
          playerId: 'pgs_player_42',
          displayName: 'CapytainPlay',
        }),
        loadSavedGame: async (slotName: string) => store.get(slotName) ?? null,
        saveGame: async (slotName: string, data: string, description: string) => {
          const updatedAtMs = 1_700_123_456_000;
          store.set(slotName, { data, updatedAtMs, description });
          return { updatedAtMs };
        },
        deleteSavedGame: async (slotName: string) => {
          store.delete(slotName);
        },
      },
    };

    assert.equal(isPlayGamesBridgeAvailable(), true);
    const profile = await CloudSyncService.signInWithPlayGames();
    assert.equal(profile.provider, 'play_games');
    assert.equal(profile.displayName, 'CapytainPlay');

    assert.equal(await CloudSyncService.inspectCloudSave('play_games'), null);

    const savedMeta = await CloudSyncService.uploadCloudSave(
      'play_games',
      '{"schema":"capygame-save-bundle-v2"}',
      'Test snapshot'
    );
    assert.equal(savedMeta.fileId, PLAY_GAMES_SNAPSHOT_SLOT);

    const loaded = await CloudSyncService.inspectCloudSave('play_games');
    assert.equal(loaded?.jsonText, '{"schema":"capygame-save-bundle-v2"}');

    await CloudSyncService.deleteCloudSave('play_games', PLAY_GAMES_SNAPSHOT_SLOT);
    assert.equal(await CloudSyncService.inspectCloudSave('play_games'), null);
    await CloudSyncService.signOut('play_games');
  } finally {
    if (prevWindow === undefined) {
      delete globalAny.window;
    } else {
      globalAny.window = prevWindow;
    }
  }
});

test('Regression Guard: Forest Micro-Glade async loader re-registers layer.materials and syncs active specimen', () => {
  const simPath = path.resolve(process.cwd(), 'src/capygame/engine/SeamlessUniverseSimulator.ts');
  const src = fs.readFileSync(simPath, 'utf8');
  const fnIdx = src.indexOf('private populateLeafAndFurMicroLayer(');
  assert.ok(fnIdx !== -1, 'populateLeafAndFurMicroLayer must exist');
  const snippet = src.slice(fnIdx, fnIdx + 850);
  assert.ok(
    snippet.includes('layer.materials = this.collectLayerMaterials(group);'),
    'Async Micro-Glade loader must update layer.materials inside .then(...) so crossfades work smoothly'
  );
  assert.ok(
    snippet.includes('diorama.setActiveSpecimen(this.activeForestSpecimenId);'),
    'Async Micro-Glade loader must re-sync activeForestSpecimenId after diorama builds'
  );
});
