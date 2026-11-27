# CapyGame -- Active Roadmap & Production TODO

This document tracks remaining Android packaging, Play Console submission, physical-device QA, and release engineering tasks for **CapyGame** (`https://capyboop.com/`, current codebase `v1.4.0`).

> [!NOTE]
> **Task Hygiene Rule**: Do not leave completed items in `TODO.md`. When a task or milestone is finished, remove it immediately rather than checking it off. Never use emojis or ASCII art in documentation files.

For subsystem references, see:
- **Technical Architecture & Engine Reference**: [`GAME.md`](./GAME.md)
- **Testing & Verification Guide**: [`TESTING.md`](./TESTING.md)
- **Android Play Store & TWA Guide**: [`docs/ANDROID_PLAY_STORE.md`](./docs/ANDROID_PLAY_STORE.md)
- **Contributor & Operational Playbook**: [`AGENTS.md`](./AGENTS.md)

---

## Roadmap Overview

- **Phase 1 (`P0` | Play Store Blocker) -- Signed Android `.aab` & Live Asset Links**: Generate upload keystore, build signed TWA `.aab` from `twa-manifest.json`, and publish the Play App Signing SHA-256 fingerprint in `public/.well-known/assetlinks.json`.
- **Phase 2 (`P0` | Play Store Blocker) -- Play Console Policy, Hosting & Data Safety**: Submit `https://capyboop.com/privacy.html`, Data Safety declarations, IARC rating, and store listing assets.
- **Phase 3 (`P1` | Play Store Blocker) -- Physical Android Device QA & Lifecycle Resilience**: Profile hardware GPU thermals, Wasm/COOP/COEP headers, audio focus, and WebGL context recovery on real Android hardware.
- **Phase 4 (`P1` | Recommended) -- Release CI Gates & Staged Rollout**: Automate full release gates and progress through Internal, Closed, and Staged Production tracks.

---

### Phase 1: Signed Android `.aab` Build & Digital Asset Links (`P0`)

- **Generate Upload Keystore & Build Signed TWA Bundle**:
  - Create a release upload keystore outside version control (CI secrets / encrypted vault only).
  - Run `bubblewrap update --manifest=twa-manifest.json && bubblewrap build` with Android `compileSdk`/`targetSdk` API `35+` and `minSdk` `24`.
- **Publish Live Google Play App Signing SHA-256 Fingerprint**:
  - Enroll `com.capyboop.capygame` in Google Play App Signing, replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` in `public/.well-known/assetlinks.json`, and verify `https://capyboop.com/.well-known/assetlinks.json` returns HTTP 200 `application/json` with zero redirects.
- **Validate WebAssembly, Worker & Header Compatibility in Android TWA**:
  - Confirm `@dimforge/rapier3d-compat` physics worker and `public/_headers` (`COOP`/`COEP`) load cleanly under Android Chrome Custom Tabs (TWA) and System WebView without MIME or worker-CORS errors.
  - Confirm `public/sw.js` offline fallback serves `./index.html`, `./privacy.html`, and hashed JS/Wasm chunks cleanly in standalone Android launch mode.

---

### Phase 2: Google Play Console Policy, Hosting & Store Upload (`P0`)

- **Verify Production HTTPS Privacy URL**:
  - Confirm `https://capyboop.com/privacy.html` serves the current `CapyGame` privacy policy over HTTPS and submit it in Play Console (`App content -> Privacy policy`).
- **Complete Data Safety, Permissions & IARC Rating**:
  - Submit the Play Console Data Safety questionnaire matching your chosen build configuration (offline-only default or optional client-side Google Drive / Play Games cloud sync) using [`docs/ANDROID_PLAY_STORE.md`](./docs/ANDROID_PLAY_STORE.md).
  - Audit `metadata.json` and generated Android `AndroidManifest.xml` to ensure zero unused permissions remain before submission.
  - Complete the IARC content rating questionnaire and select general-audience age groups.
- **Upload Store Listing Copy & Graphic Assets**:
  - Upload `public/assets/feature-graphic-1024x500.png` and refreshed `public/assets/screenshot-*.png` captures with the listing copy from [`docs/ANDROID_PLAY_STORE.md`](./docs/ANDROID_PLAY_STORE.md).

---

### Phase 3: Physical Android Device QA & Lifecycle Resilience (`P1`)

- **Hardware GPU & Thermal Profiling on Real Android Devices**:
  - Test the standardized WebGL2 rendering path, Rapier3D physics stepping, shallow-water ripples, and 60 FPS LOD governor on representative low-tier, mid-tier, and flagship Android phones/tablets (Adreno, Mali, Tensor).
  - Verify automatic quality downgrade presets maintain responsive frame pacing without thermal runaway or WebGL out-of-memory crashes.
- **Android Lifecycle Pause, Audio Focus & WebGL Context Recovery QA**:
  - Verify `visibilitychange` / `pagehide` audio suspension, held-input clearing, and `ProgressionService.flushPendingSave()` behavior on physical Android devices when receiving calls or switching apps.
  - Test `webglcontextlost` and `webglcontextrestored` recovery so returning from heavy background apps restores the 3D viewport without a black screen.

---

### Phase 4: Pre-Submission CI Gates & Staged Play Console Rollout (`P1`)

- **CI Verification & Release Candidate Gate**:
  - Require green `npm run lint`, `npm run test:unit`, `npm run build`, `npm run verify:playstore`, `npm run test:pwa`, and `npm run test:game` runs on every release tag before generating the signed `.aab`.
- **Staged Google Play Rollout Track Progression**:
  - Deploy signed `.aab` to **Internal Testing** track and verify clean TWA boot, offline launch, hardware Back dismissal, cutout insets, and save persistence on physical Android devices.
  - Complete **Closed Testing** requirements (verify Play Console personal account 12-tester / 14-day opt-in criteria if applicable) and address all Pre-Launch Report crashes, ANRs, or accessibility warnings.
  - Promote to **Production** via staged rollout (`10% -> 25% -> 50% -> 100%`) while monitoring Android Vitals crash/ANR thresholds.
