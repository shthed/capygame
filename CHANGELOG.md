# Changelog

All notable changes to CapyGame are documented in this file using Semantic Versioning.

## [1.9.0] - 2026-11-28

- Removed the static `#static-boot-shell` loading screen and its frozen progress bar from `index.html` and cleaned up its dismissal hooks in `CapyGameView.tsx` so the application loads straight into the live viewport without a stuck splash overlay.
- Added zero-allocation solid collision resolution (`SurfaceCollisionMath.ts`, wired into `PlayStyleManager.ts`) preventing the player capybara from clipping through the parked UFO hull and solid factory/sanctuary buildings while keeping flat Capytorio transport belts walkable.
- Tightened the parked UFO interaction prompt to trigger strictly when physically touching the saucer rim (`3.35 m` contact radius), replaced the orbital launch action with local-air fast-travel flight (`UfoFlightSequence.ts` `'air_flight'` phase, `TelemetryReadout.tsx` `Board UFO` / `Land UFO` controls), added altitude-scaled WASD, Shift boost, and tap-on-map flight with a live dry-land landing reticle, and allowed landing and reparking the UFO anywhere on clear dry land across the map.
- Extended `UfoFlightSequence.test.ts` and updated `ProgressionAndPhysics.test.ts` to cover solid UFO/building collisions, touching-only UFO boarding, local-air fast-travel flight, landing anywhere, and loading-screen removal.

## [1.8.0] - 2026-11-27

- Added a 5-ring nested GPU planetary surface clipmap (`CapytorioPlanetarySurfaceLayer.ts`, scales 1 through 256 covering 640 m up to 163.84 km) powered by `factorio-mapgen`'s extended multi-scale overview surface evaluator (`_sampleOverviewSurface`) so genuine Factorio Nauvis biomes, razor-sharp coastlines, lakes, forests, and ore fields remain continuously visible edge-to-edge all the way from ground level into high orbit with zero mid-screen cutoff or blocky shorelines.
- Added live factory footprint rasterization into every active clipmap ring plus single-draw-call simplified 3D instanced machine and belt proxies (`CapytorioMeshBuilder.ts`, `CapytorioOrbitalLodMath.ts`) matched 1:1 to Capytorio's daylight 3D palette so factories keep their exact look while shrinking smoothly down to a single pixel at extreme altitude.
- Added two counter-drifting procedural GLSL patchy cloud strata with open sky breaks and smooth camera-proximity lens fade alongside soft Rayleigh daylight atmospheric haze, and aligned `PlayStyleManager.ts`'s orbital globe handoff (`16 km`) and sky-to-space transition (`7 km` to `90 km`) for unbroken continuous zoom from the factory floor through orbit into space.
- Added unit tests in `FactorioMapGen.test.ts` covering continuous 10 m to 234 km LOD coverage, cloud lens fade, multi-scale chunk baking (scales 1..256), and live factory pixel stamping.

## [1.7.0] - 2026-11-27

- Replaced Capytorio's clean-room procedural terrain and resource approximation with the genuine `shthed/factorio-mapgen` Factorio 2.0 Nauvis generator (`src/capygame/engine/capytorio/factorioMapgen/`, bundled in its own lazy-loaded chunk `feature-capytorio-mapgen`), running its built-in WebAssembly SIMD noise engine and 32x32 chunk cache to generate authentic Nauvis terrain tiles, all 6 resources with exact Factorio richness, and all 18 Nauvis tree species with exact 1/16-tile placement and biome-matched canopy palettes.
- Massively expanded Capytorio's 3D visible render distance (up to a 112-tile radius / 225x225 tile view, 8,192 instanced trees, and 8,192 instanced ore deposits) and replaced row-by-row terrain scanning with concentric outward square-ring scanning so forests and ore fields extend symmetrically edge-to-edge without mid-screen clipping.
- Added a zero-allocation FPS-driven adaptive LOD governor (`CapytorioAdaptiveLod.ts`) that renders full unrestricted view distance, fruit accents, and foliage shadows whenever frame rate is healthy and only steps down foliage quality or view distance during sustained low-FPS dips before recovering automatically.
- Updated `FactorioMapGen.test.ts` and `CapytorioFactoryEngine.test.ts` to verify genuine `factorio-mapgen` WASM Nauvis generation, all 6 resources, tree species detail, and adaptive FPS throttling/recovery.

## [1.6.1] - 2026-11-27

