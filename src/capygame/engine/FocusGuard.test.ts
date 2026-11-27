import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canProcessGameKeyboardEvent,
  canRequestProgrammaticFocus,
  detectEmbeddedIframe,
  isEditableKeyboardTarget,
  readDocumentFocusState,
  resolveSuspensionMode,
  shouldAutoSuspendBackgroundLoop,
  shouldCapturePointerOnCanvasDown,
  shouldRunDeferredSearchFocus,
  shouldUseHistoryBackSentinel,
  shouldUseNativePointerLock,
} from './FocusGuard';

test('detectEmbeddedIframe handles top-level, iframe, and cross-origin SecurityError', () => {
  const sameWin = {};
  assert.equal(detectEmbeddedIframe({ self: sameWin, top: sameWin }), false);
  assert.equal(detectEmbeddedIframe({ self: {}, top: {} }), true);
  const crossOriginWin = {
    self: {},
    get top() {
      throw new Error('SecurityError: Blocked a frame with origin');
    },
  };
  assert.equal(detectEmbeddedIframe(crossOriginWin), true);
  assert.equal(detectEmbeddedIframe(null), false);
});

test('isEditableKeyboardTarget detects inputs, textareas, selects, contentEditable, and ARIA textboxes', () => {
  assert.equal(isEditableKeyboardTarget({ tagName: 'INPUT' }), true);
  assert.equal(isEditableKeyboardTarget({ tagName: 'textarea' }), true);
  assert.equal(isEditableKeyboardTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableKeyboardTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(
    isEditableKeyboardTarget({
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'contenteditable' ? '' : null),
    }),
    true
  );
  assert.equal(
    isEditableKeyboardTarget({
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'contenteditable' ? 'false' : null),
    }),
    false
  );
  assert.equal(
    isEditableKeyboardTarget({
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'role' ? 'textbox' : null),
    }),
    true
  );
  assert.equal(
    isEditableKeyboardTarget({
      tagName: 'SPAN',
      closest: () => ({ tagName: 'DIV' }),
    }),
    true
  );
  assert.equal(isEditableKeyboardTarget({ tagName: 'CANVAS' }), false);
  assert.equal(isEditableKeyboardTarget({ tagName: 'BODY' }), false);
  assert.equal(isEditableKeyboardTarget(null), false);
});

test('canRequestProgrammaticFocus blocks focus requests whenever window is blurred or hidden', () => {
  assert.equal(
    canRequestProgrammaticFocus({
      hasWindowFocus: true,
      documentHasFocus: true,
      visibilityState: 'visible',
    }),
    true
  );
  assert.equal(
    canRequestProgrammaticFocus({
      hasWindowFocus: false,
      documentHasFocus: true,
      visibilityState: 'visible',
    }),
    false
  );
  assert.equal(
    canRequestProgrammaticFocus({
      hasWindowFocus: true,
      documentHasFocus: false,
      visibilityState: 'visible',
    }),
    false
  );
  assert.equal(
    canRequestProgrammaticFocus({
      hasWindowFocus: true,
      documentHasFocus: true,
      visibilityState: 'hidden',
    }),
    false
  );
});

test('canProcessGameKeyboardEvent blocks hotkeys in background or inside editable controls', () => {
  assert.equal(
    canProcessGameKeyboardEvent({
      hasWindowFocus: true,
      documentHasFocus: true,
      visibilityState: 'visible',
      target: { tagName: 'BODY' },
    }),
    true
  );
  assert.equal(
    canProcessGameKeyboardEvent({
      hasWindowFocus: false,
      documentHasFocus: false,
      visibilityState: 'visible',
      target: { tagName: 'BODY' },
    }),
    false
  );
  assert.equal(
    canProcessGameKeyboardEvent({
      hasWindowFocus: true,
      documentHasFocus: true,
      visibilityState: 'visible',
      target: { tagName: 'TEXTAREA' },
    }),
    false
  );
});

