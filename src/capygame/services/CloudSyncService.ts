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
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'profile',
  'email',
] as const;

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCOPE_STRING = SCOPES.join(' ');
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleGisWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GisTokenResponse) => void;
          error_callback?: (error: { type?: string; message?: string }) => void;
        }) => GisTokenClient;
        revoke?: (token: string, done?: () => void) => void;
      };
    };
  };
}

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

export function getConfiguredGoogleClientId(overrideClientId?: string): string {
  if (typeof overrideClientId === 'string') {
    return overrideClientId.trim();
  }
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GOOGLE_CLIENT_ID;
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

export function isGoogleDriveSyncConfigured(overrideClientId?: string): boolean {
  return getConfiguredGoogleClientId(overrideClientId).length > 0;
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

// Strict in-memory token cache (NEVER persisted to localStorage or sessionStorage)
let inMemoryGoogleToken: { accessToken: string; expiresAtMs: number } | null = null;
let inMemoryGoogleProfile: CloudAccountProfile | null = null;
let inMemoryPlayGamesProfile: CloudAccountProfile | null = null;
let gisScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServicesScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Sign-In requires a browser environment.'));
  }
  const gWin = window as GoogleGisWindow;
  if (gWin.google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve();
  }
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    if (existing) {
      if (gWin.google?.accounts?.oauth2?.initTokenClient) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          gisScriptPromise = null;
          reject(new Error('Could not load Google Sign-In script. Check your internet connection.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Could not load Google Sign-In script. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

function getValidGoogleAccessToken(): string | null {
  if (!inMemoryGoogleToken) return null;
  // Treat token as expired 30 seconds before hard expiry
  if (Date.now() >= inMemoryGoogleToken.expiresAtMs - 30_000) {
    inMemoryGoogleToken = null;
    inMemoryGoogleProfile = null;
    return null;
  }
  return inMemoryGoogleToken.accessToken;
}

export class CloudSyncService {
  public static getActiveAccount(): CloudAccountProfile | null {
    if (inMemoryPlayGamesProfile) return inMemoryPlayGamesProfile;
    if (inMemoryGoogleProfile && getValidGoogleAccessToken()) {
      return inMemoryGoogleProfile;
    }
    return null;
  }

  public static async initGoogleAuthListener(
    onAuthenticated: (profile: CloudAccountProfile) => void,
    onSignedOut: () => void
  ): Promise<() => void> {
    if (inMemoryGoogleProfile && getValidGoogleAccessToken()) {
      onAuthenticated(inMemoryGoogleProfile);
    } else if (!inMemoryPlayGamesProfile) {
      onSignedOut();
    }
    return () => undefined;
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

  public static async signInWithGoogleDrive(
    prompt: 'consent' | 'select_account' | '' = 'select_account',
    overrideClientId?: string
  ): Promise<CloudAccountProfile> {
    const clientId = getConfiguredGoogleClientId(overrideClientId);
    if (!clientId) {
      throw new Error(
        'Google Sign-In is not configured for this build (VITE_GOOGLE_CLIENT_ID is empty).'
      );
    }

    await loadGoogleIdentityServicesScript();
    const gWin = window as GoogleGisWindow;
    const oauth2 = gWin.google?.accounts?.oauth2;
    if (!oauth2?.initTokenClient) {
      throw new Error('Google Identity Services failed to initialize.');
    }

    const tokenResp = await new Promise<GisTokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: GIS_SCOPE_STRING,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(
              new Error(
                resp.error_description || resp.error || 'Google Sign-In did not grant access.'
              )
            );
            return;
          }
          resolve(resp);
        },
        error_callback: (err) => {
          reject(
            new Error(
              err.type === 'popup_closed'
                ? 'Google Sign-In popup was closed before completing.'
                : err.message || 'Google Sign-In popup was blocked or cancelled.'
            )
          );
        },
      });
      client.requestAccessToken({ prompt });
    });

    const expiresInSec =
      typeof tokenResp.expires_in === 'number' && Number.isFinite(tokenResp.expires_in)
        ? tokenResp.expires_in
        : 3600;
    inMemoryGoogleToken = {
      accessToken: tokenResp.access_token!,
      expiresAtMs: Date.now() + expiresInSec * 1000,
    };

    try {
      const profile = await fetchGoogleUserProfile(inMemoryGoogleToken.accessToken);
      inMemoryGoogleProfile = profile;
      NativeBridge.haptic('success');
      return profile;
    } catch (err) {
      inMemoryGoogleToken = null;
      inMemoryGoogleProfile = null;
      throw err;
    }
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

    const token = inMemoryGoogleToken?.accessToken;
    inMemoryGoogleToken = null;
    inMemoryGoogleProfile = null;
    if (token && typeof window !== 'undefined') {
      const gWin = window as GoogleGisWindow;
      try {
        gWin.google?.accounts?.oauth2?.revoke?.(token);
      } catch {
        // Ignore revoke errors
      }
    }
  }

  public static async checkCloudMetadata(
    provider: CloudSyncProviderId
  ): Promise<CloudSaveMetadata | null> {
    if (provider === 'play_games') {
      const remote = await this.inspectCloudSave('play_games');
      return remote?.metadata ?? null;
    }

    const token = getValidGoogleAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      return await findDriveSaveFile(token);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        inMemoryGoogleToken = null;
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

    const token = getValidGoogleAccessToken();
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
        inMemoryGoogleToken = null;
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

    const token = getValidGoogleAccessToken();
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
        inMemoryGoogleToken = null;
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

    const token = getValidGoogleAccessToken();
    if (!token) {
      inMemoryGoogleProfile = null;
      throw new CloudAuthExpiredError();
    }
    try {
      await deleteDriveSaveFile(token, fileId);
    } catch (err) {
      if (err instanceof CloudAuthExpiredError) {
        inMemoryGoogleToken = null;
        inMemoryGoogleProfile = null;
      }
      throw err;
    }
  }
}