- Fixed Capytorio ore patches overlapping into mixed-resource blobs by replacing the 6 independent colliding resource grids in `CapytorioTerrainGen.ts` with a unified non-overlapping macro-cell spot allocator that assigns at most one resource deposit per region, enforces a 2-tile neutral meadow moat between different resource types, shapes veins with organic 2-octave anisotropic distortion, spaces Crude Oil wells at least 3 tiles apart for 3x3 Pumpjacks, and pushes outer Crude Oil and Uranium Ore cleanly outside the starter clearing.
- Fixed ore patches visually bleeding onto coastal water by adding a 2-tile dry shoreline buffer to `sampleCapytorioBaseResource` and doubling `CapytorioMeshBuilder.ts` terrain deck vertex resolution (`TERRAIN_DECK_SEGS = 128`, 1 tile per segment) for crisp tile-aligned coastlines, while modulating 3D ore plate and crystal scale by tile richness with natural per-tile jitter.
- Added automated spatial purity, shoreline buffer, starter-clearance, and Pumpjack well-spacing regression tests to `FactorioMapGen.test.ts`.

## [1.6.0] - 2026-11-27

- Integrated a seeded Factorio-style procedural world generator directly into Capytorio's live 3D terrain (`CapytorioTerrainGen.ts` and `CapytorioMeshBuilder.ts`), featuring deterministic Taus88 PRNG noise, five land biomes (Lush Meadow, Meadow Grass, Arid Dirt, Golden Sand, and Red Desert), four water depth tiers, and five world presets (Default, Rich Resources, Rail World, Island, and Desert Frontier) that rebuild the 3D terrain immediately when changed.
- Added a clean MIT-licensed binary Factorio 1.1 / 2.0 / 2.1 map exchange string (`>>>...<<<`) and numeric seed codec (`FactorioMapExchangeCodec.ts`) plus a non-obstructive docked `World` generator drawer (`CapytorioWorldGenDrawer.tsx`) with live instant 3D terrain switching on fresh fields and a backup-first confirmation prompt before replacing an existing factory.
- Implemented the full 6-resource Factorio Nauvis resource suite (`Iron Ore`, `Copper Ore`, `Coal`, `Stone`, `Crude Oil`, and `Uranium Ore`) across terrain generation, 3D resource rendering, Lua recipes/technologies, `Capytoriopedia`, and factory simulation, including `Pumpjack` oil extraction, `Solid Fuel` refining, `Centrifuge` uranium enrichment, and `Uranium Fuel Cell` power generation.
- Upgraded Capytorio saves to schema `version: 2` with full `mapGen` persistence (`CapytorioStateGuard.ts`, `CapytorioSerializer.ts`), removed legacy v1 Capytorio save support, and added the `FactorioMapGen.test.ts` unit test suite.

## [1.5.2] - 2026-11-27

- Updated the browser window title, OpenGraph title, and Apple web app title in `index.html` to `CapyBoop Game`.
- Fixed the mobile Capytorio HUD button layout so bottom quickbar item slots and labeled command buttons (`Rotate`, `Inspect`, `Inv`, `Craft`, `Copy`) reflow cleanly into two unclipped rows on narrow screens, removed duplicate bottom safe-area padding on `.hud-safe-quickbar`, raised the `+` / `-` zoom controls, crafting queue, blueprint clipboard bar, and UFO prompt cleanly above the quickbar with safe-area insets across all modes, and moved the top-right entity info panel below the `Tech` and `Capytoriopedia` buttons so they never overlap.

## [1.5.1] - 2026-11-27

- Added a standalone Terms of Service page at `public/terms.html` (served at `https://capyboop.com/terms.html`) matching the dark styling and concise tone of `public/privacy.html`, covering free client-side zero-server operation, local saves and user-initiated Google Drive (`drive.file` / `CapyGame-Cloud-Save.json`) and Google Play Games backups, player ownership of saves and creations, acceptable use, and an "as-is" warranty disclaimer with links to `./`, `./privacy.html`, and `https://github.com/capyboop/capygame/issues`.
- Added cross-links to Terms of Service in `public/privacy.html`, added an embedded `CapyTermsModal` viewer alongside `CapyPrivacyModal` in the in-game About and Settings modals (both Basic and Advanced views), precached `./terms.html` in `public/sw.js`, added `/terms.html` cache headers in `public/_headers`, and validated `terms.html` in `scripts/verify-playstore-readiness.mjs` and unit tests.

## [1.5.0] - 2026-11-27

