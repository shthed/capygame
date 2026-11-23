# Testing Architecture & Verification Guide: CapyGame

This document outlines the automated verification suites, headless WebGL execution flags, end-to-end Playwright stage assertions, and GitHub Pages CI pipeline for **CapyGame**.

---

## 1. Test & Verification Commands

Run all commands from the repository root:

| Test Level | Command | Scope |
| :--- | :--- | :--- |
| **Type Checking** | `npm run lint` | Runs `tsc -p tsconfig.json --noEmit` in strict mode across all React components, Three.js shaders/engines, and Rapier3D worker modules. |
| **Production Build** | `npm run build` | Compiles TypeScript and produces minified relative-path (`./assets/...`) bundles in `dist/` including the Rapier3D Wasm physics worker. |
| **Dev Server** | `npm run dev` | Launches Vite on `http://localhost:3000`. |
| **Preview Server** | `npm run preview` | Serves compiled `dist/` on `http://localhost:3000` for production verification. |
| **Unit Logic Suite** | `npm run test:unit` | Runs deterministic `node:test` assertions (`CapytorioFactoryEngine.test.ts`, `ProgressionAndPhysics.test.ts`, and `UniverseAndGpuMath.test.ts`) for Capytorio mining/L-corner belt drag/pipette/manual feeding/inserter/furnace/assembler/science/milestone/rocket/tech simulation & infinite ore chunks, economy multipliers/Prestige, 3-slot Bounty progression & Arcade Combo/Fever decay, smooth orbital descent blending & camera convergence curves, Micro-Glade Discovery Sticker Book persistence, slow steady 3-button media speed transport, constant-rate target-scale flight, `360 deg` per-band spiral orbit angle, `solveSpineVerticalCoupling` jump connectivity, realistic physical scale formatting, `ProceduralGameConfig` validation/`mulberry32`, fluid wake packing, GPU indirect draw culling, Clustered Forward+ light binning, and 60 FPS sightline/shadow invariants. |
| **CapyGame E2E Suite** | `npm run test:game` | Executes `scripts/test-capygame.mjs` against `http://localhost:3000`, verifying all cosmic, surface, factory automation, multiphysics, economy, and AAA GPU rendering invariants. |
| **PWA & Offline Suite** | `npm run test:pwa` | Executes `scripts/test-pwa-offline.mjs` to validate `manifest.webmanifest`, scope-isolated Service Worker (`sw.js`) precaching, and 100% offline 3D reload. |
| **District Gallery Capture** | `npm run gallery:capture` | Executes `scripts/capture-capygame-gallery.mjs` to capture full-frame screenshots across all 5 districts into `docs/gallery/`. |
| **27-Band Zoom Capture** | `npm run gallery:capture:zoom` | Executes `scripts/capture-all-zoom-levels.mjs` across all 27 logarithmic universe scale bands (`10^+30 m` to `10^-35 m`) into `docs/gallery/zoom_levels/`. |

---

## 2. Comprehensive E2E Assertions (`scripts/test-capygame.mjs`)

`scripts/test-capygame.mjs` launches Chromium with ANGLE/SwiftShader WebGL2 support and verifies:

1. **Compact Single-Line Top Bar, Top-Right Fullscreen & Bottom-Right 3-Button Speed / Spiral Controls**: Asserts `unified-top-bar` (`40px` height at `y = 0`), visible top-right `toggle-fullscreen-btn`, clean bottom-right `Straight`/`Spiral` toggle + 3 speed buttons (`Rewind`, `Play/Pause`, `Fast Forward`) with zero sliders or duplicate throttle bars, `360 deg` (`2*pi rad`) spiral sweep per zoom band, `390px` mobile horizontal fit (`right <= 390`), and mutually exclusive top-anchored dropdowns.
2. **Cosmic Genesis, Multi-Star Selection & Astrophysical Shaders**: Verifies singularity ignition, N-Body/SPH galaxy formation, supernova nucleosynthesis, non-zero star-system selection (`Sirius Cyan-B` and `Sol Yuzu Prime`), real-time Keplerian orbital time scales, planetary descent, Capybara hero selection, and zero WebGL shader compilation or validation errors.
3. **Sanctuary Botany, Connected 3D Jumps, Articulated Spine & Foreground Transparency**: Verifies 8 non-overlapping exponential trees (`1.48^tier`), bump-only matching citrus drops, solid `+-6%` PBD spine spacing, vertical `solveSpineVerticalCoupling` body connectivity across normal forward jumps and bounded Mushroom Pad hops, coordinated backward walking across all Dachshund segments, 2-joint foot-contact traction (`isStuckNoFooting` at `0` grounded feet), Home Pool tap washing, interactive raycast building placement ghost, real coin/DNA deductions & Prestige Ascension, dynamic dusk/night cycle, solid side-tree preservation, and standard 3rd-person `4x4` Bayer dither fade (`0.25` uniform ghost silhouette, dissolving to `0.0` near lens) strictly for objects blocking the player corridor or camera lens.
4. **65-Order `1:1` Universe Simulator & Unlockable Cosmic Instruments**: Sweeps all 27 scale bands from `multiverse` (`+30.0`), `big_bang` (`+28.0`), `universe` (`+27.2`), `observable` (`+26.94`), `cosmic_web` (`+25.2`), `filament` (`+24.0`), `supercluster` (`+23.0`), `cluster` (`+22.2`), `galaxy` (`+21.0`), `spiral_arms` (`+19.4`), `nebulas` (`+17.2`), `stellar_systems` (`+12.95`), `planetary_system` (`+8.85`), `planet` (`+7.10`), and `capybara_forest` (`+0.8`) down to `planck_quantum_foam` (`-35.0`), asserting strict `1:1` default scale (`realityScaleGamma === 1.0`), unlockable Object Finder Markers (`object-finder-markers-layer`), and unlockable Reality Rescaler (`0.28..1.00`).
5. **Contiguous World, Far-Hemisphere Capytorio Factory & Rapier3D Wasm Physics**: Walks the Hero Capybara overland between `Sanctuary (0, 0)`, `Spore Lagoon`, open ocean shelf into far-hemisphere `Capytorio Frontier (+1200, 0)` (infinite buildable mineral plains, live `recipe.lua`/`technology.lua` pipelines, mining drills, belts, inserters, foundries, assemblers, science labs, 100% demolish refund), and `Yuzu Mountain`, verifying `@dimforge/rapier3d-compat` worker initialization, yaw-aware swept CCD, dynamic `RevoluteJoint` see-saw torque tilt, XPBD soft-body pad compression/rebound, and `24x24` shallow-water Archimedes buoyancy.
6. **Hardware-Accelerated 3D GPU Engine & AAA VFX Pipeline**: Verifies `HardwareGpuEngine`, `>= 20` Sobel tangent-space PBR `normalMap`/`roughnessMap`/`aoMap` textures across districts, dual-octave clearcoat ocean normals, Hero contact shadow + texel-snapped directional shadow cascade, SoA `InstancedMesh` burst/footstep VFX, GPU bokeh sun-motes/fireflies, crepuscular god-rays, quadratic camera trauma decay, live texture filter/anisotropy/tone-mapping/post-FX profile switching, and zero runtime/console errors.
7. **Seamless Orbit-to-Surface Descent, Capytorio Factorio Overhaul & Privacy Policy**: Verifies unified `CapyGame 3D` About modal branding, embedded `./privacy.html` iframe inside `privacy-policy-modal`, smooth atmospheric sky alpha blending (`uSkyAlpha > 0`) and outer archipelago reveal from orbit, docked Chrono-Vessel landing onto Sanctuary Chrono-Pad, Kinetic Dash (`surface-dash-btn`), airborne Belly-Flop Slam splash (`surface-dive-btn`), Arcade Combo HUD (`arcade-combo-hud`), collapsible 3-slot Archipelago Bounties (`bounties-hud-toggle`), and the **Capytorio Frontier Factorio Overhaul** (`Play Capytorio` CTA beside `Play on Island!`, hidden `stat-coins` / zero CapyCoins, 10-slot Recent-Items Quickbar `capytorio-toolbar`, `[I]` Inventory + tabbed Factorio Crafting drawer `capytorio-drawer-inventory` / `capytorio-drawer-craft`, `[V]` 68-degree Oblique <-> 3D Chase toggle, zoom `+/-`, citrus tree `+3` Fresh Orange mining, Inspect coal feeding `1.5 -> 6.0 MW`, Smart Pipette `[Q]`, Survey Beacon `[H]` recall, Milestone progress badge, and zero mobile overflow).

---

## 3. Continuous Integration Pipeline ([`.github/workflows/deploy-branch.yml`](./.github/workflows/deploy-branch.yml))

1. **Build Job** (`contents: read`): Installs deterministic locked dependencies (`npm ci`), runs `npm run lint`, `npm run test:unit`, and `npm run build` (`tsc -p tsconfig.json --noEmit && vite build`), staging compiled `dist/` artifacts.
2. **Deploy Job** (`pages: write`, `id-token: write`): Publishes PR preview bundles to `/pull/<number>/` and merges on `main` to the GitHub Pages root with squashed orphan `gh-pages` history and strict `actions/deploy-pages@v5` verification.
