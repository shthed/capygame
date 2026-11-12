// PwaService - Progressive Web App Lifecycle, Service Worker Registration & Install Prompt Management

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaListener = () => void;

class PwaServiceClass {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private listeners: Set<PwaListener> = new Set();
  private registration: ServiceWorkerRegistration | null = null;
  private hasUpdate = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    try {
      // 1. Listen for the browser install prompt event
      window.addEventListener('beforeinstallprompt', (e: Event) => {
        // Prevent automatic mini-infobar on mobile Chrome
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.notifyListeners();
      });

      // 2. Listen for successful installation
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.notifyListeners();
      });

      // 3. Register Service Worker (web environment only, bypassing native Android wrapper & Cloud Run preview proxy)
      let swSupported = false;
      try {
        swSupported = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker);
      } catch {
        swSupported = false;
      }

      const host = window.location.hostname || '';
      const isCloudRunPreview = host.endsWith('.run.app');
      if (isCloudRunPreview) {
        try {
          sessionStorage.removeItem('warmup_start_time');
          sessionStorage.removeItem('warmup_failed_sent');
        } catch {
          // Ignore storage restrictions
        }
        if (swSupported) {
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => Promise.allSettled(regs.map((r) => r.unregister())))
            .catch(() => {});
        }
        return;
      }

      if (swSupported) {
        if (document.readyState === 'complete') {
          this.registerServiceWorker();
        } else {
          window.addEventListener('load', () => {
            this.registerServiceWorker();
          });
        }
      }
    } catch (err) {
      console.warn('[PWA] Initialization skipped due to restricted browser context:', err);
    }
  }

  private async registerServiceWorker() {
    try {
      // Relative registration maintains invariance across GitHub Pages root, PR previews, and local dev
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      this.registration = reg;

      // Cache currently active DOM scripts and stylesheets for immediate offline readiness (skipping @vite/client)
      if ('caches' in window) {
        try {
          const cache = await caches.open('capy-cache-v1');
          const urls: string[] = [];
          document.querySelectorAll('script[src], link[rel="stylesheet"]').forEach((el) => {
            const src = 'src' in el ? (el as HTMLScriptElement).src : (el as HTMLLinkElement).href;
            if (
              src &&
              src.startsWith(window.location.origin) &&
              !src.includes('/@vite/') &&
              !src.includes('/@fs/')
            ) {
              urls.push(src);
            }
          });
          await Promise.allSettled(urls.map((u) => cache.add(u)));
        } catch {
          // Ignored
        }
      }

      // Handle updates found
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          try {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.hasUpdate = true;
              this.notifyListeners();
            }
          } catch {
            // Ignored
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] Service worker registration error:', err);
    }
  }

  public get isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  public get isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    } catch {
      return false;
    }
  }

  public get isUpdateAvailable(): boolean {
    return this.hasUpdate;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.notifyListeners();
      return choice.outcome === 'accepted';
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
      this.deferredPrompt = null;
      this.notifyListeners();
      return false;
    }
  }

  public applyUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  public subscribe(listener: PwaListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[PWA] Listener notification failed:', err);
      }
    });
  }
}

export const PwaService = new PwaServiceClass();