- Overhauled the procedural Web Audio engine in `AudioService.ts` and pure DSP module `AudioSynthesisMath.ts` with a 3-bus studio architecture (independent `musicBus`, `sfxBus`, and `uiBus` routed through a warm master low-pass polish filter, dynamics compressor, and damped stereo reverb), perceptual `x^1.75` volume curves, subtle pitch humanization, and per-voice anti-spam cooldowns.
- Replaced harsh unfiltered sine/triangle boop effects across all three modes: replaced the repetitive background marimba loop with mode-aware soundscapes (a scale-mapped celestial cosmic drone in Infinite Zoom, sparse warm Lydian fifth/octave Forest plucks, and industrial hum in Capytorio), replaced ~30 UI button `playCoin()` chimes and mode-switch `playJump()` boings with subtle wooden `playUiClick()` micro-taps, and resculpted jump, pickup, cosmic warp, brick, trampoline, and fanfare envelopes.
- Added persistent independent Audio Mixer controls (Master Volume, Sound Effects, Ambient Music sliders, Subtle UI Clicks toggle, and a Preview Test trigger) to both Basic and Advanced views in `CapySettingsModal.tsx`, synced automatically with `ProgressionService` save bundles (`capygame-save-bundle-v2`).
- Split the monolithic Capytorio Vite bundle into three on-demand chunks (`feature-capytorio-sim`, `feature-capytorio-3d`, and `feature-capytorio-hud`), enforced a strict `<= 500 KB` per-chunk budget guard in `scripts/verify-playstore-readiness.mjs`, and added `npm run verify:playstore` plus npm dependency caching to GitHub Actions CI workflows.
- Extracted pure, zero-Three.js domain modules (`AudioSynthesisMath.ts`, `ForestPlacementMath.ts`, `CapytorioLogisticsMath.ts`) with three new `node:test` unit suites, eliminated `THREE.Vector3` allocations inside `PlayStyleManager.switchMode()`, and added the `CapyWebGlContextBanner` recovery overlay for `webglcontextlost`/`webglcontextrestored` events.

## [1.4.2] - 2026-11-27

- Updated `public/_headers` to serve `Cross-Origin-Opener-Policy: same-origin-allow-popups` and removed `Cross-Origin-Embedder-Policy: require-corp` so Google Identity Services sign-in popups return tokens cleanly and Google profile avatars load without CORP blocking (Rapier3D physics falls back automatically to zero-copy transferable `Float32Array` buffers), and synchronized header assertions in `ProgressionAndPhysics.test.ts` plus `TODO.md` and `docs/ANDROID_PLAY_STORE.md`.
- Fixed embedded preview iframe focus handoff so players can click directly from CapyGame back into a host page text input without getting focus-trapped: removed `document.activeElement.blur()` from the `window` blur handler (preventing Chromium OOPIF focus bounce), disabled native pointer lock, mouse `setPointerCapture`, and top-level `history.pushState`/`history.back` sentinels inside embedded iframes, and added `lostpointercapture` plus `window` `pointerup`/`pointercancel` drag cleanup.
- Fixed the first-interaction freeze when clicking or scrolling inside an embedded preview iframe by separating lightweight soft focus-suspension (`resolveSuspensionMode` -> `'soft'`, keeping WebGL2 `EffectComposer` FBOs and the Rapier3D worker warm) from deep pause (`'deep'` on manual pause or hidden tab), waking the animation loop immediately on the first `pointerdown`, and rendering an immediate frame on wheel zoom while background-suspended.

## [1.4.1] - 2026-11-27

- Removed the Firebase SDK dependency and client config file, switching Google Drive cloud save sync in `CloudSyncService.ts` to direct, lazy-loaded Google Identity Services (GIS) OAuth configured via the public `VITE_GOOGLE_CLIENT_ID` environment variable (zero Firebase SDK, zero Google API keys, strict in-memory OAuth token caching with revoke on sign-out, and graceful offline fallback when unset).
- Removed the unused `vendor-firebase` Vite chunk and `optimizeDeps` entries, added a cold-boot guard in `scripts/verify-playstore-readiness.mjs` ensuring `dist/index.html` never eagerly loads `accounts.google.com/gsi/client`, and wired `VITE_GOOGLE_CLIENT_ID` from GitHub Actions repository variables into `deploy-branch.yml` and `deploy-cloudflare.yml`.
- Added `.gitignore` and release-export exclusion guards for local OAuth/config files, updated unit tests in `SaveAndCloudSync.test.ts` to verify configured vs. empty client ID handling, and updated `docs/ANDROID_PLAY_STORE.md`, `TODO.md`, `GAME.md`, `TESTING.md`, and `README.md`.

