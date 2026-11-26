import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Check, Copy, RefreshCw, Trash2 } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorTitle: string;
  errorMessage: string;
  errorDetails: string;
  copied: boolean;
}

export function formatErrorCopyText(title: string, details: string): string {
  const cleanTitle = (title || 'CapyGame Runtime Error').trim();
  const cleanDetails = (details || 'Unknown error').trim();
  return `${cleanTitle}\n\n${cleanDetails}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy textarea copy (needed inside restricted iframes)
  }
  try {
    if (typeof document === 'undefined' || !document.body) return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function safeStringifyError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'Unknown runtime error';
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) || String(err) || 'Unknown runtime error';
  } catch {
    return String(err) || 'Unknown runtime error';
  }
}

export function classifyError(err: unknown): { title: string; message: string; details: string } {
  const rawMessage = safeStringifyError(err);
  const stack = err instanceof Error && err.stack ? err.stack : rawMessage;

  if (/webgl|context|three|shader|gpu/i.test(rawMessage)) {
    return {
      title: '3D Graphics (WebGL) Initialization Error',
      message:
        'Your browser or device GPU could not initialize the 3D WebGL context. Reload to retry hardware or software rendering.',
      details: stack,
    };
  }

  if (/securityerror|localstorage|indexeddb|quota|storage|cookie/i.test(rawMessage)) {
    return {
      title: 'Browser Storage Access Restricted',
      message:
        'Your browser privacy or iframe settings restricted local storage access. Reload to continue with in-memory session state.',
      details: stack,
    };
  }

  if (/fetch|network|dynamically imported module|chunk|loading/i.test(rawMessage)) {
    return {
      title: 'Network or Module Load Interrupted',
      message:
        'A required application script or asset failed to download. Clearing cached scripts and reloading resolves this.',
      details: stack,
    };
  }

  return {
    title: 'Unable to Load CapyGame',
    message:
      'An unexpected runtime error prevented the 3D simulation from rendering cleanly. Use the recovery actions below to reload.',
    details: stack,
  };
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  private copyResetTimer: number | null = null;

  constructor(props: AppErrorBoundaryProps) {
    super(props);

    let simulatedError: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        simulatedError = params.get('simulate_error');
      } catch {
        // Ignored
      }
    }

    if (simulatedError) {
      const classified = classifyError(new Error(simulatedError));
      this.state = {
        hasError: true,
        errorTitle: classified.title,
        errorMessage: classified.message,
        errorDetails: classified.details,
        copied: false,
      };
    } else {
      this.state = {
        hasError: false,
        errorTitle: '',
        errorMessage: '',
        errorDetails: '',
        copied: false,
      };
    }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    const classified = classifyError(error);
    return {
      hasError: true,
      errorTitle: classified.title,
      errorMessage: classified.message,
      errorDetails: classified.details,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  componentDidMount() {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__capyShowError = (err: unknown) => {
        const classified = classifyError(err);
        this.setState({
          hasError: true,
          errorTitle: classified.title,
          errorMessage: classified.message,
          errorDetails: classified.details,
          copied: false,
        });
      };
    }
  }

  componentWillUnmount() {
    if (this.copyResetTimer !== null) {
      window.clearTimeout(this.copyResetTimer);
      this.copyResetTimer = null;
    }
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__capyShowError) {
      delete (window as unknown as Record<string, unknown>).__capyShowError;
    }
  }

  private handleCopyError = async () => {
    const text = formatErrorCopyText(this.state.errorTitle, this.state.errorDetails);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      this.setState({ copied: true });
      if (this.copyResetTimer !== null) {
        window.clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = window.setTimeout(() => {
        this.copyResetTimer = null;
        this.setState({ copied: false });
      }, 2200);
    }
  };

  private handleReload = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('simulate_error');
      url.searchParams.delete('simulate_webgl_error');
      window.location.href = url.toString();
    } catch {
      window.location.reload();
    }
  };

  private clearingCache = false;

  private handleClearCacheAndReload = async () => {
    if (this.clearingCache) return;
    this.clearingCache = true;
    const ownScopeUrl = new URL('./', window.location.href);
    const ownScopeHref = ownScopeUrl.href;
    const ownScopePath = ownScopeUrl.pathname;
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(
          regs.filter((r) => r.scope === ownScopeHref).map((r) => r.unregister())
        );
      }
    } catch {
      // Ignored
    }

    try {
      if ('caches' in window && window.caches) {
        const keys = await caches.keys();
        const ownKeys = keys.filter(
          (k) => k.startsWith('capygame-cache-') && k.endsWith(`:${ownScopePath}`)
        );
        await Promise.allSettled(ownKeys.map((k) => caches.delete(k)));
      }
    } catch {
      // Ignored
    }

    this.handleReload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        data-testid="app-error-boundary"
        role="alert"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 text-slate-100 overflow-y-auto select-text"
      >
        <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Diagnostic Recovery Mode
              </span>
              <h1
                data-testid="app-error-title"
                className="text-lg font-black text-white leading-tight"
              >
                {this.state.errorTitle || 'Something Went Wrong'}
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            {this.state.errorMessage}
          </p>

          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 mb-5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Technical Error Details
              </span>
              <button
                type="button"
                data-testid="error-copy-btn"
                onClick={this.handleCopyError}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors cursor-pointer select-none"
              >
                {this.state.copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Error</span>
                  </>
                )}
              </button>
            </div>
            <pre
              data-testid="app-error-message"
              className="text-xs font-mono text-rose-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto select-text cursor-text"
            >
              {this.state.errorDetails || 'Unknown error'}
            </pre>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-testid="error-reload-btn"
              onClick={this.handleReload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg transition-all active:scale-95 cursor-pointer select-none"
            >
              <RefreshCw size={16} />
              <span>Reload Application</span>
            </button>

            <button
              type="button"
              data-testid="error-clear-cache-btn"
              onClick={this.handleClearCacheAndReload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition-all active:scale-95 cursor-pointer select-none"
            >
              <Trash2 size={14} />
              <span>Clear Offline Cache &amp; Reload</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
