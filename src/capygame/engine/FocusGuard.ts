// Pure focus & background-lifecycle guard utilities for CapyGame.
// Prevents the game (especially inside an embedded preview iframe) from stealing
// input focus, intercepting keystrokes, or burning CPU/GPU while in the background.

export interface FocusEnvironmentState {
  hasWindowFocus: boolean;
  documentHasFocus: boolean;
  visibilityState: 'visible' | 'hidden' | 'prerender' | string;
}

export interface KeyboardGuardInput extends FocusEnvironmentState {
  target: unknown;
}

export interface BackgroundSuspendInput {
  isManuallyPaused: boolean;
  isDocumentHidden: boolean;
  isEmbeddedIframe: boolean;
  isWindowFocused: boolean;
  firstFrameRendered: boolean;
}

interface EditableElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

const EDITABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox']);

/**
 * Safely detects whether the current window is embedded inside an iframe
 * (including cross-origin iframes where reading window.top throws SecurityError).
 */
export function detectEmbeddedIframe(
  win: { self?: unknown; top?: unknown } | null | undefined = typeof window !== 'undefined'
    ? window
    : undefined
): boolean {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    // Accessing window.top across origins throws SecurityError only inside an iframe
    return true;
  }
}

/**
 * Reads current document visibility and focus state safely across browser and Node test environments.
 */
export function readDocumentFocusState(
  doc: { hasFocus?: () => boolean; visibilityState?: string } | null | undefined = typeof document !==
  'undefined'
    ? document
    : undefined
): { documentHasFocus: boolean; visibilityState: string } {
  if (!doc) {
    return { documentHasFocus: true, visibilityState: 'visible' };
  }
  let documentHasFocus = true;
  try {
    if (typeof doc.hasFocus === 'function') {
      documentHasFocus = Boolean(doc.hasFocus());
    }
  } catch {
    documentHasFocus = false;
  }
  const visibilityState =
    typeof doc.visibilityState === 'string' ? doc.visibilityState : 'visible';
  return { documentHasFocus, visibilityState };
}

/**
 * Returns true if the event target is a text-editable form control, contentEditable host,
 * or ARIA text input where game shortcuts must never hijack keystrokes.
 */
export function isEditableKeyboardTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as EditableElementLike;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (el.isContentEditable === true) {
    return true;
  }
  if (typeof el.getAttribute === 'function') {
    const contentEditableAttr = el.getAttribute('contenteditable');
    if (
      contentEditableAttr !== null &&
      contentEditableAttr.toLowerCase() !== 'false'
    ) {
      return true;
    }
    const role = el.getAttribute('role')?.toLowerCase() ?? '';
    if (EDITABLE_ROLES.has(role)) {
      return true;
    }
  }
  if (typeof el.closest === 'function') {
    try {
      if (
        el.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]'
        )
      ) {
        return true;
      }
    } catch {
      // Ignore selector errors on non-standard targets
    }
  }
  return false;
}

/**
 * Returns true only when the game window is foregrounded and focused,
 * preventing any programmatic `.focus()`, `.select()`, or `requestPointerLock()`
 * from stealing focus from a host page or chat input outside the iframe.
 */
export function canRequestProgrammaticFocus(env: FocusEnvironmentState): boolean {
  if (env.visibilityState !== 'visible') return false;
  return env.hasWindowFocus && env.documentHasFocus;
}

/**
 * Returns true only when game keyboard shortcuts may safely process an event.
 * Blocks all game hotkeys whenever the window is backgrounded/unfocused or when
 * the user is typing inside an editable control.
 */
export function canProcessGameKeyboardEvent(input: KeyboardGuardInput): boolean {
  if (!canRequestProgrammaticFocus(input)) return false;
  if (isEditableKeyboardTarget(input.target)) return false;
  return true;
}

/**
 * Guards deferred search-input `.focus()` effects so they only execute once per
 * explicit nonce increment and never while the game window is unfocused.
 */
export function shouldRunDeferredSearchFocus(
  currentNonce: number,
  lastHandledNonce: number,
  env: FocusEnvironmentState
): boolean {
  if (currentNonce <= 0 || currentNonce === lastHandledNonce) return false;
  return canRequestProgrammaticFocus(env);
}

/**
 * Determines whether the 3D render/physics/audio loop should automatically suspend:
 * - Always suspended when manually paused or tab is hidden.
 * - Inside an embedded iframe (such as an AI Studio live preview), renders the initial
 *   frame cleanly so the preview displays, then auto-suspends whenever the iframe does
 *   not have user focus so background rendering never interferes with typing in the host UI.
 */
export function shouldAutoSuspendBackgroundLoop(input: BackgroundSuspendInput): boolean {
  if (input.isManuallyPaused) return true;
  if (input.isDocumentHidden) return true;
  if (input.isEmbeddedIframe && !input.isWindowFocused && input.firstFrameRendered) {
    return true;
  }
  return false;
}