test('shouldRunDeferredSearchFocus fires only once per nonce increment and only while focused', () => {
  const focused = { hasWindowFocus: true, documentHasFocus: true, visibilityState: 'visible' };
  const blurred = { hasWindowFocus: false, documentHasFocus: false, visibilityState: 'visible' };

  assert.equal(shouldRunDeferredSearchFocus(0, 0, focused), false);
  assert.equal(shouldRunDeferredSearchFocus(1, 0, focused), true);
  assert.equal(shouldRunDeferredSearchFocus(1, 1, focused), false);
  assert.equal(shouldRunDeferredSearchFocus(2, 1, blurred), false);
  assert.equal(shouldRunDeferredSearchFocus(2, 1, focused), true);
});

test('shouldAutoSuspendBackgroundLoop renders initial preview frame then suspends unfocused iframes', () => {
  // Unfocused embedded iframe: allow Frame 1 to paint cleanly
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: true,
      isWindowFocused: false,
      firstFrameRendered: false,
    }),
    false
  );
  // Once Frame 1 painted in an unfocused embedded iframe: suspend cleanly
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: true,
      isWindowFocused: false,
      firstFrameRendered: true,
    }),
    true
  );
  // Focused embedded iframe: actively running
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: true,
      isWindowFocused: true,
      firstFrameRendered: true,
    }),
    false
  );
  // Top-level standalone tab visible: stays alive even if unfocused, pauses if hidden
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: false,
      isWindowFocused: false,
      firstFrameRendered: true,
    }),
    false
  );
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: false,
      isDocumentHidden: true,
      isEmbeddedIframe: false,
      isWindowFocused: true,
      firstFrameRendered: true,
    }),
    true
  );
  // Manual pause always suspends
  assert.equal(
    shouldAutoSuspendBackgroundLoop({
      isManuallyPaused: true,
      isDocumentHidden: false,
      isEmbeddedIframe: false,
      isWindowFocused: true,
      firstFrameRendered: true,
    }),
    true
  );
});

test('readDocumentFocusState safely reads document focus and visibility', () => {
  assert.deepEqual(
    readDocumentFocusState({ hasFocus: () => false, visibilityState: 'visible' }),
    { documentHasFocus: false, visibilityState: 'visible' }
  );
  assert.deepEqual(
    readDocumentFocusState({
      hasFocus: () => {
        throw new Error('restricted');
      },
      visibilityState: 'hidden',
    }),
    { documentHasFocus: false, visibilityState: 'hidden' }
  );
});

test('resolveSuspensionMode distinguishes soft iframe blur from deep manual/hidden pause', () => {
  // Unfocused embedded iframe after Frame 1 -> soft pause (keeps GPU FBOs & physics warm)
  assert.equal(
    resolveSuspensionMode({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: true,
      isWindowFocused: false,
      firstFrameRendered: true,
    }),
    'soft'
  );
  // Hidden document -> deep pause (releases GPU FBOs & worker)
  assert.equal(
    resolveSuspensionMode({
      isManuallyPaused: false,
      isDocumentHidden: true,
      isEmbeddedIframe: true,
      isWindowFocused: false,
      firstFrameRendered: true,
    }),
    'deep'
  );
  // Manual pause -> deep pause
  assert.equal(
    resolveSuspensionMode({
      isManuallyPaused: true,
      isDocumentHidden: false,
      isEmbeddedIframe: false,
      isWindowFocused: true,
      firstFrameRendered: true,
    }),
    'deep'
  );
  // Focused embedded iframe -> active ('none')
  assert.equal(
    resolveSuspensionMode({
      isManuallyPaused: false,
      isDocumentHidden: false,
      isEmbeddedIframe: true,
      isWindowFocused: true,
      firstFrameRendered: true,
    }),
    'none'
  );
});

test('embedded iframe guards disable native pointer lock, mouse pointer capture, and history sentinel', () => {
  assert.equal(shouldUseNativePointerLock(true), false);
  assert.equal(shouldUseNativePointerLock(false), true);

  assert.equal(shouldCapturePointerOnCanvasDown(true, 'mouse'), false);
  assert.equal(shouldCapturePointerOnCanvasDown(true, 'touch'), true);
  assert.equal(shouldCapturePointerOnCanvasDown(true, 'pen'), true);
  assert.equal(shouldCapturePointerOnCanvasDown(false, 'mouse'), true);

  assert.equal(shouldUseHistoryBackSentinel(true), false);
  assert.equal(shouldUseHistoryBackSentinel(false), true);
});

