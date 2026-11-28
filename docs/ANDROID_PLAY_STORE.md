# CapyGame Android & Google Play Store Packaging Guide

This guide documents the Trusted Web Activity (TWA) configuration, zero-server Google Sign-In and Play Games Services v2 integration, store listing copy, Data Safety declarations, IARC rating answers, and pre-release checklist for shipping **CapyGame** (`com.capyboop.capygame`) on Google Play.

---

## 1. Store Listing Copy

| Field | Value |
| :--- | :--- |
| **App Name** (max 30 chars) | `CapyGame` |
| **Package ID** | `com.capyboop.capygame` |
| **Short Description** (78 / 80 chars) | `3D Capybara universe zoom, forest island games, and conveyor factory sandbox.` |
| **Category** | Games -> Simulation |
| **Pricing** | Free (no ads, no in-app purchases) |

### Full Description

Explore three hardware-accelerated 3D Capybara worlds in one lightweight, offline-ready app:

- **Infinite Zoom (65 Orders of Magnitude)**: Fly seamlessly from cosmic filaments and rotating spiral galaxies (`10^+30 m`) through solar systems, planetary orbits, forests, and cells all the way down to quarks and Planck foam (`10^-35 m`). Switch between Spiral and Straight flight paths, scrub any of the 27 scale bands in the Scale Atlas, and toggle real-time Cosmic Optics filters.
- **Forest Games**: Roam a unified, bridgeless tropical island as an expressive 3D Capybara. Shake matching-variety citrus orchards to grow your articulated Capy-Snake, soak in the steaming stone Home Pool, and dash seamlessly into Spore Evolution Lagoon, Number Stampede, and Yuzu Mountain Parkour with off-thread Wasm physics.
- **Capytorio**: Build a sprawling 3D automation factory on an infinite ore frontier. Place drills, furnaces, conveyors, power generators, assemblers, and research labs, blueprint whole factory blocks with copy/cut/paste, and launch the orbital Yuzu rocket.

Built for smooth 60 FPS mobile and desktop play with WebGL2 PBR graphics, touch and keyboard controls, full offline support, full-profile JSON save backups, optional zero-server cloud sync, and zero ads or tracking.

### Release Notes (`v1.4.2`)

- Full-profile v2 Save Export/Import in both Basic and Advanced Settings with drag-and-drop JSON support and side-by-side restore confirmation.
- Direct client-side Google Drive cloud save sync via Google Identity Services (`VITE_GOOGLE_CLIENT_ID`, `drive.file` minimal scope, in-memory token caching, zero Firebase SDK or API keys) with `Cross-Origin-Opener-Policy: same-origin-allow-popups` for popup callbacks and Google profile avatars, plus native Android Google Play Games Services v2 bridge support.
- Instant first-interaction resume and clean host-window focus handoff when embedded in preview iframes.
- Android home-screen shortcuts for Infinite Zoom, Forest Games, and Capytorio.

---

## 2. Store Graphic Assets

| Asset | File Path | Dimensions | Notes |
| :--- | :--- | :--- | :--- |
| App Icon (512x512) | `public/assets/icon-512.png` | `512x512` | High-contrast rounded square icon |
| Adaptive Maskable Icon | `public/assets/icon-maskable-512.png` | `512x512` | Capybara artwork centered inside 80% safe circle |
| Feature Graphic | `public/assets/feature-graphic-1024x500.png` | `1024x500` | Play Store hero banner |
| Phone Portrait Screenshot | `public/assets/screenshot-mobile-portrait.png` | `540x960` | 9:16 portrait Forest Sanctuary view |
| Desktop / Landscape 1 | `public/assets/screenshot-desktop-wide.png` | `1280x720` | 16:9 Forest Island Sanctuary hub |
| Desktop / Landscape 2 | `public/assets/screenshot-orbit-descent.png` | `1280x720` | 16:9 Infinite Zoom / Chrono-Vessel continuum |
| Tablet Landscape | `public/assets/screenshot-tablet-wide.png` | `1024x640` | 16:10 Cosmic galaxy & Scale Atlas view |

---

## 3. Client-Side Google Sign-In & Cloud Sync Architecture

CapyGame requires **zero custom game servers, zero Firebase SDK, and zero Google API keys**. Two optional client-side cloud sync paths are supported:

### Option A: Direct Google Drive Sync via Google Identity Services (Web + Android TWA)