## [1.4.0] - 2026-11-26

- Restored lazy cold-boot loading of `vendor-three` and `feature-universe` by isolating pure shared non-Three modules (`types.ts`, `UniverseScaleMath.ts`, `GameplayFunMath.ts`, `forestMicroSpecimens.ts`, `ProceduralGameConfig.ts`, `appVersion.ts`, and `CapytorioStateGuard.ts`) into a lightweight `capy-shared-core` Vite chunk so `dist/index.html` never eagerly preloads 3D or factory chunks.
- Fixed Forest Micro-Glade opacity crossfade and specimen syncing after lazy loading by updating `layer.materials = this.collectLayerMaterials(group)` and calling `diorama.setActiveSpecimen(this.activeForestSpecimenId)` inside the async `ForestMicroDioramaBuilder` import callback in `SeamlessUniverseSimulator.ts`.
- Upgraded save portability to full-profile `capygame-save-bundle-v2` (progress, Capytorio factory, simulation settings, procedural world seeds/presets, Yuzu Mountain parkour personal-best ghost replay, and timestamps, with full backward compatibility for v1/raw JSON) and surfaced Save Backup & Cloud Sync in both Basic and Advanced Settings with drag-and-drop JSON import and side-by-side preview confirmation.
- Added live client-side Google Drive cloud save sync in `FirebaseDriveAuth.ts` and `CloudSyncService.ts` (lazy-loaded Firebase Auth popup + Google Drive v3 `drive.file` backup with strict in-memory token caching and explicit side-by-side overwrite/restore/delete confirmation) plus automatic detection of a native Android Google Play Games Services v2 bridge in `NativeBridge.ts`.
- Expanded Google Play Store release readiness with Play Store home-screen shortcuts and `related_applications` in `public/manifest.webmanifest` and `twa-manifest.json`, updated `public/privacy.html` and `docs/ANDROID_PLAY_STORE.md` (Play Games v2 bridge setup and Data Safety table), and added the automated `npm run verify:playstore` preflight check.

## [1.3.0] - 2026-11-26

- Split all 6 Forest Games 3D district builders (`buildSharedArchipelagoBase`, `buildSelectableCapyHeroCircle`, `buildSanctuary`, `buildSporeWorld`, `initRunnerPools`/`spawnRunnerTrackSegment`, and `initFallGuysArena`) out of `PlayStyleManager.ts` into an on-demand async `ForestDistrictBuilders.ts` chunk, lazy-loaded `ForestMicroDioramaBuilder.ts` only when zooming into micro scale, and isolated `SeamlessUniverseSimulator` + `UniverseShaders` into a dedicated `feature-universe` Vite chunk so `PlayStyleManager` stays well under Vite's 500 KB chunk budget.
- Added Android hardware Back button dismissal via a lightweight `history.pushState`/`popstate` modal sentinel and optional Capacitor `backButton` listener in `NativeBridge.ts` so pressing Back closes open modals and drawers cleanly before exiting.
- Applied display cutout and gesture-bar safe-area inset classes (`hud-safe-top`, `hud-safe-bottom`, `hud-safe-bottom-left`, `hud-safe-bottom-right`, `hud-safe-flight-panel`, `hud-safe-quickbar`) across `CapyGameView`, `TelemetryReadout`, and `CapytorioQuickbar`.
- Added Google Play TWA packaging scaffolding (`public/.well-known/assetlinks.json`, `twa-manifest.json`, and `docs/ANDROID_PLAY_STORE.md`), updated `public/manifest.webmanifest` screenshot labels, refreshed all 4 store screenshots from the live `v1.3.0` build, removed obsolete `docs/gallery/capygame_breakout.png`, aligned `scripts/test-capygame.mjs` with `v1.3.0` async chunks and 3-mode shortcuts, and synchronized `TODO.md`, `GAME.md`, `TESTING.md`, and `README.md`.

## [1.2.10] - 2026-11-26

