import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  Gamepad2,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { CapyGameSettings, PlayerStats } from '../types';
import type { ProceduralGameConfig } from '../config/ProceduralGameConfig';
import { ProgressionService } from '../services/ProgressionService';
import {
  type SaveSnapshotComparison,
  type SaveSnapshotSummary,
  compareSaveSnapshots,
  formatGhostTimeSec,
  formatSaveTimestamp,
} from '../services/SaveSyncMath';
import {
  CloudAuthExpiredError,
  type CloudAccountProfile,
  type CloudSaveMetadata,
  type CloudSyncProviderId,
  CloudSyncService,
  DRIVE_SAVE_FILE_NAME,
  isGoogleDriveSyncConfigured,
  isPlayGamesBridgeAvailable,
} from '../services/CloudSyncService';

export interface CapySaveSyncPanelProps {
  stats: PlayerStats;
  gameSettings: CapyGameSettings;
  proceduralConfig: ProceduralGameConfig;
  isSaveJsonPasteOpen: boolean;
  saveJsonDraft: string;
  savePortabilityFeedback: { tone: 'ok' | 'error'; message: string } | null;
  onExportSaveBundleFile: () => void;
  onCopySaveBundleJson: () => void;
  onToggleSaveJsonPasteOpen: () => void;
  onChangeSaveJsonDraft: (val: string) => void;
  onApplyImportedSaveBundle: (raw: string) => boolean;
}

type PendingConfirmation =
  | {
      kind: 'import_local';
      sourceLabel: string;
      rawJson: string;
      localSummary: SaveSnapshotSummary;
      incomingSummary: SaveSnapshotSummary;
      comparison: SaveSnapshotComparison;
      warningsCount: number;
    }
  | {
      kind: 'cloud_conflict';
      provider: CloudSyncProviderId;
      cloudMeta: CloudSaveMetadata;
      cloudRawJson: string;
      localSummary: SaveSnapshotSummary;
      cloudSummary: SaveSnapshotSummary;
      comparison: SaveSnapshotComparison;
    }
  | {
      kind: 'cloud_overwrite';
      provider: CloudSyncProviderId;
      existingCloudMeta: CloudSaveMetadata | null;
      localSummary: SaveSnapshotSummary;
      cloudSummary: SaveSnapshotSummary | null;
    }
  | {
      kind: 'cloud_delete';
      provider: CloudSyncProviderId;
      cloudMeta: CloudSaveMetadata;
    };