1. Open Google Cloud Console and create an **OAuth 2.0 Client ID** of type **Web application** (no client secret or Google API key is needed).
2. Add your production origin (`https://capyboop.com`), GitHub Pages preview origin (if used), and local dev origin (`http://localhost:3000`) under **Authorized JavaScript origins**.
3. Enable the **Google Drive API** on that Google Cloud project and configure the OAuth consent screen with the non-sensitive `https://www.googleapis.com/auth/drive.file` scope (plus `openid`, `profile`, `email`).
4. Set `VITE_GOOGLE_CLIENT_ID=<your-public-web-client-id>` in `.env` locally and as the `VITE_GOOGLE_CLIENT_ID` GitHub Actions repository variable for CI deployments (see `.env.example`; never commit client secrets or private API keys).
5. Google Identity Services (`https://accounts.google.com/gsi/client`) loads lazily only when the player clicks **Sign in with Google** (zero cold-boot impact). CapyGame creates and updates only its own `CapyGame-Cloud-Save.json` file via the Drive v3 REST API, keeps access tokens strictly in JavaScript memory (never in `localStorage` or `sessionStorage`), and revokes them on sign-out.
6. **HTTP Headers (`public/_headers`)**: CapyGame ships `Cross-Origin-Opener-Policy: same-origin-allow-popups` and omits `Cross-Origin-Embedder-Policy: require-corp` so Google Identity Services sign-in popups can return tokens cleanly and third-party Google profile avatars load without CORP blocking (CapyGame's Rapier3D physics worker automatically falls back to zero-copy transferable `Float32Array` buffers without `SharedArrayBuffer`).

### Option B: Native Google Play Games Services v2 (Android Wrapper / Capacitor)

Pure Chrome TWAs cannot call Android's native `com.google.android.gms:play-services-games-v2` SDK directly. When packaging with Capacitor or a native Android WebView wrapper:

1. In Play Console (`Play Games Services -> Setup and management -> Configuration`), create a Play Games Services project for `com.capyboop.capygame`, enable **Saved Games**, and link your Android OAuth client using the **Play App Signing SHA-1** fingerprint.
2. Add `implementation("com.google.android.gms:play-services-games-v2:20.1.2")` to `android/app/build.gradle` and add `<meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id" />` to `AndroidManifest.xml`.
3. Expose the JS bridge expected by `src/services/NativeBridge.ts` (`window.Capacitor.Plugins.PlayGames` or `window.CapyPlayGamesBridge`) implementing:
   - `signIn(): Promise<{ playerId: string; displayName: string; avatarUrl?: string } | null>`
   - `getCurrentPlayer(): Promise<{ playerId: string; displayName: string; avatarUrl?: string } | null>`
   - `loadSavedGame(slotName: string): Promise<{ data: string; updatedAtMs: number; description?: string } | null>`
   - `saveGame(slotName: string, data: string, description: string): Promise<{ updatedAtMs: number }>`
   - `deleteSavedGame(slotName: string): Promise<void>`
4. CapyGame automatically detects `window.Capacitor.Plugins.PlayGames` or `window.CapyPlayGamesBridge` at runtime and surfaces **Sign in with Google Play Games** inside Settings (both Basic and Advanced Mode).

---

## 4. Data Safety & Privacy Declarations

CapyGame runs 100% client-side with zero developer backend servers, analytics SDKs, or ad networks.

| Build Configuration | Play Console Data Safety Declaration |
| :--- | :--- |
| **Offline-Only Build (`VITE_GOOGLE_CLIENT_ID` unset)** | **No user data collected or shared.** All progression, settings, and factory saves stay strictly on-device in browser `localStorage` and Cache Storage. |
| **With Optional Google Drive (`VITE_GOOGLE_CLIENT_ID` set) / Play Games Sync** | Declare **Account info (User ID / Email)** and **App activity (In-game save files)** as **Optional** (`Collected` only when the player explicitly signs in, **Not shared** with third parties, **Encrypted in transit** via HTTPS, **User can request/perform deletion** directly inside Settings or Google Drive). |
| **Optional Anonymous In-Game Feedback (`Send Feedback`)** | Voluntary, user-initiated text submissions are sent over encrypted HTTPS to the CapyGame Cloudflare Worker relay (`POST /api/feedback`) solely to open an anonymous public issue on `capyboop/capygame` with app version, active mode, platform, and viewport only (no account, email, or personal identity collected; not shared with ad/analytics networks). |

- **Privacy Policy URL**: `https://capyboop.com/privacy.html` (kept synchronized with `public/privacy.html`).
- **Terms of Service URL**: `https://capyboop.com/terms.html` (kept synchronized with `public/terms.html`).
- **IARC Content Rating**: Expected **Everyone / PEGI 3** (no violence, no user-generated chat, no purchases, no location sharing).

---

## 5. Building the Signed Android App Bundle (AAB) via Bubblewrap

1. Run the automated preflight release gate before building the Android bundle:
   ```bash
   npm run lint
   npm run test:unit
   npm run build
   npm run verify:playstore
   ```
2. Install Bubblewrap CLI on a machine with JDK 17+ and Android SDK:
   ```bash
   npm i -g @bubblewrap/cli
   ```
3. Generate and build the signed Android TWA bundle from `twa-manifest.json`:
   ```bash
   bubblewrap update --manifest=twa-manifest.json
   bubblewrap build
   ```
4. Upload the signed `app-release-bundle.aab` to the Play Console **Internal Testing** track.
5. Copy the **Play App Signing** SHA-256 certificate fingerprint from Play Console (`Setup -> App signing`) into `public/.well-known/assetlinks.json` (replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT`) and redeploy `https://capyboop.com/`.
6. Verify `https://capyboop.com/.well-known/assetlinks.json` returns HTTP 200 with `application/json` and zero redirects so Chrome removes the browser address bar inside the TWA.

---

## 6. Pre-Launch Device QA Checklist

- Cold boot offline after first load (Service Worker serves app shell with zero console errors).
- Hardware Back button closes Settings, Scale Atlas, Bounties, and Capytorio drawers before leaving the app.
- Portrait and landscape rotation keep the top `40px` bar and bottom controls clear of punch-hole cameras and Android gesture navigation bars.
- Export and restore a v2 JSON save bundle in both Basic and Advanced Settings, verifying Coins, DNA, Capytorio buildings, and World Seed restore accurately.
- Switch across Infinite Zoom, Forest Games, and Capytorio without WebGL context loss or horizontal overflow.
