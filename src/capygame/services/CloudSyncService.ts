import firebaseConfig from '../../../firebase-applet-config.json';
import {
  NativeBridge,
  type PlayGamesNativePlugin,
  type PlayGamesPlayerProfile,
} from '../../services/NativeBridge';

export type CloudSyncProviderId = 'google_drive' | 'play_games';

export interface CloudAccountProfile {
  provider: CloudSyncProviderId;
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

export interface CloudSaveMetadata {
  provider: CloudSyncProviderId;
  fileId: string;
  fileName: string;
  updatedAtIso: string;
  updatedAtMs: number;
  sizeBytes?: number;
}

export interface CloudSaveDownloadResult {
  metadata: CloudSaveMetadata;
  jsonText: string;
}

export interface GoogleDriveFileEntry {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export const DRIVE_SAVE_FILE_NAME = 'CapyGame-Cloud-Save.json';
export const PLAY_GAMES_SNAPSHOT_SLOT = 'capygame_cloud_save_v2';
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class CloudAuthExpiredError extends Error {
  constructor(message: string = 'Your Google sign-in session expired. Please sign in again.') {
    super(message);
    this.name = 'CloudAuthExpiredError';
  }
}

export function sanitizeHttpsAvatarUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Reject malformed URLs
  }
  return undefined;
}

export function isGoogleDriveSyncConfigured(): boolean {
  const cfg = firebaseConfig as { apiKey?: string; authDomain?: string; projectId?: string } | null;
  return Boolean(cfg?.apiKey && cfg?.authDomain && cfg?.projectId);
}

export function getActivePlayGamesBridge(): PlayGamesNativePlugin | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.CapyPlayGamesBridge ?? window.Capacitor?.Plugins?.PlayGames ?? null;
  if (
    candidate &&
    typeof candidate.signIn === 'function' &&
    typeof candidate.loadSavedGame === 'function' &&
    typeof candidate.saveGame === 'function'
  ) {
    return candidate;
  }
  return null;
}

export function isPlayGamesBridgeAvailable(): boolean {
  return getActivePlayGamesBridge() !== null;
}

/**
 * Pure Google Drive v3 multipart request body builder (testable without browser DOM).
 */
export function buildDriveMultipartBody(
  metadata: Record<string, unknown>,
  jsonContent: string,
  boundary: string = 'capygame_save_boundary_v2'
): { body: string; contentType: string } {
  const parts = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonContent,
    `--${boundary}--`,
  ];
  return {
    body: parts.join('\r\n'),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

/**
 * Queries Google Drive v3 for CapyGame's own backup file (drive.file scope).
 */
export async function findDriveSaveFile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<CloudSaveMetadata | null> {
  const q = encodeURIComponent(`name='${DRIVE_SAVE_FILE_NAME}' and trashed=false`);
  const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
  const url = `${DRIVE_FILES_API}?q=${q}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=${fields}`;

  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new CloudAuthExpiredError();
  }
  if (!res.ok) {
    throw new Error(`Google Drive lookup failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { files?: GoogleDriveFileEntry[] };
  const file = Array.isArray(data.files) ? data.files[0] : undefined;
  if (!file || typeof file.id !== 'string' || !file.id) {
    return null;
  }

  const updatedAtIso =
    typeof file.modifiedTime === 'string' && file.modifiedTime.length > 0
      ? file.modifiedTime
      : new Date().toISOString();
  const parsedMs = Date.parse(updatedAtIso);
  const sizeNum = typeof file.size === 'string' ? Number(file.size) : undefined;

  return {
    provider: 'google_drive',
    fileId: file.id,
    fileName: file.name || DRIVE_SAVE_FILE_NAME,
    updatedAtIso,
    updatedAtMs: Number.isFinite(parsedMs) ? parsedMs : Date.now(),
    sizeBytes:
      typeof sizeNum === 'number' && Number.isFinite(sizeNum) ? Math.max(0, sizeNum) : undefined,
  };
}

export async function downloadDriveSaveFile(
  accessToken: string,
  metadata: CloudSaveMetadata,
  fetchImpl: typeof fetch = fetch
): Promise<CloudSaveDownloadResult> {
  const url = `${DRIVE_FILES_API}/${encodeURIComponent(metadata.fileId)}?alt=media`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new CloudAuthExpiredError();
  }
  if (!res.ok) {
    throw new Error(`Failed to download Google Drive backup (HTTP ${res.status}).`);
  }

  const jsonText = await res.text();
  return { metadata, jsonText };
}

export async function uploadDriveSaveFile(
  accessToken: string,
  jsonContent: string,
  existingFileId?: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<CloudSaveMetadata> {
  const isUpdate = typeof existingFileId === 'string' && existingFileId.trim().length > 0;
  const endpoint = isUpdate
    ? `${DRIVE_UPLOAD_API}/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime,size`
    : `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime,size`;

  const metadataPayload = { name: DRIVE_SAVE_FILE_NAME, mimeType: 'application/json' };
  const { body, contentType } = buildDriveMultipartBody(metadataPayload, jsonContent);

  const res = await fetchImpl(endpoint, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body,
  });

  if (res.status === 401) {
    throw new CloudAuthExpiredError();
  }
  if (!res.ok) {
    throw new Error(`Failed to upload Google Drive backup (HTTP ${res.status}).`);
  }

  const file = (await res.json()) as GoogleDriveFileEntry;
  const updatedAtIso =
    typeof file.modifiedTime === 'string' && file.modifiedTime.length > 0
      ? file.modifiedTime
      : new Date().toISOString();
  const parsedMs = Date.parse(updatedAtIso);
  const sizeNum = typeof file.size === 'string' ? Number(file.size) : jsonContent.length;

  return {
    provider: 'google_drive',
    fileId: file.id || existingFileId || '',
    fileName: file.name || DRIVE_SAVE_FILE_NAME,
    updatedAtIso,
    updatedAtMs: Number.isFinite(parsedMs) ? parsedMs : Date.now(),
    sizeBytes: Number.isFinite(sizeNum) ? Math.max(0, sizeNum) : jsonContent.length,
  };
}

export async function deleteDriveSaveFile(
  accessToken: string,
  fileId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const url = `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}`;
  const res = await fetchImpl(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new CloudAuthExpiredError();
  }
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete Google Drive backup (HTTP ${res.status}).`);
  }
}