const SnapshotCard: React.FC<{
  title: string;
  badge?: string;
  badgeTone?: 'emerald' | 'sky' | 'zinc';
  summary: SaveSnapshotSummary;
}> = ({ title, badge, badgeTone = 'zinc', summary }) => {
  const badgeClass =
    badgeTone === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : badgeTone === 'sky'
        ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
        : 'bg-zinc-800 text-zinc-300 border-white/10';

  return (
    <div className="p-2.5 rounded-lg bg-zinc-950 border border-white/10 space-y-1.5">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-semibold text-zinc-100 truncate">{title}</span>
        {badge && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border shrink-0 ${badgeClass}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="text-[10px] font-mono text-zinc-400 truncate">
        {formatSaveTimestamp(summary.updatedAtMs)}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-zinc-300 pt-1 border-t border-white/8">
        <div className="whitespace-nowrap">Coins: {summary.coins.toLocaleString()}</div>
        <div className="whitespace-nowrap">DNA: {summary.dna.toLocaleString()}</div>
        <div className="whitespace-nowrap">Prestige: T{summary.prestigeLevel}</div>
        <div className="whitespace-nowrap">Factory: {summary.capytorioEntities}</div>
        <div className="whitespace-nowrap">Buildings: {summary.sanctuaryBuildings}</div>
        <div className="whitespace-nowrap">Parkour: {formatGhostTimeSec(summary.yuzuBestMs)}</div>
      </div>
      <div className="text-[10px] text-zinc-400 truncate">
        World: {summary.worldPresetName}
        {summary.worldSeed !== null ? ` (#${summary.worldSeed})` : ''}
      </div>
    </div>
  );
};

export const CapySaveSyncPanel: React.FC<CapySaveSyncPanelProps> = ({
  stats,
  gameSettings,
  proceduralConfig,
  isSaveJsonPasteOpen,
  saveJsonDraft,
  savePortabilityFeedback,
  onExportSaveBundleFile,
  onCopySaveBundleJson,
  onToggleSaveJsonPasteOpen,
  onChangeSaveJsonDraft,
  onApplyImportedSaveBundle,
}) => {
  const saveImportFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [account, setAccount] = useState<CloudAccountProfile | null>(() =>
    CloudSyncService.getActiveAccount()
  );
  const [cloudMeta, setCloudMeta] = useState<CloudSaveMetadata | null>(null);
  const [cloudBusy, setCloudBusy] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(
    null
  );
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);

  const googleDriveConfigured = isGoogleDriveSyncConfigured();
  const playGamesAvailable = isPlayGamesBridgeAvailable();

  useEffect(() => {
    let active = true;
    let unsubGoogle: (() => void) | null = null;

    if (!account && playGamesAvailable) {
      void CloudSyncService.detectExistingPlayGamesSession().then((profile) => {
        if (active && profile) {
          setAccount(profile);
        }
      });
    }

    if (googleDriveConfigured) {
      void CloudSyncService.initGoogleAuthListener(
        (profile) => {
          if (active) {
            setAccount((prev) => (prev?.provider === 'play_games' ? prev : profile));
          }
        },
        () => {
          if (active) {
            setAccount((prev) => (prev?.provider === 'google_drive' ? null : prev));
            setCloudMeta((prev) => (prev?.provider === 'google_drive' ? null : prev));
          }
        }
      ).then((unsub) => {
        if (active) {
          unsubGoogle = unsub;
        } else {
          unsub();
        }
      });
    }

    return () => {
      active = false;
      unsubGoogle?.();
    };
  }, [googleDriveConfigured, playGamesAvailable]);

  const getCurrentLocalSummary = (): SaveSnapshotSummary =>
    ProgressionService.getLocalSnapshotSummary(stats, proceduralConfig);

  const stageLocalImportPreview = (rawJson: string, sourceLabel: string) => {
    setLocalError(null);
    const parsed = ProgressionService.parseAndValidateSaveBundle(rawJson);
    if (!parsed.ok) {
      setLocalError(parsed.error);
      return;
    }
    const localSummary = getCurrentLocalSummary();
    const comparison = compareSaveSnapshots(localSummary, parsed.summary, 'Incoming backup');
    setPendingConfirm({
      kind: 'import_local',
      sourceLabel,
      rawJson,
      localSummary,
      incomingSummary: parsed.summary,
      comparison,
      warningsCount: parsed.warnings.length,
    });
  };

  const handleFileObject = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      stageLocalImportPreview(text, file.name || 'Imported JSON file');
    } catch {
      setLocalError('Could not read the selected JSON file.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void handleFileObject(file);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    void handleFileObject(file);
  };

  const handleCloudError = (err: unknown) => {
    if (err instanceof CloudAuthExpiredError) {
      setAccount(null);
      setCloudMeta(null);
    }
    const msg = err instanceof Error ? err.message : 'Cloud sync request failed.';
    setCloudStatus({ tone: 'error', message: msg });
  };

  const handleSignIn = async (provider: CloudSyncProviderId) => {
    setCloudBusy(provider === 'play_games' ? 'Signing in to Play Games...' : 'Signing in with Google...');
    setCloudStatus(null);
    try {
      const profile =
        provider === 'play_games'
          ? await CloudSyncService.signInWithPlayGames()
          : await CloudSyncService.signInWithGoogleDrive();
      setAccount(profile);

      // Perform a non-destructive read-only lookup so existing cloud backup status is immediately visible
      try {
        const existingMeta = await CloudSyncService.checkCloudMetadata(provider);
        setCloudMeta(existingMeta);
        setCloudStatus({
          tone: 'ok',
          message: existingMeta
            ? `Signed in as ${profile.email || profile.displayName}. Found cloud backup from ${formatSaveTimestamp(existingMeta.updatedAtMs)}.`
            : `Signed in as ${profile.email || profile.displayName}. No cloud backup yet—click Upload Local to create one.`,
        });
      } catch {
        setCloudStatus({
          tone: 'ok',
          message: `Signed in as ${profile.email || profile.displayName}. Click Check & Sync to compare saves.`,
        });
      }
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const handleSignOut = async () => {
    if (!account) return;
    setCloudBusy('Signing out...');
    try {
      await CloudSyncService.signOut(account.provider);
      setAccount(null);
      setCloudMeta(null);
      setPendingConfirm(null);
      setCloudStatus({ tone: 'ok', message: 'Signed out cleanly. Local saves remain on this device.' });
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const handleCheckAndSync = async () => {
    if (!account) return;
    setCloudBusy('Checking cloud backup...');
    setCloudStatus(null);
    try {
      const remote = await CloudSyncService.inspectCloudSave(account.provider);
      const localSummary = getCurrentLocalSummary();

      if (!remote) {
        setCloudMeta(null);
        setPendingConfirm({
          kind: 'cloud_overwrite',
          provider: account.provider,
          existingCloudMeta: null,
          localSummary,
          cloudSummary: null,
        });
        return;
      }

      setCloudMeta(remote.metadata);
      const parsed = ProgressionService.parseAndValidateSaveBundle(remote.jsonText);
      if (!parsed.ok) {
        setCloudStatus({
          tone: 'error',
          message: `Cloud backup could not be parsed (${parsed.error}). You can overwrite it with this device's save.`,
        });
        return;
      }

      const comparison = compareSaveSnapshots(localSummary, parsed.summary);
      setPendingConfirm({
        kind: 'cloud_conflict',
        provider: account.provider,
        cloudMeta: remote.metadata,
        cloudRawJson: remote.jsonText,
        localSummary,
        cloudSummary: parsed.summary,
        comparison,
      });
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const handleRequestUpload = async () => {
    if (!account) return;
    setCloudBusy('Checking existing cloud backup...');
    setCloudStatus(null);
    try {
      const remote = await CloudSyncService.inspectCloudSave(account.provider);
      const localSummary = getCurrentLocalSummary();
      let cloudSummary: SaveSnapshotSummary | null = null;
      if (remote) {
        setCloudMeta(remote.metadata);
        const parsed = ProgressionService.parseAndValidateSaveBundle(remote.jsonText);
        if (parsed.ok) cloudSummary = parsed.summary;
      }
      setPendingConfirm({
        kind: 'cloud_overwrite',
        provider: account.provider,
        existingCloudMeta: remote?.metadata ?? null,
        localSummary,
        cloudSummary,
      });
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const executeCloudUpload = async (
    provider: CloudSyncProviderId,
    existingFileId?: string | null
  ) => {
    setCloudBusy('Uploading save to cloud...');
    setCloudStatus(null);
    try {
      const json = ProgressionService.exportSaveBundleJson(
        stats,
        gameSettings,
        undefined,
        proceduralConfig
      );
      const description = `CapyGame ${stats.coins}c ${stats.dna} DNA (Prestige T${stats.prestigeLevel})`;
      const uploaded = await CloudSyncService.uploadCloudSave(
        provider,
        json,
        description,
        existingFileId
      );
      setCloudMeta(uploaded);
      setPendingConfirm(null);
      setCloudStatus({
        tone: 'ok',
        message:
          provider === 'google_drive'
            ? `Saved ${DRIVE_SAVE_FILE_NAME} to your Google Drive (${formatSaveTimestamp(uploaded.updatedAtMs)}).`
            : `Saved to Google Play Games (${formatSaveTimestamp(uploaded.updatedAtMs)}).`,
      });
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const executeCloudDelete = async (provider: CloudSyncProviderId, meta: CloudSaveMetadata) => {
    setCloudBusy('Deleting cloud backup...');
    setCloudStatus(null);
    try {
      await CloudSyncService.deleteCloudSave(provider, meta.fileId);
      setCloudMeta(null);
      setPendingConfirm(null);
      setCloudStatus({
        tone: 'ok',
        message: 'Cloud backup deleted. Local saves on this device were not changed.',
      });
    } catch (err) {
      handleCloudError(err);
    } finally {
      setCloudBusy(null);
    }
  };

  const providerTitle =
    account?.provider === 'play_games' ? 'Google Play Games' : 'Google Drive';

  return (
    <div
      data-testid="settings-save-portability-panel"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDropFile}
      className={`p-3 rounded-lg bg-zinc-950/90 border space-y-3 transition-colors ${
        isDraggingFile ? 'border-sky-400 bg-sky-950/25' : 'border-emerald-400/25'
      }`}
    >
      {/* Header & Local JSON Backup Actions */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-zinc-100">
              Save Backup &amp; Cloud Sync
            </div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
              Full profile: progress, Capytorio factory, settings, world seeds &amp; Parkour PB
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="settings-export-save-btn"
              onClick={onExportSaveBundleFile}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/35 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              data-testid="settings-copy-save-btn"
              onClick={onCopySaveBundleJson}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              data-testid="settings-import-save-btn"
              onClick={() => saveImportFileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-400/35 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>Import File</span>
            </button>
            <button
              type="button"
              data-testid="settings-toggle-paste-save-btn"
              onClick={onToggleSaveJsonPasteOpen}
              className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/15 cursor-pointer"
            >
              {isSaveJsonPasteOpen ? 'Hide JSON' : 'Paste JSON'}
            </button>
          </div>
        </div>

        <input
          ref={saveImportFileInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="settings-import-save-input"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {isDraggingFile && (
          <div className="text-[11px] font-mono text-sky-300 text-center py-2 rounded border border-dashed border-sky-400/60 bg-sky-500/10">
            Drop your CapyGame .json save file to preview and restore
          </div>
        )}

        {isSaveJsonPasteOpen && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <textarea
              data-testid="settings-import-json-textarea"
              value={saveJsonDraft}
              onChange={(e) => onChangeSaveJsonDraft(e.target.value)}
              placeholder="Paste capygame-save-bundle-v2 (or v1) JSON here..."
              rows={5}
              className="w-full rounded-lg bg-zinc-900 border border-white/15 p-2 text-[11px] font-mono text-zinc-100 focus:outline-none focus:border-sky-400/60"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="settings-apply-import-json-btn"
                disabled={!saveJsonDraft.trim()}
                onClick={() => stageLocalImportPreview(saveJsonDraft, 'Pasted JSON backup')}
                className="px-3 py-1 rounded text-[11px] font-mono bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 text-sky-200 border border-sky-400/40 cursor-pointer"
              >
                Preview &amp; Import
              </button>
            </div>
          </div>
        )}

        {(localError || savePortabilityFeedback) && (
          <div
            data-testid="settings-save-status"
            className={`text-[11px] font-mono px-2.5 py-1.5 rounded border ${
              localError || savePortabilityFeedback?.tone === 'error'
                ? 'bg-rose-500/10 text-rose-300 border-rose-400/30'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
            }`}
          >
            {localError ?? savePortabilityFeedback?.message}
          </div>
        )}
      </div>

      {/* Zero-Server Cloud Sync Section (Google Drive GIS + Android Play Games Native Bridge) */}
      <div
        data-testid="settings-cloud-sync-panel"
        className="pt-2.5 border-t border-white/10 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-zinc-100">
              Account &amp; Cloud Sync (Google Drive &amp; Play Games)
            </span>
          </div>
          {account && (
            <button
              type="button"
              data-testid="cloud-signout-btn"
              disabled={cloudBusy !== null}
              onClick={() => void handleSignOut()}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          )}
        </div>

        {account ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/90 border border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                {account.avatarUrl ? (
                  <img
                    src={account.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border border-white/15 shrink-0"
                  />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-100 truncate">
                    {account.displayName}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 truncate">
                    {providerTitle}
                    {account.email ? ` · ${account.email}` : ''}
                  </div>
                </div>
              </div>
              {cloudMeta && (
                <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                  Synced {formatSaveTimestamp(cloudMeta.updatedAtMs)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="cloud-sync-check-btn"
                disabled={cloudBusy !== null}
                onClick={() => void handleCheckAndSync()}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-50 text-sky-200 border border-sky-400/40 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${cloudBusy ? 'animate-spin' : ''}`} />
                <span>Check &amp; Sync</span>
              </button>
              <button
                type="button"
                data-testid="cloud-upload-btn"
                disabled={cloudBusy !== null}
                onClick={() => void handleRequestUpload()}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-300 border border-emerald-400/35 cursor-pointer"
              >
                <CloudUpload className="w-3 h-3" />
                <span>Upload Local</span>
              </button>
              {cloudMeta && (
                <button
                  type="button"
                  data-testid="cloud-delete-btn"
                  disabled={cloudBusy !== null}
                  onClick={() =>
                    setPendingConfirm({
                      kind: 'cloud_delete',
                      provider: account.provider,
                      cloudMeta,
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-rose-950/60 hover:bg-rose-900/60 disabled:opacity-50 text-rose-300 border border-rose-500/30 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Cloud</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {playGamesAvailable && (
                <button
                  type="button"
                  data-testid="cloud-signin-playgames-btn"
                  disabled={cloudBusy !== null}
                  onClick={() => void handleSignIn('play_games')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Sign in with Google Play Games</span>
                </button>
              )}

              {googleDriveConfigured && (
                <button
                  type="button"
                  data-testid="cloud-signin-google-btn"
                  disabled={cloudBusy !== null}
                  onClick={() => void handleSignIn('google_drive')}
                  className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>

            {googleDriveConfigured ? (
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Stores only <span className="font-mono text-zinc-300">{DRIVE_SAVE_FILE_NAME}</span>{' '}
                in your own Google Drive with minimal file-only permission. Access tokens stay strictly
                in memory and clear on sign-out.
                {!playGamesAvailable &&
                  ' Native Google Play Games sync also activates automatically inside the Android Play Store build.'}
              </p>
            ) : !playGamesAvailable ? (
              <div
                data-testid="cloud-sync-status-note"
                className="text-[10px] text-zinc-400 bg-zinc-900/75 border border-white/8 rounded-lg px-2.5 py-2 leading-relaxed"
              >
                <span className="text-zinc-200 font-medium">Offline-first mode:</span>{' '}
                Use Export/Import JSON above anytime. Direct Google Drive sign-in activates when a
                public <code className="text-sky-300">VITE_GOOGLE_CLIENT_ID</code> is configured,
                and Google Play Games activates automatically inside the native Android Play Store
                build.
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400">
                Android Play Games bridge detected. Sign in to sync snapshots directly to your Play
                Games profile.
              </p>
            )}
          </div>
        )}

        {cloudBusy && (
          <div className="text-[10px] font-mono text-sky-300">{cloudBusy}</div>
        )}

        {cloudStatus && (
          <div
            data-testid="cloud-sync-feedback"
            className={`text-[11px] font-mono px-2.5 py-1.5 rounded border ${
              cloudStatus.tone === 'ok'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-400/30'
            }`}
          >
            {cloudStatus.message}
          </div>
        )}
      </div>

      {/* Explicit In-App Side-by-Side Comparison & Destructive Action Confirmation */}
      {pendingConfirm && (
        <div
          data-testid="save-confirm-panel"
          role="dialog"
          aria-label="Confirm Save Action"
          className="p-3 rounded-lg bg-zinc-900 border border-amber-400/45 space-y-2.5"
        >
          {pendingConfirm.kind === 'import_local' && (
            <>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Confirm Local Restore ({pendingConfirm.sourceLabel})
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {pendingConfirm.comparison.reason}
                    {pendingConfirm.warningsCount > 0
                      ? ` (${pendingConfirm.warningsCount} fields sanitized)`
                      : ''}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SnapshotCard
                  title="This Device"
                  badge={pendingConfirm.comparison.recommendation === 'local' ? 'Newer' : undefined}
                  badgeTone="sky"
                  summary={pendingConfirm.localSummary}
                />
                <SnapshotCard
                  title="Incoming Backup"
                  badge={
                    pendingConfirm.comparison.recommendation === 'remote' ? 'Recommended' : undefined
                  }
                  badgeTone="emerald"
                  summary={pendingConfirm.incomingSummary}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  data-testid="save-confirm-cancel-btn"
                  onClick={() => setPendingConfirm(null)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="save-confirm-restore-btn"
                  onClick={() => {
                    const ok = onApplyImportedSaveBundle(pendingConfirm.rawJson);
                    if (ok) {
                      setPendingConfirm(null);
                    }
                  }}
                  className="px-3 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/45 cursor-pointer"
                >
                  Restore Backup
                </button>
              </div>
            </>
          )}

          {pendingConfirm.kind === 'cloud_conflict' && (
            <>
              <div className="flex items-start gap-2">
                <CloudDownload className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    Compare Local vs {providerTitle}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {pendingConfirm.comparison.reason} Choose which save to keep.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SnapshotCard
                  title="This Device"
                  badge={
                    pendingConfirm.comparison.recommendation === 'local' ? 'Recommended' : undefined
                  }
                  badgeTone="sky"
                  summary={pendingConfirm.localSummary}
                />
                <SnapshotCard
                  title={providerTitle}
                  badge={
                    pendingConfirm.comparison.recommendation === 'remote'
                      ? 'Recommended'
                      : undefined
                  }
                  badgeTone="emerald"
                  summary={pendingConfirm.cloudSummary}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  data-testid="save-confirm-cancel-btn"
                  onClick={() => setPendingConfirm(null)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="cloud-confirm-keep-local-btn"
                  disabled={cloudBusy !== null}
                  onClick={() =>
                    void executeCloudUpload(
                      pendingConfirm.provider,
                      pendingConfirm.cloudMeta.fileId
                    )
                  }
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 cursor-pointer"
                >
                  Overwrite Cloud with Local
                </button>
                <button
                  type="button"
                  data-testid="cloud-confirm-keep-cloud-btn"
                  disabled={cloudBusy !== null}
                  onClick={() => {
                    const ok = onApplyImportedSaveBundle(pendingConfirm.cloudRawJson);
                    if (ok) {
                      setPendingConfirm(null);
                      setCloudStatus({
                        tone: 'ok',
                        message: `Restored save from ${providerTitle}.`,
                      });
                    }
                  }}
                  className="px-3 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/45 cursor-pointer"
                >
                  Use Cloud Save
                </button>
              </div>
            </>
          )}

          {pendingConfirm.kind === 'cloud_overwrite' && (
            <>
              <div className="flex items-start gap-2">
                <CloudUpload className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-zinc-100">
                    {pendingConfirm.existingCloudMeta
                      ? `Overwrite Existing ${providerTitle} Backup?`
                      : `Upload First Backup to ${providerTitle}?`}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {pendingConfirm.existingCloudMeta
                      ? 'This will replace your previous cloud backup with this device save.'
                      : 'No cloud backup found yet. Upload this device save now.'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SnapshotCard title="This Device (Will Upload)" badge="Upload" badgeTone="sky" summary={pendingConfirm.localSummary} />
                {pendingConfirm.cloudSummary && (
                  <SnapshotCard
                    title={`Existing ${providerTitle}`}
                    badge="Will Replace"
                    summary={pendingConfirm.cloudSummary}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  data-testid="save-confirm-cancel-btn"
                  onClick={() => setPendingConfirm(null)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="cloud-confirm-upload-btn"
                  disabled={cloudBusy !== null}
                  onClick={() =>
                    void executeCloudUpload(
                      pendingConfirm.provider,
                      pendingConfirm.existingCloudMeta?.fileId
                    )
                  }
                  className="px-3 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/45 cursor-pointer"
                >
                  Confirm Upload
                </button>
              </div>
            </>
          )}

          {pendingConfirm.kind === 'cloud_delete' && (
            <>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-rose-200">
                    Delete {providerTitle} Backup?
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Removes {pendingConfirm.cloudMeta.fileName} from your cloud account. Your local
                    save on this device will remain untouched.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  data-testid="save-confirm-cancel-btn"
                  onClick={() => setPendingConfirm(null)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="cloud-confirm-delete-btn"
                  disabled={cloudBusy !== null}
                  onClick={() =>
                    void executeCloudDelete(pendingConfirm.provider, pendingConfirm.cloudMeta)
                  }
                  className="px-3 py-1 rounded text-[11px] font-mono font-semibold bg-rose-600/35 hover:bg-rose-600/50 text-rose-200 border border-rose-400/50 cursor-pointer"
                >
                  Delete Cloud Backup
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
