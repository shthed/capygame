# CapyGame Android & Google Play Store Packaging Guide

This guide documents the Trusted Web Activity (TWA) configuration, store listing copy, Data Safety declarations, IARC rating answers, and pre-release checklist for shipping **CapyGame** (`com.capyboop.capygame`) on Google Play.

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

Built for smooth 60 FPS mobile and desktop play with WebGL2 PBR graphics, touch and keyboard controls, full offline support, and zero telemetry or accounts.

### Release Notes (`v1.3.0`)

- Faster cold start with on-demand loading for Forest island districts and microscopic dioramas.
- Android hardware Back button now dismisses open menus and drawers cleanly before exiting.
- Display cutout and gesture-bar safe-area spacing across portrait and landscape HUD bars.
- Refreshed store screenshots and Google Play TWA packaging support.

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

## 3. Data Safety & Privacy Declarations

CapyGame runs 100% client-side with zero backend servers, analytics SDKs, ad networks, or user accounts.

- **Does your app collect or share any of the required user data types?** `No`
- **Local storage only**: Game progression (`capy_game_save_v3`), Capytorio factory saves, and graphics settings (`capy_game_settings_v1`) are stored strictly on-device in browser `localStorage`.
- **Privacy Policy URL**: Host a plain-language static privacy policy at `https://capyboop.com/privacy` confirming zero data collection and linking to it in Play Console.
- **IARC Content Rating**: Expected **Everyone / PEGI 3** (no violence, no user-generated chat, no purchases, no location sharing).

---

## 4. Building the Signed Android App Bundle (AAB) via Bubblewrap

1. Install Bubblewrap CLI on a machine with JDK 17+ and Android SDK:
   ```bash
   npm i -g @bubblewrap/cli
   ```
2. Generate the Android TWA project from `twa-manifest.json`:
   ```bash
   bubblewrap update --manifest=twa-manifest.json
   bubblewrap build
   ```
3. Upload the signed `app-release-bundle.aab` to the Play Console **Internal Testing** track.
4. Copy the **Play App Signing** SHA-256 certificate fingerprint from Play Console (`Setup -> App signing`) into `public/.well-known/assetlinks.json` (replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT`) and redeploy `https://capyboop.com/`.
5. Verify `https://capyboop.com/.well-known/assetlinks.json` returns HTTP 200 with `application/json` and zero redirects so Chrome removes the browser address bar inside the TWA.

---

## 5. Pre-Launch Device QA Checklist

- Cold boot offline after first load (Service Worker serves app shell with zero console errors).
- Hardware Back button closes Settings, Scale Atlas, Bounties, and Capytorio drawers before leaving the app.
- Portrait and landscape rotation keep the top `40px` bar and bottom controls clear of punch-hole cameras and Android gesture navigation bars.
- Switch across Infinite Zoom, Forest Games, and Capytorio without WebGL context loss or horizontal overflow.
