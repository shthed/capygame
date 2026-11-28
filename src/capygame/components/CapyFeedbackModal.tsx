import React, { useState } from 'react';
import { ExternalLink, MessageSquare, X } from 'lucide-react';
import { AudioService } from '../services/AudioService';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_DETAILS_CHARS,
  FEEDBACK_MAX_TITLE_CHARS,
  FeedbackCategory,
  FeedbackSubmitResult,
  PUBLIC_ISSUES_URL,
  submitAnonymousFeedback,
} from '../services/FeedbackService';

export interface CapyFeedbackModalProps {
  activeMode?: string;
  onClose: () => void;
}

export const CapyFeedbackModal: React.FC<CapyFeedbackModalProps> = ({ activeMode, onClose }) => {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FeedbackSubmitResult | null>(null);

  const activeCategoryMeta =
    FEEDBACK_CATEGORIES.find((entry) => entry.id === category) ?? FEEDBACK_CATEGORIES[0];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    AudioService.playUiClick('tap');
    setSubmitting(true);
    setResult(null);

    const submitResult = await submitAnonymousFeedback(
      {
        category,
        title,
        details,
        website: honeypot,
      },
      { activeMode }
    );

    setResult(submitResult);
    if (submitResult.ok) {
      setTitle('');
      setDetails('');
      setHoneypot('');
    }
    setSubmitting(false);
  };

  return (
    <div
      data-testid="capygame-feedback-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-zinc-950/90"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] bg-zinc-900 rounded-xl shadow-2xl border border-white/15 overflow-hidden text-zinc-100 flex flex-col">
        <div className="bg-zinc-950 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-100">
                Send Anonymous Feedback
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                Opens an anonymous issue on capyboop/capygame
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-feedback-modal-btn"
            onClick={() => {
              AudioService.playUiClick('tap');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/10 cursor-pointer shrink-0"
            aria-label="Close Feedback Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          data-testid="in-game-feedback-card"
          onSubmit={handleSubmit}
          noValidate
          className="p-4 space-y-3.5 overflow-y-auto flex-1 min-h-0"
        >
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            No GitHub account required. Only your message, app version, active mode, and platform
            are included — please avoid posting personal information.
          </p>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Feedback category">
            {FEEDBACK_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`feedback-category-${cat.id}`}
                  aria-pressed={active}
                  onClick={() => {
                    AudioService.playUiClick('select');
                    setCategory(cat.id);
                    setResult(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <div className="space-y-1">
            <label
              htmlFor="capygame-feedback-title"
              className="block text-[11px] font-semibold text-zinc-300"
            >
              Title
            </label>
            <input
              id="capygame-feedback-title"
              type="text"
              data-testid="feedback-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={FEEDBACK_MAX_TITLE_CHARS}
              placeholder={activeCategoryMeta.titlePlaceholder}
              className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-white/15 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 select-text"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="capygame-feedback-details"
                className="block text-[11px] font-semibold text-zinc-300"
              >
                Details
              </label>
              <span
                data-testid="feedback-details-counter"
                className="text-[10px] font-mono text-zinc-400 tabular-nums"
              >
                {details.length}/{FEEDBACK_MAX_DETAILS_CHARS}
              </span>
            </div>
            <textarea
              id="capygame-feedback-details"
              data-testid="feedback-details-input"
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={FEEDBACK_MAX_DETAILS_CHARS}
              placeholder={activeCategoryMeta.detailsPlaceholder}
              className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-white/15 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 resize-y select-text"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="submit"
              data-testid="feedback-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs font-bold shadow transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{submitting ? 'Sending...' : 'Submit Feedback'}</span>
            </button>
            <a
              href={PUBLIC_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              <span>Browse capyboop/capygame Issues</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {result && (
            <div
              data-testid="feedback-status-banner"
              role="status"
              className={`p-3 rounded-lg border text-xs space-y-1.5 select-text ${
                result.ok
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              }`}
            >
              {result.ok ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Thanks! Your anonymous feedback was submitted
                    {result.issueNumber ? ` as issue #${result.issueNumber}` : ''}.
                  </span>
                  {result.issueUrl && (
                    <a
                      href={result.issueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="feedback-issue-link"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                    >
                      <span>
                        {result.issueNumber
                          ? `View Issue #${result.issueNumber}`
                          : 'View Issue on GitHub'}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div>{result.error}</div>
                  <a
                    href={result.fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="feedback-fallback-link"
                    className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2"
                  >
                    <span>Open prefilled GitHub form</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
