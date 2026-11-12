import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorTitle: string;
  errorMessage: string;
  errorDetails: string;
}

function classifyError(err: unknown): { title: string; message: string; details: string } {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err) || 'Unknown runtime error';
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
    title: 'Unable to Load CapyGame 3D',
    message:
      'An unexpected runtime error prevented the 3D simulation from rendering cleanly. Use the recovery actions below to reload.',
    details: stack,
  };
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
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
      };
    } else {
      this.state = {
        hasError: false,
        errorTitle: '',
        errorMessage: '',
        errorDetails: '',
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
        });
      };
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__capyShowError) {
      delete (window as unknown as Record<string, unknown>).__capyShowError;
    }
  }

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

  private handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      }
    } catch {
      // Ignored
    }

    try {
      if ('caches' in window && window.caches) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 text-slate-100 overflow-y-auto"
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Technical Error Details
            </div>
            <pre
              data-testid="app-error-message"
              className="text-xs font-mono text-rose-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
            >
              {this.state.errorDetails || 'Unknown error'}
            </pre>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-testid="error-reload-btn"
              onClick={this.handleReload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg transition-all active:scale-95"
            >
              <RefreshCw size={16} />
              <span>Reload Application</span>
            </button>

            <button
              type="button"
              data-testid="error-clear-cache-btn"
              onClick={this.handleClearCacheAndReload}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition-all active:scale-95"
            >
              <Trash2 size={14} />
              <span>Clear Offline Cache & Reload</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
