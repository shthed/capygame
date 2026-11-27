export type HapticType = 'tick' | 'success' | 'warning' | 'error';

export interface PlayGamesPlayerProfile {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface PlayGamesSnapshotPayload {
  data: string;
  updatedAtMs: number;
  description?: string;
}

export interface PlayGamesNativePlugin {
  signIn: () => Promise<PlayGamesPlayerProfile | null>;
  signOut?: () => Promise<void>;
  getCurrentPlayer?: () => Promise<PlayGamesPlayerProfile | null>;
  loadSavedGame: (slotName: string) => Promise<PlayGamesSnapshotPayload | null>;
  saveGame: (
    slotName: string,
    data: string,
    description: string
  ) => Promise<{ updatedAtMs: number }>;
  deleteSavedGame?: (slotName: string) => Promise<void>;
}

interface CapacitorAppPlugin {
  addListener?: (
    eventName: 'backButton',
    listenerFunc: (event: { canGoBack?: boolean }) => void
  ) => { remove?: () => void } | Promise<{ remove?: () => void }>;
}

declare global {
  interface Window {
    __capyCloseModal?: () => boolean;
    CapyPlayGamesBridge?: PlayGamesNativePlugin;
    Capacitor?: {
      Plugins?: {
        App?: CapacitorAppPlugin;
        PlayGames?: PlayGamesNativePlugin;
      };
    };
  }
}

const BACK_SENTINEL_KEY = '__capyModalSentinel';

class NativeBridgeService {
  private modalCloseHandler: (() => void) | null = null;
  private hasHistorySentinel: boolean = false;
  private ignoreNextPopstate: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.__capyCloseModal = () => this.dismissOpenModal();

      // Android TWA / PWA hardware Back button intercepts the lightweight
      // history sentinel pushed when a modal/drawer opens so Back closes
      // overlays cleanly before ever exiting the app.
      window.addEventListener('popstate', this.handlePopState);

      // Optional Capacitor Android WebView hardware Back hook when packaged natively
      try {
        window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => {
          this.dismissOpenModal();
        });
      } catch {
        // Ignore when running outside Capacitor
      }
    }
  }

  private handlePopState = (): void => {
    if (this.ignoreNextPopstate) {
      this.ignoreNextPopstate = false;
      return;
    }
    if (!this.hasHistorySentinel) return;
    this.hasHistorySentinel = false;
    const handler = this.modalCloseHandler;
    this.modalCloseHandler = null;
    if (handler) {
      handler();
    }
  };

  /**
   * Dismisses the currently active modal/drawer if one is registered.
   * Returns true if a modal was closed, false otherwise.
   */
  public dismissOpenModal(): boolean {
    const handler = this.modalCloseHandler;
    if (!handler) return false;
    this.modalCloseHandler = null;
    this.popHistorySentinelSilently();
    handler();
    return true;
  }

  private pushHistorySentinel(): void {
    if (this.hasHistorySentinel || typeof window === 'undefined') return;
    try {
      const currentState =
        window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {};
      if (!(currentState as Record<string, unknown>)[BACK_SENTINEL_KEY]) {
        window.history.pushState(
          { ...currentState, [BACK_SENTINEL_KEY]: true },
          '',
          window.location.href
        );
      }
      this.hasHistorySentinel = true;
    } catch {
      // Ignore restricted history APIs (e.g. sandboxed iframes)
    }
  }

  private popHistorySentinelSilently(): void {
    if (!this.hasHistorySentinel || typeof window === 'undefined') return;
    this.hasHistorySentinel = false;
    try {
      const state = window.history.state as Record<string, unknown> | null;
      if (state && state[BACK_SENTINEL_KEY]) {
        this.ignoreNextPopstate = true;
        window.history.back();
      }
    } catch {
      this.ignoreNextPopstate = false;
    }
  }

  haptic(type: HapticType = 'tick', enabled: boolean = true): void {
    if (!enabled || typeof window === 'undefined') return;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        switch (type) {
          case 'tick':
            navigator.vibrate(8);
            break;
          case 'success':
            navigator.vibrate([15, 40, 25]);
            break;
          case 'warning':
            navigator.vibrate(20);
            break;
          case 'error':
            navigator.vibrate([30, 50, 30]);
            break;
        }
      }
    } catch {
      // Ignore haptic errors on unsupported devices
    }
  }

  setBackModalOpen(isOpen: boolean, onClose?: () => void): void {
    if (isOpen && onClose) {
      this.modalCloseHandler = onClose;
      this.pushHistorySentinel();
    } else {
      this.modalCloseHandler = null;
      this.popHistorySentinelSilently();
    }
  }

  /**
   * Exposed for deterministic unit testing of sentinel state transitions.
   */
  public hasActiveBackSentinel(): boolean {
    return this.hasHistorySentinel;
  }
}

export const NativeBridge = new NativeBridgeService();