- Trimmed 755 KB of 512px PWA install icons (`icon-512.png` and `icon-maskable-512.png`) from the Service Worker background precache list in `public/sw.js` while keeping `favicon.svg`, `icon-192.png`, and `apple-touch-icon.png` precached.
- Moved periodic Capytorio factory autosave serialization off the animation frame into `requestIdleCallback` (with a `setTimeout` fallback) to eliminate frame hitches on large factories, while keeping explicit flushes on mode switch, pause, UFO launch, and unload synchronous.
- Extracted the Settings Modal, Performance Diagnostics & Debug Report Modal, First-Run Chrono-Genesis Setup Modal, and secondary cold-boot-invisible panels out of `CapyGameView` into `React.lazy()` components so the initial `index.js` bundle drops cleanly below 250 KB raw.
- Dynamically imported and instantiated the legacy `CosmicUniverseBuilder` only when a legacy cosmic stage is activated, removing it from cold-boot loading and initialization.
- Replaced the stale `"Orbital Skydive"` bounty in Forest Games with `"Orchard Shake"` (wired to shaking ripe fruit from matching Sanctuary citrus trees, with safe migration for existing saved player bounties) and removed the unused `tickCapytorioEcosystemOnly` method from `PlayStyleManager`.

## [1.2.9] - 2026-11-26

- Replaced the monolithic synchronous surface world builder with mode-scoped lazy building and incremental background hydration so entering Forest Games builds only the active district immediately and entering Capytorio never builds Forest districts or downloads the 4.24 MB Rapier3D physics worker.
- Switched Forest Games NPC crowds (Sanctuary buddies, Spore critters, Runner mini-capybaras, Fall Guys rivals, and the hero selection circle) to lean NPC LOD tiers while keeping the player Hero Capybara at full LOD, and hid distant inactive district NPC herds while keeping unified island landmarks visible.
- Eliminated Infinite Zoom band-jump and mode-return click-handler freezes by avoiding synchronous double-rendering while the animation loop is active, warming one universe scale layer per idle slice, and replacing synchronous occluder `renderer.compile()` with async compilation.
- Guarded Capytorio's automatic live `.lua` HTTP fetches behind development mode and enforced `NODE_ENV=production` during `vite build` so production bundles always ship optimized production React and skip redundant `.lua` network requests.
- Code-split the About/Tutorials and Procedural JSON Config Editor modals out of `CapyGameView` using `React.lazy()` to reduce the initial boot bundle.

## [1.2.8] - 2026-11-26

- Restored lazy loading of the Three.js renderer and Capytorio chunks by isolating `FocusGuard.ts` into its own lightweight shared chunk so initial page load no longer eagerly preloads 1.37 MB of 3D and factory bundles.
- Removed the obsolete throwaway WebGL2 probe canvas at startup and switched to single-context software WebGL detection directly on `PlayStyleManager`'s `THREE.WebGLRenderer`.
- Replaced the 551 KB WebP favicon with a tiny SVG favicon (`assets/favicon.svg`), removed `capybara.webp` from Service Worker precaching, moved `#static-boot-shell` outside `#root` and tucked it behind the canvas on Frame 1 to lock LCP, and fixed Cloudflare Pages `_headers` immutable cache overrides with `! Cache-Control`.
- Fixed mobile top-bar overlap and crowding across Infinite Zoom, Forest Games, and Capytorio: removed the colliding secondary `"Stopped"`/scale pill and squished duplicate `Capy Island` button on phones, hid `Mute` and `Fullscreen` below `md` widths, and removed duplicate `Pause`, `Help`, `Settings`, and `Menu` buttons from Capytorio's secondary top-right bar.

## [1.2.7] - 2026-11-26

- Removed unrealistic bright glowing bloom halos caused by specular highlight reflections off shiny glass, metal, and water surfaces.
- Replaced the unclamped bloom high-pass filter with a specular-safe threshold and firefly clamp, attenuated extreme HDR studio lightboxes in the environment reflection map, and removed artificial mirror-clearcoat spikes from the UFO canopy, metallic trim, and water surfaces.

## [1.2.6] - 2026-11-26

- Updated the Infinite Zoom bottom status bar to display the active zoom level name and scale cleanly in both Basic and Advanced modes.
- Removed the unneeded Chase Pod 3P toggle row from the bottom status bar.
- Restored direct Forest and Capytorio quick-skip buttons in the bottom bar so players can jump straight into either game in one tap without overlapping the flight controls.

## [1.2.5] - 2026-11-26

- Fixed a crash when toggling the Spiral / Straight flight button or changing settings during Infinite Zoom startup before entering Forest Games (`updateBioluminescentNightGlow` now safely guards the lazily constructed Capybara mesh).
- Made all runtime, startup, and WebGL error recovery screens text-selectable and added one-tap Copy Error buttons with iframe-safe clipboard fallbacks.
- Prevented CapyGame from stealing input focus, intercepting keystrokes, or keeping heavy background 3D loops active when unfocused or running in an embedded preview pane alongside another window or chat input.
- Hardened keyboard, pointer capture, pointer lock, and Capytorio search-input focus handlers to strictly verify active window focus and visibility before running, and to release focus cleanly when blurred.

