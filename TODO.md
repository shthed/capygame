# CapyGame -- Active Roadmap & Production TODO

This document tracks pending web polish, QA, Android packaging, compliance, and release engineering tasks for **CapyGame** (`https://capyboop.com/`, current codebase `v1.2.4`).

> [!NOTE]
> **Task Hygiene Rule**: Do not leave completed items in `TODO.md`. When a task or milestone is finished, remove it immediately rather than checking it off. Never use emojis or ASCII art in documentation files.

For subsystem references, see:
- **Technical Architecture & Engine Reference**: [`GAME.md`](./GAME.md)
- **Testing & Verification Guide**: [`TESTING.md`](./TESTING.md)
- **Contributor & Operational Playbook**: [`AGENTS.md`](./AGENTS.md)

---

## Roadmap Overview

- **Phase 1 (`P0` | Play Store Blocker) -- Android Packaging & TWA / Capacitor**: Signed release `.aab` with verified Digital Asset Links on `capyboop.com`.
- **Phase 2 (`P0` | Play Store Blocker) -- Play Console Policy, Hosting & Data Safety**: Verified `https://capyboop.com/privacy.html`, Data Safety, and IARC Age Rating.
- **Phase 3 (`P0` | Play Store Blocker) -- Store Listing Copy, Fresh Screenshots & Asset Upload**: Updated `v1.2.x` store/README visuals, listing copy, and maskable safe-zone QA.
- **Phase 4 (`P1` | Play Store Blocker) -- E2E Alignment, Android Device QA & Ergonomics**: Updated 3-mode E2E suite, Android back-button/cutouts, context loss, and thermal FPS QA.
- **Phase 5 (`P1` | Recommended) -- Release CI Gates & Staged Rollout**: Automated `lint` / `test:unit` / `test:pwa` / `test:game` gates and staged `10% -> 100%` rollout.
- **Backlog (`P2` | Non-Blocker) -- Web Performance & Asset Hygiene**: Optional per-mode code splitting (`< 500 kB` chunks) and unused media cleanup.

---

### Phase 1: Android Packaging & Trusted Web Activity / Native Wrapper (`P0`)

- **Select and scaffold Android container (`Bubblewrap` TWA or `Capacitor Android`)**:
  - Choose **Trusted Web Activity (`@bubblewrap/cli`)** targeting the hosted HTTPS PWA (`https://capyboop.com/`) or **Capacitor (`@capacitor/android`)** if bundling static `dist/` assets offline inside the `.aab`.
  - Set a permanent reverse-DNS `applicationId` (for example, `com.capyboop.capygame`), `versionCode` (monotonically incrementing integer), and semantic `versionName` matching `package.json` (`1.2.4+`).
  - Configure Android `compileSdk` and `targetSdk` to satisfy Google Play's current API level mandate (`API 35+`), with `minSdk >= 24`.
- **Configure Google Play App Signing & Digital Asset Links (`assetlinks.json`)**:
  - Generate an upload keystore stored outside version control (CI secrets / encrypted vault only).
  - Enroll the app in **Google Play App Signing** and retrieve the Play App Signing SHA-256 certificate fingerprint.
  - Deploy `public/.well-known/assetlinks.json` at `https://capyboop.com/.well-known/assetlinks.json` (`Content-Type: application/json`) matching the Android `package_name` and SHA-256 fingerprint so the TWA launches fullscreen with zero browser URL bar.
- **Validate WebAssembly, Worker & Header Compatibility on Android**:
  - Confirm `@dimforge/rapier3d-compat` physics worker and `public/_headers` (`COOP`/`COEP`) load cleanly under both Android Chrome Custom Tabs (TWA) and System WebView without MIME or worker-CORS errors.
  - Confirm `public/sw.js` offline fallback serves `./index.html`, `./privacy.html`, and hashed JS/Wasm chunks cleanly in standalone Android launch mode.

---

### Phase 2: Google Play Console Policy, Hosting & Data Safety (`P0`)

- **Verify Production HTTPS Privacy URL**:
  - Confirm `https://capyboop.com/privacy.html` serves the current `CapyGame` privacy policy over HTTPS and submit it in Play Console (`App content -> Privacy policy`).
- **Complete Data Safety & Permissions Declarations**:
  - Fill out Google Play Data Safety accurately: declare on-device local storage (`localStorage`, Cache Storage) only, zero account sign-in, zero third-party ad/analytics SDKs, and zero server transmission of user data.
  - Audit `metadata.json` (`capabilities` and `requestFramePermissions`) and Android `AndroidManifest.xml` to strip unused permissions before submission.
