# Testing Architecture & Verification Guide: CapyGame 3D

This document outlines the automated verification suites, headless WebGL execution flags, end-to-end Playwright stage assertions, and GitHub Pages CI pipeline for **CapyGame 3D**.

---

## 1. Test & Verification Commands

Run all commands from the repository root:

| Test Level | Command | Scope |
| :--- | :--- | :--- |
| **Type Checking** | `npm run lint` | Runs `tsc -p tsconfig.json --noEmit` in strict mode across all React components, Three.js shaders/engines, and Rapier3D worker modules. |
| **Production Build** | `npm run build` | Compiles TypeScript and produces minified relative-path (`./assets/...`) bundles in `dist/` including the Rapier3D Wasm physics worker. |
| **Dev Server** | `npm run dev` | Launches Vite on `http://localhost:3000`. |
| **Preview Server** | `npm run preview` | Serves compiled `dist/` on `http://localhost:3000` for production verification. |
| **Unit Logic Suite** | `npm run test:unit` | Runs deterministic `node:test` assertions (`ProgressionAndPhysics.test.ts`) for economy multipliers/Prestige, `ProceduralGameConfig` validation/`mulberry32`, `24x24` fluid `DataTexture` ripple packing, `computeCosmicAgeGyr`, yaw-rotated OBB math, and 60 FPS sightline/shadow invariants. |
| **CapyGame 3D E2E Suite** | `npm run test:game` | Executes `scripts/test-capygame.mjs` against `http://localhost:3000`, verifying all cosmic, surface, multiphysics, economy, and AAA GPU rendering invariants. |
| **PWA & Offline Suite** | `npm run test:pwa` | Executes `scripts/test-pwa-offline.mjs` to validate `manifest.webmanifest`, scope-isolated Service Worker (`sw.js`) precaching, and 100% offline 3D reload. |
| **District Gallery Capture** | `npm run gallery:capture` | Executes `scripts/capture-capygame-gallery.mjs` to capture full-frame screenshots across all 5 districts into `docs/gallery/`. |
| **21-Band Zoom Capture** | `npm run gallery:capture:zoom` | Executes `scripts/capture-all-zoom-levels.mjs` across all 21 logarithmic universe scale bands (`10^+28 m` to `10^-35 m`) into `docs/gallery/zoom_levels/`. |

---

## 2. Comprehensive E2E Assertions (`scripts/test-capygame.mjs`)

`scripts/test-capygame.mjs` launches Chromium with ANGLE/SwiftShader WebGL2 support and verifies:

1. **Compact Single-Line Top Bar & Responsive Viewport Integrity**: Asserts `unified-top-bar` (`40px` height at `y = 0`), zero bottom HUD overlays, `390px` mobile horizontal fit (`right <= 390`), and mutually exclusive top-anchored dropdowns (`universe-scale-atlas-panel`, `cosmic-optics-panel`, `top-info-dropdown`, `capygame-top-dock`).
2. **Cosmic Genesis, Multi-Star Selection & Astrophysical Shaders**: Verifies singularity ignition, N-Body/SPH galaxy formation, supernova nucleosynthesis, non-zero star-system selection (`Sirius Cyan-B` and `Sol Yuzu Prime`), real-time Keplerian orbital time scales, planetary descent, Capybara hero selection, and zero WebGL shader compilation or validation errors.
3. **Sanctuary Botany, Articulated Spine, Economy & 95% Screen-Clear Occlusion**: Verifies 8 non-overlapping exponential trees (`1.48^tier`), bump-only matching citrus drops, solid `+-6%` PBD spine spacing, coordinated backward walking across all Dachshund segments, 2-joint foot-contact traction (`isStuckNoFooting` at `0` grounded feet), Home Pool tap washing and overflow splash messes, interactive raycast building placement ghost (`Clear` vs `Blocked`), real coin/DNA deductions & Prestige Ascension, dynamic bioluminescent dusk/night cycle, and `alpha = 0` (`>= 95%` screen clear) foreground occluder fading.
4. **63-Order `1:1` Universe Simulator & Unlockable Cosmic Instruments**: Sweeps all 21 scale bands from `big_bang` (`+28.0`) through unified `solar_systems` (`+13.7`, including Oort Cloud) and `capybara_forest` (`+0.8`) down to `planck_quantum_foam` (`-35.0`), asserting strict `1:1` default scale (`realityScaleGamma === 1.0`), unlockable Object Finder Markers (`object-finder-markers-layer`), and unlockable Reality Rescaler (`0.28..1.00`).
5. **Contiguous Single-World Promenade Causeways & Rapier3D Wasm Physics**: Walks the Hero Capybara overland from `Sanctuary (0, 0)` across the Grand Promenade Causeways into `Spore Lagoon`, `Yuzu Breakout`, and `Yuzu Mountain` without calling `switchMode()`, and verifies `@dimforge/rapier3d-compat` worker initialization, yaw-aware swept CCD, dynamic `RevoluteJoint` see-saw torque tilt, XPBD soft-body pad compression/rebound, and `24x24` shallow-water Archimedes buoyancy.
6. **Hardware-Accelerated 3D GPU Engine & AAA VFX Pipeline**: Verifies `HardwareGpuEngine`, `>= 20` Sobel tangent-space PBR `normalMap`/`roughnessMap`/`aoMap` textures across all 5 districts, dual-octave clearcoat ocean normals, Hero contact shadow + texel-snapped directional shadow cascade, SoA `InstancedMesh` burst/footstep VFX, GPU bokeh sun-motes/fireflies, crepuscular god-rays, quadratic camera trauma decay, live texture filter/anisotropy/tone-mapping/post-FX profile switching, and zero runtime/console errors.

---

## 3. Continuous Integration Pipeline ([`.github/workflows/deploy-branch.yml`](./.github/workflows/deploy-branch.yml))

1. **Build Job** (`contents: read`): Installs deterministic locked dependencies (`npm ci`), runs `npm run lint`, `npm run test:unit`, and `npm run build` (`tsc -p tsconfig.json --noEmit && vite build`), staging compiled `dist/` artifacts.
2. **Deploy Job** (`pages: write`, `id-token: write`): Publishes PR preview bundles to `/pull/<number>/` and merges on `main` to the GitHub Pages root with squashed orphan `gh-pages` history and strict `actions/deploy-pages@v5` verification.