## [1.2.4] - 2026-11-26

- Renamed "CapyGame 3D" to "CapyGame" across the boot screen, browser title, web app manifest, About and Privacy Policy pages, error fallback, and performance reports.

## [1.2.3] - 2026-11-26

- Standardized CapyGame's 3D renderer cleanly on WebGL2 across desktop and mobile, removing the experimental WebGPU backend so Infinite Zoom's cosmic shaders, multiverse bubbles, nebulae, and lighting render identically everywhere with zero placeholder stripes or bloom streaks.
- Removed the unused WebGPU bundle chunks and backend switcher from Settings while keeping older saved settings compatible by normalizing any prior GPU backend choice to WebGL2 automatically.
- Fixed the bottom-right Infinite Zoom HUD overlap on medium desktop viewports so the flight info strip and speed controls always stay cleanly separated across phone, tablet, and desktop widths.

## [1.2.2] - 2026-11-26

- Toned down reflective metal glare across Capytorio machines, belts, brass gears, and copper coils with brushed satin finishes, riveted enamel casings, deeper ribbed rubber belt treads, richer organic meadow turf textures, and warmer, higher-contrast sunlight and sky reflections.
- Replaced text labels on top of Capytorio buildings in Alt-Mode with crisp item, machine, and alert icons so you can see what each building is crafting or filtering at a glance.
- Removed the text labels from Capytorio's top-left Undo and Redo buttons so they display compact arrow icons only, freeing horizontal space on mobile screens.

## [1.2.1] - 2026-11-26

- Polished Infinite Zoom transitions from Planet down to DNA by grounding the Forest Glade clearing and overlapping it smoothly into Leaf & Fur with zero empty gaps.
- Dissolved the cell nucleus sphere smoothly before the camera reaches its shell and added a luminous Chromatin Fiber and Nucleosome transition layer bridging Biological Cells into the DNA Helix.
- Tightened Planet, Atmosphere, Land Masses, and Ecosystems crossfades so at most two terrain or cloud layers overlap at once in Infinite Zoom while preserving Capytorio's full orbital planet descent.
- Lowered material depth-write fade cutoffs, harmonized sky transitions with smoothstep easing, replaced the sudden camera pitch floor snap with a continuous smoothstep ramp, and added adaptive auto-zoom pacing across wide inter-band spans.

## [1.2.0] - 2026-11-26

- Separated CapyGame into three standalone modes with a top-bar switcher (**Infinite Zoom**, **Forest Games**, and **Capytorio**) so only the active game's 3D world, sky, lighting, and HUD are shown at once.
- Made Infinite Zoom a pure, continuous zoom experience from Multiverse down to Planck scale with no playable Forest landing detour and no Forest islands, ocean, weather, or surface UI bleeding into the view.
- Unified the four Forest mini-games (Sanctuary, Spore Lagoon, Number Stampede, and Yuzu Mountain) onto one bridge-free island connected by meadow footpaths, with camera zoom clamped to comfortable playable distances so scrolling out never accidentally launches Infinite Zoom.
- Isolated Capytorio as a standalone factory mode while preserving its parked UFO, boarding, liftoff, and orbital landing sequence, pausing the factory simulation, flushing pending factory autosaves, and muting factory ambient audio whenever switching to Infinite Zoom or Forest Games.
- Updated interactive tutorials to launch cleanly into their matching standalone game and moved Capytorio clipboard move-mode side effects out of the React state updater.

## [1.1.2] - 2026-11-25

- Enabled moving freely across the Capytorio factory while Copy, Cut, or Paste blueprint mode is active via dragging anywhere outside the ghost footprint, right/middle-click dragging, holding Space while dragging, using WASD/Arrow keys, or toggling the new Move button in the clipboard bar.
- Updated Capytorio blueprint ghost tracking so the ready-to-paste ghost travels smoothly with your cursor or Capybara as you walk to a new location and automatically unlocks distant anchors when moving across the factory.

## [1.1.1] - 2026-11-25

