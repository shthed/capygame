import React from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Settings as SettingsIcon,
  Shield,
  X,
} from 'lucide-react';
import { formatAppVersionLabel } from '../config/appVersion';
import {
  CAPYGAME_OVERVIEW_COPY,
  CAPYGAME_TUTORIALS,
  CapyTutorial,
} from '../engine/TutorialCatalog';
import { AudioService } from '../services/AudioService';

export interface CapyAboutModalProps {
  onClose: () => void;
  onStartTutorial: (tutorial: CapyTutorial) => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
}

export const CapyAboutModal: React.FC<CapyAboutModalProps> = ({
  onClose,
  onStartTutorial,
  onOpenSettings,
  onOpenPrivacy,
}) => {
  return (
    <div
      data-testid="capygame-about-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-zinc-950/85"
    >
      <div className="relative w-full max-w-2xl max-h-[88vh] sm:max-h-[85vh] bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100 flex flex-col">
        <div className="bg-zinc-950 px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold tracking-wide text-zinc-100">
                {CAPYGAME_OVERVIEW_COPY.heading}
              </h2>
              <span
                data-testid="about-version-label"
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-400/35"
              >
                {formatAppVersionLabel()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {CAPYGAME_OVERVIEW_COPY.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
            aria-label="Close About CapyGame Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="p-3.5 rounded-lg bg-zinc-950/80 border border-white/10 space-y-2">
            <p className="text-xs sm:text-[13px] text-zinc-200 leading-relaxed">
              {CAPYGAME_OVERVIEW_COPY.summary}
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-white/8 pt-2">
              <span className="text-zinc-300 font-medium">Quick Controls:</span>{' '}
              {CAPYGAME_OVERVIEW_COPY.controlsSummary}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Interactive Tutorials</span>
              </h3>
              <span className="text-[11px] text-zinc-400">Pick a guide to jump right in</span>
            </div>
            <div
              data-testid="about-tutorials-list"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {CAPYGAME_TUTORIALS.map((tut) => (
                <button
                  key={tut.id}
                  type="button"
                  data-testid={`start-tutorial-${tut.id}`}
                  onClick={() => onStartTutorial(tut)}
                  className="flex flex-col justify-between p-3 rounded-lg bg-zinc-950/85 border border-white/10 hover:border-amber-400/50 hover:bg-zinc-950 text-left transition-colors cursor-pointer gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-100">
                        {tut.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30 shrink-0">
                        {tut.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {tut.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/8">
                    <span className="text-zinc-500 font-mono">{tut.durationLabel}</span>
                    <span className="text-sky-300 font-medium inline-flex items-center gap-0.5">
                      <span>Start Tutorial</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-zinc-950 px-4 sm:px-5 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="about-open-settings-btn"
              onClick={() => {
                AudioService.playCoin();
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              data-testid="open-privacy-policy-btn"
              onClick={() => {
                AudioService.playCoin();
                onOpenPrivacy();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Privacy Policy</span>
            </button>
          </div>
          <button
            type="button"
            data-testid="close-about-btn"
            onClick={() => {
              AudioService.playCoin();
              onClose();
            }}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Resume Game</span>
          </button>
        </div>
      </div>
    </div>
  );
};