- **IARC Content Rating & General-Audience Target Posture**:
  - Complete the IARC content rating questionnaire and select standard general-audience age groups in Play Console (`Target audience and content`).

---

### Phase 3: Store Listing Copy, Fresh Screenshots & Final Asset Upload (`P0`)

- **Refresh Screenshots & Gallery Showcase for `v1.2.x`**:
  - Re-capture `public/assets/screenshot-*.png` and `docs/gallery/` (`npm run gallery:capture` / `gallery:capture:zoom`) to showcase the 3-mode switcher (`Infinite Zoom`, `Forest Games`, `Capytorio`), unified bridgeless Forest island, brushed satin Capytorio visuals with Alt-Mode icons, and standardized WebGL2 Multiverse rendering.
- **Verify Maskable Icon Safe Zone**:
  - Confirm `public/assets/icon-maskable-512.png` keeps central artwork cleanly inside the 80% Android adaptive icon safe zone across circular and squircle masks.
- **Finalize Store Listing Copy**:
  - Draft Store Title (`<= 30` chars: `CapyGame`), Short Description (`<= 80` chars), Full Description (`<= 4000` chars), app category (`Game -> Simulation`), and release notes for the current `v1.2.x` build.
  - Upload `public/assets/feature-graphic-1024x500.png` and refreshed device screenshots (`public/assets/screenshot-*.png`) to Play Console, adding a 7-inch/10-inch tablet capture if required by Play Console track rules.

---

### Phase 4: E2E Alignment, Android Device QA & Lifecycle Resilience (`P1`)

- **Align Playwright E2E Suite (`scripts/test-capygame.mjs`) with 3 Standalone Modes**:
  - Audit and update `scripts/test-capygame.mjs` stages so selectors and assertions match the `v1.2.0` 3-mode switcher, pure Infinite Zoom continuum, and bridgeless Forest island, and harden Stage 5B / Stage 14B timing tolerances under CPU contention.
- **Hardware GPU & Thermal Profiling on Real Android Devices**:
  - Test the standardized WebGL2 rendering path, Rapier3D physics stepping, shallow-water ripples, and 60 FPS LOD governor on representative low-tier, mid-tier, and flagship Android phones/tablets (Adreno, Mali, Tensor).
  - Verify automatic quality downgrade presets maintain responsive frame pacing without thermal runaway or WebGL out-of-memory crashes.
- **Android Hardware Back Button, Display Cutouts & Edge-to-Edge Insets**:
  - Connect the existing modal Escape/back registry (`src/services/NativeBridge.ts`) to Android hardware Back (`popstate` history sentinel or Capacitor `backButton` listener) so pressing Back dismisses open overlays before exiting.
  - Verify `env(safe-area-inset-*)` padding across camera punch-holes, status bars, and Android gesture navigation bars in both portrait and landscape orientations.
- **Android Lifecycle Pause, Audio Focus & WebGL Context Recovery QA**:
  - Verify `visibilitychange` / `pagehide` audio suspension, held-input clearing, and `ProgressionService.flushPendingSave()` behavior on physical Android devices when receiving calls or switching apps.
  - Test `webglcontextlost` and `webglcontextrestored` recovery so returning from heavy background apps restores the 3D viewport without a black screen.

---

### Phase 5: Pre-Submission CI Gates & Staged Play Console Rollout (`P1`)

- **CI Verification & Release Candidate Gate**:
  - Require green `npm run lint`, `npm run test:unit`, `npm run test:pwa`, and `npm run test:game` runs on every release tag before generating the signed `.aab`.
- **Staged Google Play Rollout Track Progression**:
  - Deploy signed `.aab` to **Internal Testing** track and verify clean TWA/WebView boot, offline launch, and save persistence on physical Android devices.
  - Complete **Closed Testing** requirements (verify Play Console personal account 12-tester / 14-day opt-in criteria if applicable) and address all Pre-Launch Report crashes, ANRs, or accessibility warnings.
  - Promote to **Production** via staged rollout (`10% -> 25% -> 50% -> 100%`) while monitoring Android Vitals crash/ANR thresholds.

---

### Web Performance & Asset Hygiene Backlog (`P2`)

- **Per-Mode Dynamic Code Splitting**:
  - Evaluate splitting Capytorio's 3D renderer and Forest island builders into on-demand async chunks so initial `index.js` and `PlayStyleManager.js` stay under Vite's `500 kB` chunk budget.
- **Pre-Release Media Hygiene**:
  - Remove any unused scratch screenshots (such as `docs/gallery/capygame_breakout.png` or temporary `public/assets/aistudio/` files) before cutting the Play Store release bundle.
