# Changelog

All notable changes to CapyGame are documented in this file using Semantic Versioning.

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