- Added an instant inline-styled boot shell in `index.html` with a matching non-blocking overlay that clears on Frame 1, giving immediate Largest Contentful Paint without layout shift.
- Split `PlayStyleManager` and `three` out of the initial entry bundle by extracting `getPresetPatchForGpuQuality` into `GpuEngineTypes.ts` and dynamically loading the 3D engine after first paint.
- Eliminated synchronous cold-boot stalls by lazily building the Alpine mountain heightfield PBR mesh on demand or during idle time, disabling WebGL shader error checks outside development, and replacing constructor `compile()` calls with post-paint `compileAsync()`.
- Cached viewport dimensions inside `PlayStyleManager` to remove per-frame `clientWidth`/`clientHeight` layout reads, enabled Service Worker `navigationPreload` in `public/sw.js`, and moved tutorial completion toast dispatch out of the React state updater.

## [1.1.0] - 2026-11-25

- Renamed the overview modal to "About CapyGame" with the live application version (`v1.1.0`) shown in the header and removed "System Architecture" and "Surface Sectors" (`4536578`).
- Added interactive tutorial launchers from the Help / About modal for Cosmic Flight, Capy Island & Capy-Snake, Capytorio Factory, and Pilot & Spaceship Setup with a non-blocking step banner (`Prev`, `Next`, `All Tutorials`, and `Finish`) (`4536578`).
- Made the Help button easy to reach from Basic and Advanced top bars, the collapsed top-right corner, Settings, Adventure Guide, and the Capytorio toolbar (`4536578`).
- Added the SemVer + `CHANGELOG.md` workflow rule to `AGENTS.md` and synced `package.json`, `package-lock.json`, and `vite.config.ts` (`4536578`).

## [1.0.0] - 2026-11-25

Initial `1.0.0` development history spanning `2026-11-10` through `2026-11-25` prior to adopting incremental SemVer releases.

### 2026-11-25

- Restored clean `npm ci` lockfile sync, simplified unit test execution, fixed the Capytorio integrity percentage readout and repair tooltip, disposed `InstancedMesh` GPU buffers, and tightened Service Worker and error boundary origin isolation (`4fff42d`).
- Added deployment safeguards, security headers, and engine/physics/UI hardening across the codebase (`433059c`).
- Fixed 1-frame UFO touchdown camera/hero pops, aligned Capytorio orbital fade curves, optimized camera handling and audio state transitions, and removed oversized debug media (`122f2de`).
- Optimized scene rendering and culling specifically for Capytorio factory mode (`cac52dd`).

### 2026-11-24

- Added the UFO boarding and orbital flight launch/landing sequence between surface worlds and space (`624f890`).
- Implemented the crisp Alt-Mode overlay layer displaying recipes and machine icons in Capytorio (`f3f0a70`).
- Normalized triangle winding for curved transport belts so belt geometry renders right-side-out (`ac7514b`).
- Optimized development server configuration (`f587f0b`).
- Added the steam turbine machine and expanded entity icon variants (`7fa5e6c`).
- Optimized Service Worker caching and lazy-loaded heavy UI panels (`0b01a6f`).
- Optimized terrain rendering performance and HUD telemetry updates (`b26f3ad`).
- Ignored the `.aistudio` directory in git (`ea2ebff`).
- Cleaned up Capytorio engine internals and UI assets (`cb4fd7a`).
- Cleaned up shader warmup state and optimized dependencies (`32ed210`).
- Added Factorio blueprint string import and export support to Capytorio (`c69ef3f`).

### 2026-11-23