export async function fetchGoogleUserProfile(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<CloudAccountProfile> {
  const res = await fetchImpl(GOOGLE_USERINFO_API, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (res.status === 401) {
    throw new CloudAuthExpiredError();
  }
  if (!res.ok) {
    throw new Error(`Failed to load Google account profile (HTTP ${res.status}).`);
  }
  const info = (await res.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };
  return {
    provider: 'google_drive',
    id: info.sub || info.email || 'google-user',
    displayName: info.name || info.email || 'Google Account',
    email: typeof info.email === 'string' ? info.email : undefined,
    avatarUrl: sanitizeHttpsAvatarUrl(info.picture),
  };
}

// Strict in-memory account state (access token lives strictly in FirebaseDriveAuth memory)
let inMemoryGoogleProfile: CloudAccountProfile | null = null;
let inMemoryPlayGamesProfile: CloudAccountProfile | null = null;

async function loadFirebaseDriveAuth() {
  return import('./FirebaseDriveAuth');
}

export class CloudSyncService {
  public static getActiveAccount(): CloudAccountProfile | null {
    if (inMemoryPlayGamesProfile) return inMemoryPlayGamesProfile;
    if (inMemoryGoogleProfile) return inMemoryGoogleProfile;
    return null;
  }

  public static async initGoogleAuthListener(
    onAuthenticated: (profile: CloudAccountProfile) => void,
    onSignedOut: () => void
  ): Promise<() => void> {
    if (!isGoogleDriveSyncConfigured() || typeof window === 'undefined') {
      return () => undefined;
    }
    const mod = await loadFirebaseDriveAuth();
    return mod.initFirebaseDriveAuth(
      (fbProfile) => {
        const mapped: CloudAccountProfile = {
          provider: 'google_drive',
          id: fbProfile.id,
          displayName: fbProfile.displayName,
          email: fbProfile.email,
          avatarUrl: fbProfile.avatarUrl,
        };
        inMemoryGoogleProfile = mapped;
        onAuthenticated(mapped);
      },
      () => {
        inMemoryGoogleProfile = null;
        if (!inMemoryPlayGamesProfile) {
          onSignedOut();
        }
      }
    );
  }

  public static async detectExistingPlayGamesSession(): Promise<CloudAccountProfile | null> {
    const bridge = getActivePlayGamesBridge();
    if (!bridge?.getCurrentPlayer) return null;
    try {
      const player = await bridge.getCurrentPlayer();
      if (!player) return null;
      inMemoryPlayGamesProfile = this.mapPlayGamesProfile(player);
      return inMemoryPlayGamesProfile;
    } catch {
      return null;
    }
  }

  private static mapPlayGamesProfile(player: PlayGamesPlayerProfile): CloudAccountProfile {
    return {
      provider: 'play_games',
      id: player.playerId,
      displayName: player.displayName || 'Play Games Player',
      avatarUrl: sanitizeHttpsAvatarUrl(player.avatarUrl),
    };
  }

  public static async signInWithPlayGames(): Promise<CloudAccountProfile> {
    const bridge = getActivePlayGamesBridge();
    if (!bridge) {
      throw new Error(
        'Google Play Games Services is only available inside the native Android Play Store build.'
      );
    }
    const player = await bridge.signIn();
    if (!player) {
      throw new Error('Google Play Games sign-in was cancelled.');
    }
    NativeBridge.haptic('success');
    inMemoryPlayGamesProfile = this.mapPlayGamesProfile(player);
    return inMemoryPlayGamesProfile;
  }

  public static async signInWithGoogleDrive(): Promise<CloudAccountProfile> {
    if (!isGoogleDriveSyncConfigured()) {
      throw new Error('Google Drive sign-in is not configured for this build.');
    }
    const mod = await loadFirebaseDriveAuth();
    const { profile } = await mod.signInWithFirebaseGoogleDrive();
    const mapped: CloudAccountProfile = {
      provider: 'google_drive',
      id: profile.id,
      displayName: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    };
    inMemoryGoogleProfile = mapped;
    NativeBridge.haptic('success');
    return mapped;
  }

  public static async signOut(provider: CloudSyncProviderId): Promise<void> {
    if (provider === 'play_games') {
      const bridge = getActivePlayGamesBridge();
      inMemoryPlayGamesProfile = null;
      if (bridge?.signOut) {
        try {
          await bridge.signOut();
        } catch {
          // Ignore native sign-out errors
        }
      }
      return;
    }

    inMemoryGoogleProfile = null;
    const mod = await loadFirebaseDriveAuth();
    await mod.signOutFirebaseDrive();
  }

  public static async checkCloudMetadata(
    provider: CloudSyncProviderId
  ): Promise<CloudSaveMetadata | null> {
    if (provider === 'play_games') {
      const remote = await this.inspectCloudSave('play_games');
      return remote?.metadata ?? null;
    }

    const mod = await loadFirebaseDriveAuth();
    const token = mod.getCachedFirebaseAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      return await findDriveSaveFile(token);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        mod.clearCachedFirebaseAccessToken();
        inMemoryGoogleProfile = null;
      }
      throw err;
    }
  }

  public static async inspectCloudSave(
    provider: CloudSyncProviderId
  ): Promise<CloudSaveDownloadResult | null> {
    if (provider === 'play_games') {
      const bridge = getActivePlayGamesBridge();
      if (!bridge) throw new Error('Android Play Games bridge unavailable.');
      const snapshot = await bridge.loadSavedGame(PLAY_GAMES_SNAPSHOT_SLOT);
      if (!snapshot || !snapshot.data) return null;
      const updatedAtMs =
        Number.isFinite(snapshot.updatedAtMs) && snapshot.updatedAtMs > 0
          ? snapshot.updatedAtMs
          : Date.now();
      return {
        metadata: {
          provider: 'play_games',
          fileId: PLAY_GAMES_SNAPSHOT_SLOT,
          fileName: PLAY_GAMES_SNAPSHOT_SLOT,
          updatedAtIso: new Date(updatedAtMs).toISOString(),
          updatedAtMs,
          sizeBytes: snapshot.data.length,
        },
        jsonText: snapshot.data,
      };
    }

    const mod = await loadFirebaseDriveAuth();
    const token = mod.getCachedFirebaseAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      const meta = await findDriveSaveFile(token);
      if (!meta) return null;
      return await downloadDriveSaveFile(token, meta);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        mod.clearCachedFirebaseAccessToken();
        inMemoryGoogleProfile = null;
      }
      throw err;
    }
  }

  public static async uploadCloudSave(
    provider: CloudSyncProviderId,
    jsonContent: string,
    description: string,
    existingFileId?: string | null
  ): Promise<CloudSaveMetadata> {
    if (provider === 'play_games') {
      const bridge = getActivePlayGamesBridge();
      if (!bridge) throw new Error('Android Play Games bridge unavailable.');
      const result = await bridge.saveGame(PLAY_GAMES_SNAPSHOT_SLOT, jsonContent, description);
      const updatedAtMs =
        Number.isFinite(result.updatedAtMs) && result.updatedAtMs > 0
          ? result.updatedAtMs
          : Date.now();
      return {
        provider: 'play_games',
        fileId: PLAY_GAMES_SNAPSHOT_SLOT,
        fileName: PLAY_GAMES_SNAPSHOT_SLOT,
        updatedAtIso: new Date(updatedAtMs).toISOString(),
        updatedAtMs,
        sizeBytes: jsonContent.length,
      };
    }

    const mod = await loadFirebaseDriveAuth();
    const token = mod.getCachedFirebaseAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      let targetFileId = existingFileId ?? null;
      if (!targetFileId) {
        const existing = await findDriveSaveFile(token);
        targetFileId = existing?.fileId ?? null;
      }
      return await uploadDriveSaveFile(token, jsonContent, targetFileId);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        mod.clearCachedFirebaseAccessToken();
        inMemoryGoogleProfile = null;
      }
      throw err;
    }
  }

  public static async deleteCloudSave(
    provider: CloudSyncProviderId,
    fileId: string
  ): Promise<void> {
    if (provider === 'play_games') {
      const bridge = getActivePlayGamesBridge();
      if (!bridge?.deleteSavedGame) {
        throw new Error('Deleting Play Games snapshots is not supported by this Android bridge.');
      }
      await bridge.deleteSavedGame(PLAY_GAMES_SNAPSHOT_SLOT);
      return;
    }

    const mod = await loadFirebaseDriveAuth();
    const token = mod.getCachedFirebaseAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      await deleteDriveSaveFile(token, fileId);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        mod.clearCachedFirebaseAccessToken();
        inMemoryGoogleProfile = null;
      }
      throw err;
    }
  }
}
