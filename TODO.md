# CapyGame -- Active Roadmap & Google Play Store Production TODO

This document tracks pending architectural, packaging, compliance, QA, and release engineering tasks required to ship **CapyGame 3D** to the Google Play Store.

> [!NOTE]
> **Task Hygiene Rule**: Do not leave completed items in `TODO.md`. When a task or milestone is finished, remove it immediately rather than checking it off. Never use emojis or ASCII art in documentation files.

For subsystem references, see:
- **Technical Architecture & Engine Reference**: [`GAME.md`](./GAME.md)
- **Testing & Verification Guide**: [`TESTING.md`](./TESTING.md)
- **Contributor & Operational Playbook**: [`AGENTS.md`](./AGENTS.md)

---

## Play Store Production Readiness Roadmap

| Priority | Workstream | Release Blocker | Target Outcome |
| :--- | :--- | :--- | :--- |
| **P0** | Android Packaging & TWA / Capacitor | Yes | Signed release `.aab` with verified Digital Asset Links |
| **P0** | Play Policy, Privacy & Families Compliance | Yes | Approved Privacy URL, Data Safety, and IARC Age Rating |
| **P0** | Branding, Manifest Screenshots & Storefront Assets | Yes | Unified branding, 512px icon, 1024x500 graphic, device screenshots |
| **P1** | Android Runtime, Hardware GPU & Ergonomics QA | Yes | Verified touch/back-button, cutouts, context loss, low-end GPU FPS |
| **P1** | Release Pipeline, CI Gates & Staged Rollout | Recommended | Automated E2E + TWA build checks and staged 10% -> 100% rollout |

---

### Milestone 3: Android Packaging & Trusted Web Activity / Native Wrapper (`P0`)

- **Select and scaffold Android container (`Bubblewrap` TWA or `Capacitor Android`)**:
  - Choose **Trusted Web Activity (`@bubblewrap/cli`)** if shipping the hosted HTTPS PWA (`https://<production-domain>/`) or **Capacitor (`@capacitor/android`)** if bundling static `dist/` assets offline inside the `.aab`.
  - Set a permanent reverse-DNS `applicationId` (for example, `com.capygame.universe3d`), `versionCode` (monotonically incrementing integer), and semantic `versionName` (`1.0.0`).
  - Configure Android `compileSdk` and `targetSdk` to satisfy Google Play's current API level mandate (`API 35+`), with `minSdk >= 24`.
- **Configure Google Play App Signing & Digital Asset Links (`assetlinks.json`)**:
  - Generate an upload keystore stored outside version control (CI secrets / encrypted vault only).
  - Enroll the app in **Google Play App Signing** and retrieve the Play App Signing SHA-256 certificate fingerprint.
  - Deploy `public/.well-known/assetlinks.json` at the canonical HTTPS production origin (`/.well-known/assetlinks.json`, `Content-Type: application/json`) matching the Android `package_name` and SHA-256 fingerprint so the TWA launches fullscreen with zero browser URL bar.
- **Validate WebAssembly, Worker & Header Compatibility on Android**:
  - Confirm `@dimforge/rapier3d-compat` physics worker and `public/_headers` (`COOP`/`COEP`) load cleanly under both Android Chrome Custom Tabs (TWA) and System WebView without MIME or worker-CORS errors.
  - Confirm `public/sw.js` offline fallback serves `./index.html`, `./privacy.html`, and hashed JS/Wasm chunks cleanly in standalone Android launch mode.

---

### Milestone 4: Google Play Console Policy, Privacy & Families Compliance (`P0`)

- **Wire and Publish Privacy Policy**:
  - Host `public/privacy.html` on the production HTTPS origin and submit its public URL in Play Console (`App content -> Privacy policy`).
  - Add an in-app **Privacy Policy** link inside the Settings / About modal (`src/capygame/components/CapyGameView.tsx`) using an in-app viewer or safe link rather than `window.open` / `window.alert`.
- **Complete Data Safety & Permissions Declarations**:
  - Fill out Google Play Data Safety accurately: declare on-device local storage (`localStorage`, Cache Storage) only, zero account sign-in, zero third-party ad/analytics SDKs, and zero server transmission of user data.
  - Audit `metadata.json` (`capabilities` and `requestFramePermissions`) and Android `AndroidManifest.xml` to strip unused permissions or server capability flags before submission.