- Enabled GitHub Pages auto-deploy on `capyboop/capygame` and guarded build artifact propagation (#7) (`086df33`).
- Added offshore pump support for Capytorio and refined dev server config (`666d48b`).
- Updated 3rd-person sightline occlusion to smooth `4x4` screen-space Bayer dither transparency (`0f4a0d7`).
- Switched sightline occlusion to a focused play-area cutout corridor (`d07b164`).
- Added public community docs, issue/PR templates, and clean-room replay workflow for `capyboop/capygame` (#6) (`d9afb09`).
- Implemented custom Capytorio hover tooltips and optimized cosmic initialization (`69d5464`).

### 2026-11-22

- Implemented entity settings copy and paste across Capytorio factory machines (`4c9b7d6`).
- Added the built-in Capytoriopedia (`Pedia`) reference system (`e52b08e`).
- Added support for partial blueprint pasting when some tiles are obstructed (`e9e93e2`).
- Added clipboard copy and cut selection tools for factory layouts (`42eb77b`).
- Implemented interactive box and lasso clipboard selection controls (`72b4742`).
- Added tile hover previews and machine inspection state in Capytorio (`c990705`).

### 2026-11-21

- Extracted the Capytorio interface into a dedicated `CapytorioHud` component (`04bf89a`).
- Updated Cloudflare Worker routing to redirect `capyboop.com/paint` and `paint.capyboop.com` straight to `capypaint.com` (#5) (`27478a0`).

### 2026-11-19

- Added Cloudflare Worker redirect from `capyboop.com/paint` to `paint.capyboop.com` (#4) (`75c1a7d`).
- Implemented the dual-lane transport belt simulation and distinct 3D item shapes (`8185fc9`).
- Configured Cloudflare Worker deployment for `capyboop.com` (#3) (`5114f04`).

### 2026-11-18

- Implemented mobile zoom controls and smooth orbit-to-surface transitions (`fa2e6ca`).
- Refined the Capytorio UI, pocket crafting workflow, and HUD responsiveness (`68ebd75`).
- Updated cosmic Playwright tests to use reliable click interactions (`73f8318`).

### 2026-11-17

- Added the Capytorio Lua data integration layer for Factorio-compatible recipes and technologies (`41f78bb`).
- Added orbital/surface gameplay math helpers and updated store metadata (`1a9574c`).

### 2026-11-16

- Persisted the player's Straight vs. Spiral flight trajectory preference in settings (`575b7c2`).
- Set curved 360-degree Spiral flight as the default space trajectory (`207a875`).
- Refactored spaceship cruise control physics for smooth momentum-damped flight (`b80afaa`).
- Replaced the space speed slider with compact 3-button media transport controls (`Rewind`, `Play/Pause`, `Fast Forward`) (`9b4968d`).
- Updated hero starting positions and tuned jump physics in tests (`43bd6a9`).

### 2026-11-15

- Added fullscreen toggle support and vertical spine physics coupling (`49ea9b4`).
- Implemented Dachshund Capy-Snake hybrid body mechanics and orange trail growth (`7e13347`).
- Updated world scale parameters and Play Store roadmap documentation (`140a5cd`).
- Added `UniverseScaleMath` utilities and expanded the unit test suite (`9c8f0a9`).
- Updated E2E test coverage and improved PWA offline cache resilience (`1229827`).
- Merged pull request #2 (`shthed/docs/drop-3d-branding`) dropping the `3D` suffix across docs (`2b2f08b`).
- Merged pull request #1 (`shthed/antigravity/capyboop-mirror-and-ci`) setting up the public mirror and CI (`683ab10`).
- Dropped the `3D` suffix from CapyGame repository documentation (`ad2f23c`).
- Added the Forest Micro-Diorama glade system (`10^-2 m`) with 11 randomized specimens (`9218c9f`).

### 2026-11-14

- Configured the clean-room `capyboop` mirror and hardened CI workflows (`6bb73cc`).
- Added kid-friendly Basic Mode and automated scale-band thumbnail captures (`e36edf9`).
- Implemented the Yuzu Mountain ghost recording and playback system (`4a36345`).
- Configured Cloudflare Pages deployment pipeline (`e87b664`).
- Implemented low-memory mode to bound GPU texture and buffer footprint (`d7c1925`).
- Implemented `O(1)` hidden-subtree scene matrix culling and WebGPU optimizations (`1404b95`).
- Updated the application favicon (`3b1188b`).
- Added desktop/iframe mouselook camera controls and configurable sensitivity/inversion settings (`6aaa597`).

### 2026-11-13

- Expanded universe zoom scale documentation and updated the project roadmap (`0406b46`).
- Integrated native WebGPU initialization and Three.js Shading Language (TSL) pipelines (`97b4710`).
- Added the Chrono-Vessel spacecraft rig and Chrono-Genesis pilot/universe setup configurator (`bdd094c`).

### 2026-11-12

- Implemented whole-screen sightline clearing for unobstructed 3rd-person visibility (`74c0a5b`).
- Implemented localized sightline occlusion fading (`8d3cda4`).
- Added automated unit testing, updated helper scripts, and synced docs (`0083a36`).
- Implemented the unified stellar system architecture for continuous cosmic zooming (`1892f0b`).
- Flattened the repository directory structure to the project root (`cefcc16`).

### 2026-11-10

- Removed Android APK build steps from the web deployment workflow (`228c96a`).
- Improved robustness of the Android build pipeline step (`b19e0f6`).
- Updated application configuration and build pipeline scripts (`e68e13e`).
- Expanded CapyGame with DNA evolution traits and Sanctuary building placement (`3323d36`).
- Added GitHub Actions automation for cleaning up stale branches and PR previews (`50ab5a9`).
- Initial commit establishing the CapyGame 3D universe simulator and archipelago (`af29e1e`).
