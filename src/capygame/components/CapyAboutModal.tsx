import React from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Settings as SettingsIcon,
  Shield,
  X,
} from 'lucide-react';
import { formatAppVersionLabel } from '../config/appVersion';
import {
  ActiveTutorialState,
  CAPYGAME_OVERVIEW_COPY,
  CAPYGAME_TUTORIALS,
  CapyTutorial,
  clampTutorialStepIndex,
  getTutorialById,
  stepTutorialState,
} from '../engine/TutorialCatalog';
import { AudioService } from '../services/AudioService';

export interface CapyAboutModalProps {
  onClose: () => void;
  onStartTutorial: (tutorial: CapyTutorial) => void;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const CapyAboutModal: React.FC<CapyAboutModalProps> = ({
  onClose,
  onStartTutorial,
  onOpenSettings,
  onOpenFeedback,
  onOpenPrivacy,
  onOpenTerms,
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
                AudioService.playUiClick('tap');
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              data-testid="open-feedback-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                onOpenFeedback();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
              <span>Send Feedback</span>
            </button>
            <button
              type="button"
              data-testid="open-privacy-policy-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                onOpenPrivacy();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Privacy Policy</span>
            </button>
            <button
              type="button"
              data-testid="open-terms-of-service-btn"
              onClick={() => {
                AudioService.playUiClick('tap');
                onOpenTerms();
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs px-3 py-2 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>Terms of Service</span>
            </button>
          </div>
          <button
            type="button"
            data-testid="close-about-btn"
            onClick={() => {
              AudioService.playUiClick('tap');
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

export interface CapyPrivacyModalProps {
  onClose: () => void;
}

export const CapyPrivacyModal: React.FC<CapyPrivacyModalProps> = ({ onClose }) => (
  <div
    data-testid="privacy-policy-modal"
    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/90"
  >
    <div className="relative w-full max-w-2xl bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
      <div className="bg-zinc-950 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-100">
              CapyGame · Privacy Policy
            </h2>
            <p className="text-[11px] font-mono text-zinc-400">
              100% On-Device Saves · Zero Tracking SDKs
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="close-privacy-policy-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
          aria-label="Close Privacy Policy"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 bg-zinc-950 flex-1 min-h-0">
        <iframe
          src="./privacy.html"
          title="CapyGame Privacy Policy"
          className="w-full h-[64vh] rounded-lg border border-white/10 bg-zinc-950"
        />
      </div>
    </div>
  </div>
);

export interface CapyTermsModalProps {
  onClose: () => void;
}

export const CapyTermsModal: React.FC<CapyTermsModalProps> = ({ onClose }) => (
  <div
    data-testid="terms-of-service-modal"
    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/90"
  >
    <div className="relative w-full max-w-2xl bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
      <div className="bg-zinc-950 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-100">
              CapyGame · Terms of Service
            </h2>
            <p className="text-[11px] font-mono text-zinc-400">
              Free Client-Side Game · Player-Owned Saves
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="close-terms-of-service-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer"
          aria-label="Close Terms of Service"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 bg-zinc-950 flex-1 min-h-0">
        <iframe
          src="./terms.html"
          title="CapyGame Terms of Service"
          className="w-full h-[64vh] rounded-lg border border-white/10 bg-zinc-950"
        />
      </div>
    </div>
  </div>
);

export interface CapyTutorialBannerProps {
  activeTutorial: ActiveTutorialState;
  isFirstRunSetupOpen: boolean;
  onClose: () => void;
  onOpenAllTutorials: () => void;
  onStepChange: (next: ActiveTutorialState | null, finishedTitle?: string) => void;
}

export const CapyTutorialBanner: React.FC<CapyTutorialBannerProps> = ({
  activeTutorial,
  isFirstRunSetupOpen,
  onClose,
  onOpenAllTutorials,
  onStepChange,
}) => {
  const tutorial = getTutorialById(activeTutorial.tutorialId);
  if (!tutorial || tutorial.steps.length === 0) return null;
  const stepIndex = clampTutorialStepIndex(tutorial, activeTutorial.stepIndex);
  const step = tutorial.steps[stepIndex];
  const isLastStep = stepIndex >= tutorial.steps.length - 1;
  const dockClass = isFirstRunSetupOpen
    ? 'top-12 left-2 right-2 sm:left-[396px] sm:right-auto sm:w-[400px]'
    : 'top-12 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[460px]';
  return (
    <aside
      data-testid="active-tutorial-banner"
      aria-label={`${tutorial.title} Step ${stepIndex + 1} of ${tutorial.steps.length}`}
      className={`fixed z-30 pointer-events-auto rounded-xl bg-zinc-950/95 border border-amber-400/45 shadow-2xl p-3 text-zinc-100 space-y-2 ${dockClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/35 shrink-0">
            Step {stepIndex + 1}/{tutorial.steps.length}
          </span>
          <span className="text-xs font-semibold text-zinc-100 truncate">
            {tutorial.title}
          </span>
        </div>
        <button
          type="button"
          data-testid="tutorial-close-btn"
          onClick={onClose}
          aria-label="Close Tutorial"
          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-white/10 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-amber-200">{step.title}</div>
        <p className="text-[11px] sm:text-xs text-zinc-300 leading-relaxed">
          {step.instruction}
        </p>
      </div>

      <div className="pt-1.5 border-t border-white/10 space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-2">
        <span className="block text-[10px] font-mono text-sky-300">
          {step.controlHint}
        </span>
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="tutorial-all-btn"
            onClick={() => {
              AudioService.playCoin();
              onOpenAllTutorials();
            }}
            className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 cursor-pointer"
          >
            All Tutorials
          </button>
          <button
            type="button"
            data-testid="tutorial-prev-btn"
            disabled={stepIndex === 0}
            onClick={() => {
              AudioService.playCoin();
              onStepChange(stepTutorialState(activeTutorial, -1));
            }}
            className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-200 border border-white/10 inline-flex items-center gap-0.5 cursor-pointer"
          >
            <ChevronLeft className="w-3 h-3" />
            <span>Prev</span>
          </button>
          <button
            type="button"
            data-testid="tutorial-next-btn"
            onClick={() => {
              AudioService.playCoin();
              const next = stepTutorialState(activeTutorial, 1);
              onStepChange(next, next ? undefined : tutorial.title);
            }}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 inline-flex items-center gap-0.5 cursor-pointer"
          >
            <span>{isLastStep ? 'Finish' : 'Next'}</span>
            {!isLastStep && <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </aside>
  );
};

