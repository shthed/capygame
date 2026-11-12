export type HapticType = 'tick' | 'success' | 'warning' | 'error';

declare global {
  interface Window {
    __capyCloseModal?: () => boolean;
  }
}

class NativeBridgeService {
  private modalCloseHandler: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.__capyCloseModal = () => {
        if (this.modalCloseHandler) {
          this.modalCloseHandler();
          return true;
        }
        return false;
      };
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
    this.modalCloseHandler = isOpen && onClose ? onClose : null;
  }
}

export const NativeBridge = new NativeBridgeService();