- **IARC Content Rating & Target Audience (Kids-Friendly Basic Mode)**:
  - Complete the IARC content rating questionnaire and select appropriate age groups in Play Console (`Target audience and content`).
  - If opting into Google Play's **Designed for Families** / Teacher Approved programs, audit Basic Mode text-to-speech (`speechSynthesis`), external links (must be behind a parental gate or kept strictly in-app), and tactile button compliance (`>= 48dp`).

---

### Milestone 5: Branding Unification, Manifest Rich UI & Storefront Assets (`P0`)

- **Unify Product Naming Across Entry Metadata**:
  - Replace the legacy placeholder string `"Capy - Color by Number & CapyGame 3D"` in `index.html` (`<title>`, `og:title`) and `metadata.json` (`name`) with final Play Store branding (`CapyGame 3D`), and keep `public/manifest.webmanifest` aligned.
- **Generate Required Google Play Graphic & Rich Install Assets**:
  - Finalize high-resolution Play Store icon (`512x512` 32-bit PNG) and ensure `public/assets/icon-maskable-512.png` keeps all artwork within the central 80% safe zone.
  - Create **Feature Graphic** (`1024x500` PNG/JPG) with legible `CapyGame 3D` title treatment and key cosmic-to-island artwork.
  - Capture clean promotional **Screenshots** (minimum 4 Phone screenshots in 16:9 or 9:16, plus 7-inch and 10-inch Tablet screenshots) showcasing Multiverse scale, CapySol/CapyWorld orbit, Micro-Glade Discovery Sticker Book, and Capybara Island world building.
  - Add verified `narrow` and `wide` screenshot entries to `public/manifest.webmanifest` referencing committed files under `public/assets/` for Chrome Richer Install UI and PWABuilder verification.
- **Finalize Store Listing Copy**:
  - Draft Store Title (<= 30 chars), Short Description (<= 80 chars), Full Description (<= 4000 chars), app category (`Game -> Simulation` or `Educational`), and release notes for `v1.0.0`.

---

### Milestone 6: Android Device QA, Ergonomics & Lifecycle Resilience (`P1`)

- **Hardware GPU & Thermal Profiling on Real Android Devices**:
  - Test WebGL2 and Android WebGPU paths, Rapier3D physics stepping, shallow-water ripples, and 60 FPS LOD governor on representative low-tier, mid-tier, and flagship Android phones/tablets (Adreno, Mali, Tensor).
  - Verify automatic quality downgrade presets maintain responsive frame pacing without thermal runaway or WebGL out-of-memory crashes.
- **Android Hardware Back Button, Display Cutouts & Edge-to-Edge Insets**:
  - Wire Android Back (`popstate` / history sentinel or Capacitor `backButton` listener) so pressing Back dismisses open overlays (`World Menu`, `Settings`, `Zoom Explorer`, `Sticker Book`, `Settings -> Overview`) before prompting or exiting.
  - Verify `env(safe-area-inset-*)` padding across camera punch-holes, status bars, and Android gesture navigation bars in both portrait and landscape orientations.
- **Lifecycle Pause, Audio Focus & WebGL Context Recovery**:
  - Hook `visibilitychange` / `pagehide` to pause Web Audio oscillators/speech synthesis cleanly when backgrounded or receiving a phone call, clamp frame `dt` on resume, and flush pending progression saves (`ProgressionService.flushPendingSave`).
  - Test `webglcontextlost` and `webglcontextrestored` recovery so returning from heavy background apps restores the 3D viewport without a black screen.

---

### Milestone 7: Pre-Submission CI Gates & Staged Play Console Rollout (`P1`)

- **CI Verification & Release Candidate Gate**:
  - Require green `npm run lint`, `npm run test:unit`, `npm run test:pwa`, and `npm run test:game` runs on every release tag before generating the signed `.aab`.
  - Harden E2E timing tolerances under CPU contention (`scripts/test-capygame.mjs` Stage 5B / Stage 14B) so headless verification is 100% deterministic.
- **Staged Google Play Rollout Track Progression**:
  - Deploy signed `.aab` to **Internal Testing** track and verify clean TWA/WebView boot, offline launch, and save persistence on physical Android devices.
  - Complete **Closed Testing** requirements (verify Play Console personal account 12-tester / 14-day opt-in criteria if applicable) and address all Pre-Launch Report crashes, ANRs, or accessibility warnings.
  - Promote to **Production** via staged rollout (`10% -> 25% -> 50% -> 100%`) while monitoring Android Vitals crash/ANR thresholds.
