import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface CapyWebGlContextBannerProps {
  isContextLost: boolean;
  onReloadScene: () => void;
}

export const CapyWebGlContextBanner: React.FC<CapyWebGlContextBannerProps> = ({
  isContextLost,
  onReloadScene,
}) => {
  if (!isContextLost) return null;
  return (
    <div
      data-testid="webgl-context-lost-banner"
      role="status"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/92 p-4 text-zinc-100"
    >
      <div className="max-w-sm w-full rounded-xl border border-amber-400/35 bg-zinc-900/95 p-5 shadow-2xl space-y-3 text-center">
        <div className="text-sm font-semibold tracking-wide text-amber-300">
          3D Graphics Context Paused
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Your device temporarily reclaimed the WebGL2 graphics context. Waiting for automatic
          restoration, or reload the viewport below.
        </p>
        <button
          type="button"
          onClick={onReloadScene}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Restore Viewport</span>
        </button>
      </div>
    </div>
  );
};
