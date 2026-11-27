# Testing Architecture & Verification Guide: CapyGame

This document outlines the automated verification suites, headless WebGL execution flags, end-to-end Playwright stage assertions, and GitHub Pages CI pipeline for **CapyGame**.

---

## 1. Test & Verification Commands

Run all commands from the repository root:

- **Type Checking (`npm run lint`)**: Runs `tsc -p tsconfig.json --noEmit` in strict mode across all React components, Three.js shaders/engines, and Rapier3D worker modules.
- **Production Build (`npm run build`)**: Compiles TypeScript and produces minified relative-path (`./assets/...`) bundles in `dist/` including the Rapier3D Wasm physics worker.
- **Dev Server (`npm run dev`)**: Launches Vite on `http://localhost:3000`.
- **Preview Server (`npm run preview`)**: Serves compiled `dist/` on `http://localhost:3000` for production verification.
- **Unit Logic Suite (`npm run test:unit`)**: Runs deterministic `node:test` assertions across all 8 suites (`ProgressionAndPhysics.test.ts`, `SaveAndCloudSync.test.ts`, `UniverseAndGpuMath.test.ts`, `CapytorioFactoryEngine.test.ts`, `forestMicroSpecimens.test.ts`, `UfoFlightSequence.test.ts`, `TutorialCatalog.test.ts`, and `FocusGuard.test.ts`) covering 3-mode isolation & simulation pausing, Capytorio simulation/crafting/Lua/blueprints/Alt-Mode/3D variants, economy/full-profile v2 save portability/Google Drive REST & Play Games bridge sync/quota recovery, UFO orbit-to-surface flight, Micro-Glade Discovery Sticker Book & async crossfade guards, tutorial catalog & version sync, spine/fluid/XPBD physics, cold-load lazy chunk splitting (`capy-shared-core`, `ForestDistrictBuilders`, `ForestMicroDioramaBuilder`, `CosmicUniverseBuilder`, `vendor-firebase`, lazy modals), Android hardware Back sentinel & safe-area HUD insets, GPU indirect draw culling & shaders, and PWA/TWA/security header invariants.
- **Play Store & Cold-Boot Preflight (`npm run verify:playstore`)**: Executes `scripts/verify-playstore-readiness.mjs` to validate `manifest.webmanifest`, `twa-manifest.json` version parity, `assetlinks.json`, store graphics/screenshots, `privacy.html`, and zero eager cold-boot preloads of `vendor-three`, `feature-universe`, `feature-capytorio`, or `vendor-firebase` in `dist/index.html`.
- **CapyGame E2E Suite (`npm run test:game`)**: Executes `scripts/test-capygame.mjs` against `http://localhost:3000`, verifying all cosmic, surface, factory automation, multiphysics, economy, and AAA GPU rendering invariants.
- **PWA & Offline Suite (`npm run test:pwa`)**: Executes `scripts/test-pwa-offline.mjs` to validate `manifest.webmanifest`, scope-isolated Service Worker (`sw.js`) precaching, and 100% offline 3D reload.
- **District Gallery Capture (`npm run gallery:capture`)**: Executes `scripts/capture-capygame-gallery.mjs` to capture full-frame screenshots across all 5 districts into `docs/gallery/`.
- **27-Band Zoom Capture (`npm run gallery:capture:zoom`)**: Executes `scripts/capture-all-zoom-levels.mjs` across all 27 logarithmic universe scale bands (`10^+30 m` to `10^-35 m`) into `docs/gallery/zoom_levels/`.

---

## 2. Comprehensive E2E Assertions (`scripts/test-capygame.mjs`)

`scripts/test-capygame.mjs` launches Chromium with ANGLE/SwiftShader WebGL2 support and verifies:

1. **Compact Single-Line Top Bar, Top-Right Fullscreen & Bottom-Right 3-Button Speed / Spiral Controls**: Asserts `unified-top-bar` (`40px` height at `y = 0`), visible top-right `toggle-fullscreen-btn`, clean bottom-right `Straight`/`Spiral` toggle + 3 speed buttons (`Rewind`, `Play/Pause`, `Fast Forward`) with zero sliders or duplicate throttle bars, `360 deg` (`2*pi rad`) spiral sweep per zoom band, `390px` mobile horizontal fit (`right <= 390`), and mutually exclusive top-anchored dropdowns.
2. **Cosmic Genesis, Multi-Star Selection & Astrophysical Shaders**: Verifies singularity ignition, N-Body/SPH galaxy formation, supernova nucleosynthesis, non-zero star-system selection (`Sirius Cyan-B` and `Sol Yuzu Prime`), real-time Keplerian orbital time scales, planetary descent, Capybara hero selection, and zero WebGL shader compilation or validation errors.
3. **Sanctuary Botany, Connected 3D Jumps, Articulated Spine & Foreground Transparency**: Verifies 8 non-overlapping exponential trees (`1.48^tier`), bump-only matching citrus drops, solid `+-6%` PBD spine spacing, vertical `solveSpineVerticalCoupling` body connectivity across normal forward jumps and bounded Mushroom Pad hops, coordinated backward walking across all Dachshund segments, 2-joint foot-contact traction (`isStuckNoFooting` at `0` grounded feet), Home Pool tap washing, interactive raycast building placement ghost, real coin/DNA deductions & Prestige Ascension, dynamic dusk/night cycle, solid side-tree preservation, and standard 3rd-person `4x4` Bayer dither fade (`0.25` uniform ghost silhouette, dissolving to `0.0` near lens) strictly for objects blocking the player corridor or camera lens.
4. **65-Order `1:1` Universe Simulator & Unlockable Cosmic Instruments**: Sweeps all 27 scale bands from `multiverse` (`+30.0`) through `planet` (`+7.10`), `capybara_forest` (`+0.8`), `leaf_fur_micro` (`-2.0`), `cells`, `chromatin` transition, and `dna` down to `planck_quantum_foam` (`-35.0`), asserting strict `1:1` default scale (`realityScaleGamma === 1.0`), unlockable Object Finder Markers (`object-finder-markers-layer`), and unlockable Reality Rescaler (`0.28..1.00`).
5. **Unified Bridgeless Forest Island, Standalone Capytorio & Rapier3D Wasm Physics**: Verifies seamless overland traversal across `Sanctuary`, `Spore Lagoon`, `Number Stampede`, and `Yuzu Mountain`, standalone `Capytorio` factory automation (`recipe.lua`/`technology.lua`, drills, belts, inserters, foundries, assemblers, science labs, Alt-Mode icons, blueprint copy/paste, 100% demolish refund), `@dimforge/rapier3d-compat` worker initialization, yaw-aware swept CCD, dynamic `RevoluteJoint` see-saw torque tilt, XPBD soft-body pad compression/rebound, and `24x24` shallow-water Archimedes buoyancy.
6. **Standardized WebGL2 GPU Engine & AAA VFX Pipeline**: Verifies `HardwareGpuEngine` (WebGL2-only), `>= 20` Sobel tangent-space PBR `normalMap`/`roughnessMap`/`aoMap` textures, brushed satin Capytorio machinery, dual-octave clearcoat ocean normals, Hero contact shadow + texel-snapped directional shadow cascade, SoA `InstancedMesh` burst/footstep VFX, GPU bokeh sun-motes/fireflies, crepuscular god-rays, quadratic camera trauma decay, live texture filter/anisotropy/tone-mapping/post-FX profile switching, and zero runtime/console errors.
7. **Mode Switching, Capytorio Controls & Privacy Policy**: Verifies unified `CapyGame` About modal branding, embedded `./privacy.html` iframe inside `privacy-policy-modal`, Kinetic Dash (`surface-dash-btn`), airborne Belly-Flop Slam splash (`surface-dive-btn`), Arcade Combo HUD (`arcade-combo-hud`), collapsible 3-slot Archipelago Bounties (`bounties-hud-toggle`), and Capytorio controls (10-slot Recent-Items Quickbar `capytorio-toolbar`, `[I]` Inventory + tabbed Factorio Crafting drawer, `[V]` 68-degree Oblique <-> 3D Chase toggle, zoom `+/-`, citrus tree `+3` Fresh Orange mining, Inspect coal feeding `1.5 -> 6.0 MW`, Smart Pipette `[Q]`, Survey Beacon `[H]` recall, Milestone progress badge, and zero mobile overflow).

---

## 3. Continuous Integration Pipeline ([`.github/workflows/deploy-branch.yml`](./.github/workflows/deploy-branch.yml))

1. **Build Job** (`contents: read`): Installs deterministic locked dependencies (`npm ci`), runs `npm run lint`, `npm run test:unit`, and `npm run build` (`tsc -p tsconfig.json --noEmit && vite build`), staging compiled `dist/` artifacts.
2. **Deploy Job** (`pages: write`, `id-token: write`): Publishes PR preview bundles to `/pull/<number>/` and merges on `main` to the GitHub Pages root with squashed orphan `gh-pages` history and strict `actions/deploy-pages@v5` verification.
