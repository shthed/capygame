# Technical Architecture & Engine Reference: CapyGame

This document details the architecture, multi-scale astrophysical simulation, contiguous multiphysics engine, hardware-accelerated GPU rendering pipeline, and persistent settings of **CapyGame** (`src/`).

---

## 1. Directory & Module Structure

| Path | Responsibility |
| :--- | :--- |
| `src/App.tsx` | Minimal root React component mounting `CapyGameView`. |
| `src/main.tsx` | React 19 entry point wrapping `App` in `AppErrorBoundary` and initializing `PwaService`. |
| `src/components/AppErrorBoundary.tsx` | Diagnostic crash and WebGL recovery boundary with cache-reset controls. |
| `src/services/NativeBridge.ts` | Web vibration haptics (`navigator.vibrate`), `history.pushState`/`popstate` Android hardware Back sentinel, optional Capacitor `backButton` modal dismissal, and typed Android Google Play Games Services v2 bridge interfaces (`CapyPlayGamesBridge` / `Capacitor.Plugins.PlayGames`). |
| `src/services/PwaService.ts` | Offline Service Worker registration (`./sw.js`) and PWA install prompt lifecycle. |
| `src/capygame/types.ts` | Scale band definitions (`UNIVERSE_SCALE_BANDS`), `PlayStyle` zones, `CapyGameSettings`, `ChronoVesselViewMode`, `PlayerStats`, and mutation/building catalogs. |
| `src/capygame/config/appVersion.ts` | Build-time version helper injecting `package.json` SemVer via Vite (`__CAPYGAME_VERSION__`) and formatting `vX.Y.Z` labels. |
| `src/capygame/config/ProceduralGameConfig.ts` | Deterministic `mulberry32` seed PRNG, Fine-Structure Constant ($\alpha^{-1}$) physics solver (`computeFineStructurePhysics`), validated full-game JSON schema, 5 presets, `capy_game_procedural_config_v1`, and `capy_game_onboarding_v1` persistence. |
| `src/capygame/components/CapyGameView.tsx` | Single `40px` (`h-10`) safe-area-aware top HUD (`unified-top-bar`) with 3-mode switcher (`Infinite Zoom`, `Forest Games`, `Capytorio`), post-paint lazy `PlayStyleManager` loader with zero-CLS boot shell, and `React.lazy` code-split modals (`CapyAboutModal`, `CapyJsonConfigModal`, `CapySettingsModal`, `CapyPerfReportModal`, `CapyFirstRunModal`, `CapytorioPediaView`, `CapytorioEntityInfoPanel`). |
| `src/capygame/components/CapySaveSyncPanel.tsx` | Modular Save Backup & Cloud Sync card embedded in both Basic and Advanced Settings with v2 JSON export/copy/file/drag-and-drop/paste import, Google Drive & Play Games sign-in controls, and side-by-side overwrite/restore/delete confirmation dialogs. |
| `src/capygame/components/CapytorioPediaView.tsx` | Lazy-loaded Capytorio recipe, item, and technology encyclopedia viewer. |
| `src/capygame/components/CapytorioEntityInfoPanel.tsx` | Lazy-loaded interactive Capytorio entity inspector panel (inventory, fuel feeding, recipe selection, power telemetry). |
| `src/capygame/engine/TutorialCatalog.ts` | Plain-English game overview copy and interactive step-by-step tutorial definitions (`Cosmic Scale & Flight`, `Capy Island & Capy-Snake`, `Capytorio Factory`, `Pilot, Ship & Universe Setup`) that launch directly into their matching mode. |
| `src/capygame/engine/ChronoVesselRig.ts` | Future Capybara time-machine Chrono-Vessel (`telescope_first_person`, `landed`), brass chrono-rings, Cherenkov thrusters, and customizable canopy tint & pilot headgear. |
| `src/capygame/engine/UfoFlightSequence.ts` | Deterministic UFO / Orbital Rocket launch and orbital-to-surface flight sequence controller for Capytorio launches. |
| `src/capygame/engine/PlayStyleManager.ts` | Standalone 3-mode orchestrator (`Infinite Zoom`, `Forest Games`, `Capytorio`) with on-demand async imports for `ForestDistrictBuilders.ts`, `CosmicUniverseBuilder.ts`, and Capytorio 3D runtime, clean inactive-mode simulation pausing, idle Capytorio autosave scheduling, fixed pre-allocated VRAM pools, bidirectional PBD spine solver, and 3rd-person Bayer dither sightline transparency. |
| `src/capygame/engine/ForestDistrictBuilders.ts` | On-demand async chunk building the unified Forest island terrain, Sanctuary hub, Home Pool, exponential trees, Hero selection circle, Spore Lagoon pools, Number Stampede track/gates, and Yuzu Mountain parkour arena only when Forest Games is entered. |
| `src/capygame/engine/QuadrupedGaitSolver.ts` | Pure zero-allocation quadruped gait, displacement-locked stride, linear Dachshund growth, 2-joint kinematics, and reverse caboose solver. |
| `src/capygame/engine/YuzuGhostRecorder.ts` | 20 Hz quantized time-trial ghost recorder and shortest-angle interpolator for Yuzu Mountain (`capy_game_yuzu_ghost_v1`). |
| `src/capygame/engine/CapyModelGenerator.ts` | Procedural *Hydrochoerus hydrochaeris* 4-tier 60 FPS LOD meshes, custom fur pigments, mutations, hats, and Sanctuary structures. |
| `src/capygame/engine/RealisticWorldEnvironment.ts` | Rayleigh/Mie sky dome, lazily built 360-degree Alpine mountains (`ensureAlpineMountainsBuilt`), 24-hour solar/lunar cycle, weather, coupled `24x24` `DataTexture` Home Pool, and exponential fruit trees. |
| `src/capygame/engine/CosmicUniverseBuilder.ts` | Lazy-loaded N-Body/SPH galaxy coalescence, supernova nucleosynthesis, and on-demand legacy planetary selection stages (not fetched on cold boot). |
| `src/capygame/engine/SeamlessUniverseSimulator.ts` | Continuous 65-order-of-magnitude (`10^+30 m` to `10^-35 m`) `1:1` scale hierarchy isolated in the `feature-universe` chunk across 27 astrophysical and subatomic bands, monotonic `0.00` to `13.80 Gyr` expansion, smooth Forest Glade -> Leaf/Fur -> Cells -> Chromatin/Nucleosome -> DNA crossfades, selectable galaxy morphologies, $\alpha$-coupled atomic/QED/solar physics, Object Finder Markers, and Reality Rescaler. |
| `src/capygame/engine/ForestMicroDioramaBuilder.ts` | Lazy-loaded procedural storybook sunlit forest glade diorama (`10^-2 m`) fetched only when approaching micro scale, rendering all 11 specimens (`Fur`, `Butterfly`, `Flower`, `Leaf`, `Wood`, `Mushroom`, `Amoeba`, `Bacterial`, `Virus`, `Clay`, `Rock`). |
| `src/capygame/engine/forestMicroSpecimens.ts` | Pure deterministic definitions and random spotlight selector (`pickRandomForestSpecimen`) for all 11 Forest Micro-Glade specimens. |
| `src/capygame/engine/UniverseScaleMath.ts` | Pure smooth flight throttle gear stepping (`stepFlightSpeedGear`, `clampForwardFlightSpeed`), realistic astronomical/physical scale formatting (`formatRealisticScaleMeters`), and Micro-Glade specimen sanitization/merging. |
| `src/capygame/engine/GameplayFunMath.ts` | Pure deterministic orbital surface blend curves (`computeOrbitalSurfaceBlend`, `computeDescentApproachDampingFactor`, `computeContinuousDescentCamRadius`), `6` Orbital Skydiving Descent Ring specs, zero-allocation Arcade Combo Multiplier & Yuzu Fever decay math, and 3-slot Archipelago Bounty rotation logic. |
| `src/capygame/engine/CapytorioData.ts` | Canonical Factorio `recipe.lua` (`78` recipes) + `technology.lua` (`25` technologies) integration layer (`CapytorioLuaParser.ts`), `44` placeable Factorio entities mapped to tiered machine variants, starter kit definitions, and runtime `.lua` hot-reload support. |
| `src/capygame/engine/CapytorioLuaParser.ts` | Standalone zero-dependency parser for Factorio `data:extend` `recipe.lua` and `technology.lua` tables (`public/data/capytorio/*.lua`) supporting `subgroup` crafting tabs and external user mods at runtime and build time. |
| `src/capygame/engine/CapytorioFactoryEngine.ts` | Deterministic Capytorio factory simulation engine handling infinite `16x16` mineral chunks, harvestable orange citrus trees, tiered Drills/Belts/Splitters/Tunnels/Inserters/Furnaces/Assemblers/Generators/Labs, blueprint copy/paste, belt momentum gliding, `10`-slot Recent-Items Quickbar MRU tracking, and 100% demolish refunds. |
| `src/capygame/engine/CapytorioMeshBuilder.ts` | Pooled Three.js 3D factory renderer (`Capytorio3DRenderer`) with brushed satin PBR metals, riveted enamel casings, rich meadow turf, Alt-Mode icon sprites above buildings, instanced citrus trees/belts/items, and Drop-Pod Surveyor beacon. |
| `src/capygame/engine/UniverseShaders.ts` | Flux-conserving PSF stars, Hubble narrowband/natural volumetric nebulae, spiral galaxies, and Rayleigh planetary atmospheres. |
| `src/capygame/engine/gpu/GpuEngineTypes.ts` | Shared zero-`three`-import GPU preset, filter, and telemetry types used by the initial React shell before lazy-loading the 3D engine. |
| `src/capygame/engine/gpu/HardwareGpuEngine.ts` | Standardized WebGL2 rendering orchestrator with PMREM IBL, 3-point lighting, `84 m` azimuth-invariant texel-snapped Hero shadow cascade, frustum culling, volumetric crepuscular light shafts, HDR bloom, smooth `C^1` Depth-SSAO, CAS sharpening, and FXAA. |
| `src/capygame/engine/gpu/WebGl2PostProcessing.ts` | Dedicated WebGL2 `EffectComposer`, `HalfFloatType` render target, `UnrealBloomPass`, fused master filter shader, `OutputPass`, and `FXAAShader` assembly. |
| `src/capygame/engine/gpu/GpuCullingAndClusterMath.ts` | Zero-allocation CPU frustum plane extraction, indirect draw batch packing, `16x9x24` light clustering, shallow-water wake parameters, and crepuscular shaft projection helpers. |
| `src/capygame/engine/gpu/FramePerformanceGovernor.ts` | Pure zero-allocation 60 FPS governor computing WebGL2 preset DPR caps, half-resolution bloom scales, distant district tick strides, occluder `depthWrite` restoration, and azimuth-invariant texel-snapped shadow origins. |
| `src/capygame/engine/gpu/PbrTextureSynthesizer.ts` | Seamless Sobel tangent-space `normalMap`, `roughnessMap`, and Laplacian `aoMap` synthesis across all districts and live texture filter switching. |
| `src/capygame/engine/gpu/AaaWorldVfxEngine.ts` | Zero-allocation Structure-of-Arrays `InstancedMesh` burst/footstep particles (with idle burst early-exit), GPU bokeh sun-motes/fireflies, and solar crepuscular god-rays. |
| `src/capygame/engine/gpu/ThreeDisposal.ts` | WebGL subtree geometry, material, and texture disposal utility preventing VRAM leaks across stage transitions. |
| `src/capygame/engine/physics/ContiguousWorldTopology.ts` | Analytic SDF walkability and ground heightfields across the unified bridgeless Forest island (`Sanctuary`, `Spore Lagoon`, `Number Stampede`, `Yuzu Mountain`) and unbounded Capytorio mineral plains (`wx >= 500`). |
| `src/capygame/engine/physics/ColliderMath.ts` | Zero-allocation yaw-rotated 2D circle-vs-OBB collision resolver and star-system index clamping helpers. |
| `src/capygame/engine/physics/PhysicsWorldBridge.ts` | `SharedArrayBuffer` / transferable `Float32Array` main-thread bridge to `physics.worker.ts`, yaw-aware swept-CCD projection, shallow-water buoyancy, and XPBD soft-body pads. |
| `src/capygame/engine/physics/physics.worker.ts` | Dedicated Web Worker exclusively bundling `@dimforge/rapier3d-compat` Wasm rigid bodies, swept CCD, `RevoluteJoint` see-saws, and kinematic sweepers. |
| `src/capygame/services/AudioService.ts` | Procedural Web Audio synthesizer with master `DynamicsCompressorNode`, damped stereo delay reverb bus, surface-aware paw foley, and clean context disposal. |
| `src/capygame/services/ProgressionService.ts` | Persistent `PlayerStats` (`capy_game_save_v3`, `capy_game_save_updated_ms`), validated DNA/CapyCoin economy & Prestige Ascension, full-profile `capygame-save-bundle-v2` export/import (backward-compatible with v1/raw JSON), and `CapyGameSettings` (`capy_game_settings_v1`). |
| `src/capygame/services/SaveSyncMath.ts` | Pure snapshot summarization (`buildSaveSnapshotSummary`), local-vs-remote conflict comparison (`compareSaveSnapshots`), and timestamp/ghost-time formatting helpers. |
| `src/capygame/services/CloudSyncService.ts` | Unified cloud sync adapter combining direct browser Google Drive v3 REST helpers (`CapyGame-Cloud-Save.json`, `drive.file` scope) with native Android Google Play Games Services v2 snapshot hooks. |
| `src/capygame/services/FirebaseDriveAuth.ts` | Lazy-loaded client-side Firebase Authentication popup wrapper (`vendor-firebase` chunk) requesting `drive.file` with strict in-memory OAuth access token caching and `onAuthStateChanged` cleanup. |

---

## 2. Procedural Capybara Anatomy & 4-Tier Dynamic 60 FPS LOD Governor

`CapyModelGenerator.ts` constructs anatomically detailed *Hydrochoerus hydrochaeris* models using contoured `LatheGeometry` barrels, vertex-sculpted smooth rounded heads and plush blunt muzzles (`SphereGeometry` profile displacement), soft `MeshPhysicalMaterial` velvety sheen with uniform warm chestnut undercoat textures (free of seams or stripes), plump wagging tail nubs, 4-front / 3-hind webbed toes with keratin claws, blinking eyelids, 16 tapered vibrissae whiskers, and 96 instanced 3D underbelly-contoured coat tufts (`InstancedMesh`). `PlayStyleManager.ingestFpsSample()` continuously monitors frame times and adjusts detail across four zero-allocation tiers to maintain a smooth 60 FPS:

| LOD Tier | Label | Approximate Triangles | Active Anatomical Features |
| :--- | :--- | :--- | :--- |
| `0` | `Performance LOD` | `~760` | Contoured barrel torso, flat-topped head, blunt snout, cupped pinna ears, articulated limbs, dimpled Head Orange |
| `1` | `Balanced LOD` | `~1,840` | Adds cream underbelly, shoulder/thigh haunches, lower mandible, moist rhinarium nose pad, corneal eye catchlights, webbed paw pads |
| `2` | `High Anatomy LOD` | `~3,420` | Adds 4-front / 3-hind webbed toes and claws, cheek jowls, supraorbital brow ridges, animated blinking eyelids, 5-sepal citrus calyx and stem |
| `3` | `Ultra Bristle LOD` | `~6,480` | Adds 16 tapered muzzle/brow vibrissae whiskers and 96 instanced 3D layered bristle-fur coat tufts |

---

## 3. Dachshund Capy-Snake, Articulated Spine, Sightline Transparency & Botany

In the planetary surface simulation, `RealisticWorldEnvironment.ts` and `PlayStyleManager.ts` run a zero-allocation biomechanical and botanical loop:

- **3rd-Person Bayer Dither Sightline Transparency (Zero Side-Tree Disappearance)**: `PlayStyleManager.updateHeadLineOfSightTransparency()` triggers occlusion fading **only** when tall geometry crosses the focused camera-to-player sightline corridor or sits directly in front of the camera lens (`<= 2.6 m`). Side trees, trees ahead of the player, ground-level pools (`Home Pool` and `Cozy Onsen` basalt rim stones), and geometry behind the camera remain opaque. When an occluder blocks the player or lens, `installSightlineEdgeFadeShader()` (`capy_occ_bayer_dither_v3_*`) preserves hardware depth-writing and smoothly dithers the entire blocking object via a `4x4` screen-space Bayer lattice (`0.25` ghost silhouette, dissolving to `0.0` within `2.2 m` of the lens) so the character reads clearly without circular holes or severed trunks.
- **Solid Slightly-Compressible Spine, Connected 3D Jumps & Backward Walking**: Impact squash is clamped to `+-6%` (`MAX_SOLID_SQUASH = 0.06`). `solveSpineVerticalCoupling()` and `solveArticulatedSpineAndSolidCollisions()` step explicit 3D spine nodes (`spineX`, `spineY`, `spineZ`, `spineYaw`) through a 4-iteration Bidirectional PBD rod solver so normal jumps and Mushroom Pad hops propel cleanly forward while every torso segment and hindquarters caboose stay connected in a smooth vertical curve during both forward and reverse walking.
- **2-Joint Foot Kinematics & Ground-Contact Traction**: `evaluateFootContactsAndTraction()` measures sole-to-ground clearance across all active feet; if `groundedFeet === 0` outside water, `isStuckNoFooting` drops horizontal propulsion to `0` while legs paddle in air until footing is restored.
- **Procedural Botanical Morphogenesis & Interactive Placement Ghost**: `RealisticWorldEnvironment.createExponentialTree()` builds fluted trunks, 5 buttress roots, 3-tier Da Vinci pipe-model branches (`1.48^tier`), instanced V-folded citrus leaves, and 4-stage fruit growth (`blossom -> ovary_bud -> swelling -> ripe`). `startBuildingPlacementGhost()` raycasts pointer hover coordinates against `_sanctuaryGroundPlane` with emerald (`Clear`) vs rose (`Blocked`) turf validation.
- **Dynamic Bioluminescent Night Cycle**: `updateBioluminescentNightGlow()` modulates `glow_tail` plumes, `zen_pagoda` shoji lanterns, 3D portal beacons, island pathway lantern bollards, and `Spore Lagoon` bio-orbs smoothly from dusk through midnight without recompiling WebGL point-light shaders.

---

## 4. Seamless 65-Orders-of-Magnitude `1:1` Universe Simulator (`SeamlessUniverseSimulator.ts`, `UniverseShaders.ts`)

`SeamlessUniverseSimulator.ts` and `UniverseShaders.ts` provide continuous powers-of-10 zooming across 65 orders of magnitude (`logScaleMeters` from `+30.0` down to `-35.0`), spanning 27 physically calibrated scale bands in `UNIVERSE_SCALE_BANDS` (including the 12 cosmic tiers: Multiverse at `10^+30 m`, Big Bang inflation at `10^+28 m`, Spacetime Manifold at `10^+27.2 m`, Observable Universe at `10^+26.94 m`, Cosmic Web at `10^+25.2 m`, Filament at `10^+24.0 m`, Supercluster at `10^+23.0 m`, Cluster at `10^+22.2 m`, unified Galaxy & Spiral Arms at `10^+21.0 m` down through `10^+19.4 m` with selectable grand-design spiral, barred spiral, elliptical, and irregular morphologies plus continuous Orion-Cygnus Spur stars and gas ribbons, Nebulas & Pillars of Creation at `10^+17.2 m`, and Stellar Systems at `10^+12.95 m`, followed by Planetary System, Planet globe with Sanctuary landmass focus rerouting, Atmosphere, down to Planck Quantum Foam at `10^-35 m`):

- **Hubble & SpaceEngine Radiative Shader Pipeline & Dynamic Focus Rerouting**:
  - Flux-conserving Point-Spread-Function stars (`createStarPsfMaterial`) with Airy cores, 4-vane diffraction spikes, and Planckian blackbody colors (`2,600 K` to `32,000 K`), plus inclined Hubble Deep Field galaxies (`createDeepFieldGalaxyMaterial`).
  - Self-shielded 5-octave FBM volumetric nebulae and absorptive Bok-globule dust pillars (`createVolumetricNebulaMaterial`, `createDustPillarMaterial`) with in-shader ACES filmic tone mapping and Natural vs Hubble `SHO` narrowband palettes.
  - Unified Sersic spiral galaxy disc, 7,000 combined PSF stars, and Orion-Cygnus Spur volumetric ribbons inside `ScaleLayer_galaxy` with early rotating-frame **CapySol System** focus rerouting (`computeSpiralGalaxyFocusOffset` locking `24.0 -> 21.2` onto Earth's Orion-Cygnus Spur rather than `Sagittarius A*`), Chrono-Vessel autopilot banking (`getSpiralArmNavigationState`), Gaussian WHIM cosmic web filaments, convective solar photospheres, Keplerian planetary orbits with early **CapyWorld Planet** focus rerouting (`computeSolarPlanetFocusOffset` across `16.2 -> 12.2`), Earth-Moon orbital ellipses (`planetary_system` at `+8.85` calibrated `60.3x` Earth radius), a single unified 12,742 km habitable `Capy-Earth` sphere (`planet` at `+7.10` with Float32-jitter-free nested curved surface LOD patches fading cleanly across `3.35 -> 2.55`), and the randomized 11-specimen **Storybook Forest Micro-Glade** (`leaf_fur_micro` at `-2.0`) down to QED quantum vacuum and Planck Quantum Foam.
- **Strict `1:1` Default Scale Law & Unlockable Cosmic Instruments**:
  - Defaults strictly to `realityScaleGamma = 1.0` (`1:1` physical ratios) and `showObjectMarkers = false`.
  - **Object Finder Markers** (`12 DNA` or `30` CapyCoins) project 3D Keplerian orbit hairlines and clickable screen-space diamond reticles (`object-finder-markers-layer`) onto sub-pixel `1:1` planets, moons, stellar cores, and atomic nuclei.
  - **Reality Rescaler** (`20 DNA` or `45` CapyCoins) exposes `realityScaleGamma` (`0.28` to `1.00`), logarithmically/exponentially compressing inter-band (`10^(gamma * deltaLog)`) and intra-system (`r' ~ r^gamma`) size ratios while preserving exact physical `logScaleMeters` telemetry.
- **Pure Continuous Infinite Zoom Transitions (`Planet -> Forest Glade -> Leaf/Fur -> Cells -> Chromatin -> DNA`)**:
  - Infinite Zoom runs as a self-contained visual continuum without detouring into playable Forest islands or showing island/ocean/weather HUDs.
  - Tightened Planet, Atmosphere, Land Masses, and Ecosystems handoffs ensure at most two terrain/cloud shells crossfade simultaneously.
  - Grounded **Forest Glade** overlaps smoothly into the 11-specimen **Leaf & Fur Micro-Glade** (`leaf_fur_micro`), while the **Biological Cells** nucleus fades smoothly prior to camera penetration and transitions through a luminous **Chromatin Fiber & Nucleosome** bridge into the **DNA Double Helix** with lowered depth-write cutoffs, smoothstep sky blending, continuous camera pitch easing, and adaptive inter-band auto-zoom pacing.
- **Single-Line `40px` Unified Top Bar (`unified-top-bar`) & Responsive Flight HUD**: Hosts the 3-mode switcher (**Infinite Zoom** | **Forest Games** | **Capytorio**), Scale Atlas / Zoom Explorer (`toggle-scale-atlas-btn`) with realistic scale labels, optional **Read Aloud** spoken cards, the 11-specimen **Micro-Glade Discovery Sticker Book**, Cosmic Optics (`toggle-optics-panel-btn`), Live Inspector (`toggle-infographic-btn`), World Dock (`toggle-menu-btn`), Settings, and a top-right **Fullscreen** toggle (`toggle-fullscreen-btn`). In Infinite Zoom, the bottom flight strip (`chrono-vessel-flight-strip`) adapts cleanly across mobile, medium desktop, and wide desktop viewports so it never overlaps the bottom-right **Straight / Spiral** toggle and **Rewind / Play-Pause / Fast Forward** controls.

---

## 5. Standalone Modes: Forest Games, Capytorio & Multi-Threaded Physics (`src/capygame/engine/physics/`)

The top-bar mode switcher isolates **Infinite Zoom**, **Forest Games**, and **Capytorio** so only the active mode's 3D meshes, lighting, sky, audio, and simulation loops run at once (inactive modes pause cleanly and flush saves on switch):

| Mode / Area | Coordinates / Scope | Seamless Gameplay & Mechanics |
| :--- | :--- | :--- |
| **Forest Games: Sanctuary** | Central Island (`0, 0`) | Bridgeless open-world tropical island center with clamped comfortable camera zoom, exponential fruit trees, sunken Home Pool, building placement ghost, Kinetic Dash, Belly-Flop Slam, Arcade Combo HUD, and 3-slot Archipelago Bounties. |
| **Forest Games: Spore Lagoon** | NW Island Rim (`-110, -110`) | Sandy beach rim (`33.2 m` to `42.0 m`) sloping seamlessly into shallow bioluminescent water; walk or swim freely across the unified island shoreline to harvest plankton and splice 3D body mutations. |
| **Forest Games: Number Stampede** | SW Island Track (`-110, +135`) | Seamless 4-segment arithmetic gate track with side return boardwalks and turnaround deck integrated into the unified island. |
| **Forest Games: Yuzu Mountain** | SE Island Peak (`+110, +135`) | Seamless climb past rigid-body sweeper hammers, torque-balanced see-saws, and XPBD soft-body launch pads with 20 Hz ghost replay racing. |
| **Capytorio (Standalone Factory)** | Far-Hemisphere Plain (`+1200, 0`) | Isolated endless lush meadow grass & citrus grove plain (`wx >= 500`, `y = 0.0`). Harvest Fresh Oranges & endless `16x16` ore chunks and automate `44` Factorio machines (`78` Lua recipes, `25` techs) with brushed satin PBR finishes, steep **68° Oblique (`[V]`) / 3D Chase** camera, **Alt-Mode** item/machine/alert icons above buildings, compact arrow-only **Undo/Redo**, move-while-pasting **Blueprints**, 10-slot Recent-Items Quickbar, drag-painted auto-turning belts, `[Q]` Pipette, `[H]` Beacon, and Orbital UFO / Yuzu Rocket launches. |

- **Rapier3D Wasm + Worker Architecture**: Offloads `@dimforge/rapier3d-compat` rigid bodies, swept CCD (`ccdEnabled = true`), and pure torque-balanced `RevoluteJoint` see-saws to `physics.worker.ts` using lock-free `SharedArrayBuffer` + `Atomics` when `crossOriginIsolated === true` (with zero-allocation transferable `Float32Array` fallback in cross-origin iframes), paired with a `24x24` Saint-Venant shallow-water buoyancy solver (plus open-ocean Archimedes buoyancy outside the beach rim) and 4-substep XPBD soft-body pad solver.

---

## 6. Standardized WebGL2 3D GPU Engine, Cold-Load Pipeline, AAA VFX & Studio Audio (`src/capygame/engine/gpu/`)

- **Fast Cold-Load & Lazy Boot (`index.html`, `CapyGameView.tsx`, `PlayStyleManager.ts`, `RealisticWorldEnvironment.ts`)**: Paints an instant inline static shell (`#020617`) for zero-JS LCP, dynamically imports `PlayStyleManager` and `three` after first paint, builds Alpine mountain geometry/PBR lazily on demand (`ensureAlpineMountainsBuilt`), disables `renderer.debug.checkShaderErrors` outside dev builds, warms shader pipelines via async `compileAsync` during idle ticks, and caches viewport dimensions (`cachedViewportWidth`/`Height`) to prevent per-frame forced layout reflows.
- **3-Point Lighting, PMREM IBL & Azimuth-Invariant Shadow Cascade (`HardwareGpuEngine.ts`, `FramePerformanceGovernor.ts`)**: Pairs solar `DirectionalLight` and `HemisphereLight` with a counter-azimuth `rimLight`, `RectAreaLight` specular softbox, procedural Sky + Studio `PMREMGenerator` environment map, Hero Contact Shadow decal, and a tight `84 m` (`+-42 m`) texel-snapped shadow cascade positioned strictly along `currentSunDir`.
- **60 FPS Frame-Budget & Anti-Glitch Pipeline (`FramePerformanceGovernor.ts`, `PlayStyleManager.ts`, `CapyGameView.tsx`)**: Pre-warms `capy_occ_bayer_dither_v3_*` shader programs, keeps hardware `depthWrite` intact across opaque dithered foliage and restores `depthWrite = true` for translucent materials whenever `uCapyOccBlend <= 0.02`, offsets stacked pads/aprons/collars with `polygonOffset` to eliminate Z-fighting, prunes hidden cosmic and 27-band `Object3D` subtrees via `matrixWorldAutoUpdate = false`, strides distant (`> 85 m`) district ticks, throttles continuous React HUD `setState` calls to `~12 Hz`, and paces software WebGL via `WebGL2RenderingContext.fenceSync` (`afterDraw()`) while driving hardware GPUs at unthrottled 60 FPS `requestAnimationFrame`.
- **Sobel Tangent-Space PBR (`PbrTextureSynthesizer.ts`)**: Generates periodic seamless `DataTexture` heightfields baked via 3x3 Sobel gradients into `NoColorSpace` `normalMap`, `roughnessMap`, and Laplacian `aoMap` sets across all areas, brushed satin Capytorio machinery, dual-octave clearcoat ocean waves, Capybara bristle fur, and dimpled citrus peel, with live `1x..16x` anisotropic and `trilinear_aniso` / `bilinear` / `nearest_retro` switching.
- **Zero-Allocation GPU VFX & Studio Audio (`AaaWorldVfxEngine.ts`, `AudioService.ts`)**: Steps SoA `InstancedMesh` burst/footstep particles (skipping idle loops in `O(1)`), GPU bokeh sun-motes/fireflies, solar crepuscular god-rays, velocity-reactive FOV, quadratic camera trauma, and compressed stereo-reverb surface footsteps (`turf`, `cobble`, `water`).
- **Multi-Pass HDR Post-Processing (`WebGl2PostProcessing.ts` + `EffectComposer`)**: Runs `RenderPass` (`HalfFloatType` + `DepthTexture`) -> half-resolution `UnrealBloomPass` (`0.5x`–`0.65x` scale) -> fused single-pass smooth `C^1` Depth-SSAO + foreground CAS sharpening + far-field optical Depth-of-Field + chromatic dispersion + color-grading filter profiles (`natural_pbr`, `cinema_filmic`, `vibrant_hdr`, `golden_hour`, `noir_contrast`, `retro_crt`) -> `OutputPass` (`AgX` / `ACESFilmic` / `Neutral` / `Reinhard`) -> `FXAAShader`.

---

## 7. CapyGame Settings Reference (`localStorage` key: `capy_game_settings_v1`)

| Setting Property | TypeScript Type | Default | UI Location & Behavior |
| :--- | :--- | :--- | :--- |
| `advancedMode` | `boolean` | `false` | Top Menu & Settings Modal; toggles between kid-friendly Basic Mode (`false`) and full Advanced Mode telemetry/controls (`true`). |
| `cameraFollowBehind` | `boolean` | `true` | World Dock & Simulation Settings Modal; aligns chase camera azimuth behind the Capybara heading. |
| `capytorioCameraMode` | `'oblique' \| 'chase'` | `'oblique'` | Capytorio Toolbar (`68° [V]` / `3D [V]`) & Simulation Settings Modal; defaults to steep 68-degree overhead Factorio projection with mouse-wheel/`+/-` zoom (`0.55x..2.20x`) and toggles live to 3D chase view. |
| `capytorioBeltEndSpill` | `boolean` | `false` | Simulation Settings Modal; when enabled, items reaching an open conveyor belt end spill onto the ground instead of backing up cleanly. |
| `mouselookEnabled` | `boolean` | `true` | Simulation Settings Modal; enables desktop left/right-drag mouselook and `M`-key free mouselook across cosmic orbit and surface modes. |
| `mouselookSensitivity` | `number` (`0.2` – `2.5`) | `1.0` | Simulation Settings Modal; scales pointer angular look rate across space and surface cameras. |
| `invertMouseY` | `boolean` | `false` | Simulation Settings Modal; reverses vertical pitch direction for flight-sim style mouselook. |
| `autoCapyLod` | `boolean` | `true` | Simulation Settings Modal; dynamically steps Capybara LOD (`0` to `3`) and adaptive GPU tiers to maintain `fpsTarget`. |
| `manualCapyLodTier` | `0 \| 1 \| 2 \| 3` | `3` | Simulation Settings Modal (`Perf`, `Balanced`, `High`, `Ultra`); locks Capybara LOD when `autoCapyLod` is `false`. |
| `lock60FpsGovernor` | `boolean` | `true` | Simulation Settings Modal; keeps the 60 FPS frame-budget governor active. |
| `showAboutOnStartup` | `boolean` | `false` | About / Help Modal; controls whether the overview modal opens automatically on launch. |
| `dayNightAutoCycle` | `boolean` | `true` | Simulation Settings Modal; advances solar/lunar time continuously across 24 hours. |
| `timeOfDayHours` | `number` (`0` – `24`) | `9.5` | Simulation Settings Modal; sets manual solar hour (`0.0` to `24.0`). |
| `weatherMode` | `'auto' \| 'clear' \| 'rain' \| 'storm' \| 'snow'` | `'auto'` | Simulation Settings Modal; selects automatic weather progression or locks a specific clear/precipitation state without obstructive fog. |
| `flightTrajectory` | `'straight' \| 'spiral'` | `'spiral'` | Bottom-Right Flight Toggle (`toggle-flight-trajectory-btn`); defaults to a 360°-per-zoom-band curved spiral orbit with dynamic vessel banking and switches cleanly to straight radial flight. |
| `cameraDistance` | `number` | `1.0` | Simulation Settings Modal; scales camera follow distance (`0.6x` to `1.5x`). |
| `turnSensitivity` | `number` | `1.0` | Simulation Settings Modal; scales angular steering rate (`0.5x` to `2.0x`). |
| `fov` | `number` | `58` | Simulation Settings Modal; adjusts baseline vertical perspective field of view (`45` to `75` degrees). |
| `drawDistance` | `number` (`90` – `1350`) | `650` | Simulation Settings Modal (`Short 135m`, `Med 280m`, `Far 650m`, `Max 1350m`); dynamically trims `camera.far`, culls distant background districts, skips the far alpine ring below `185m`, and scales the atmospheric sky dome proportionally inside `camera.far`. |
| `worldFogEnabled` | `boolean` | `false` | Retained for save compatibility; scene fog stays permanently disabled (`scene.fog = null`) for unobstructed visibility. |
| `touchControlsMode` | `'auto' \| 'always' \| 'hidden'` | `'auto'` | Simulation Settings Modal; controls visibility of the directional touch pad. |
| `showObjectMarkers` | `boolean` | `false` | Cosmic Optics Popover; projects clickable diamond reticles onto sub-pixel `1:1` cosmic/atomic bodies once unlocked. |
| `realityScaleGamma` | `number` (`0.28` – `1.00`) | `1.0` | Cosmic Optics Popover; defaults to `1.0` (`1:1` scale) and compresses scale ratios once Reality Rescaler is unlocked. |
| `astrophysicsPalette` | `'natural' \| 'hubble'` | `'natural'` | Cosmic Optics Popover; switches emission nebulae between Natural broadband and Hubble `SHO` narrowband palettes. |
| `gpuBackendPreference` | `'webgl2'` | `'webgl2'` | Standardized WebGL2 backend (legacy `'webgpu'` / `'auto'` saved values sanitize automatically to `'webgl2'`). |
| `gpuQualityPreset` | `'performance' \| 'balanced' \| 'high' \| 'ultra'` | `'high'` | Simulation Settings Modal; `Perf` cuts render scale to `0.70x`, reduces `drawDistance` to `135m`, sets Capybara LOD to Tier `0`, disables IBL/fill-lights/clouds/god-rays/shadows/post-FX for maximum FPS. |
| `gpuPostProcessing` | `boolean` | `true` | Simulation Settings Modal; toggles `HalfFloatType` `EffectComposer` post-processing vs direct rendering. |
| `gpuVisualFilter` | `'natural_pbr' \| 'cinema_filmic' \| 'vibrant_hdr' \| 'golden_hour' \| 'noir_contrast' \| 'retro_crt'` | `'natural_pbr'` | Simulation Settings Modal; selects active GPU color-grading and lens profile. |
| `gpuToneMapping` | `'agx' \| 'aces' \| 'neutral' \| 'reinhard'` | `'agx'` | Simulation Settings Modal; selects hardware HDR tone mapping curve. |
| `gpuExposure` | `number` (`0.50` – `2.00`) | `1.02` | Simulation Settings Modal; scales linear HDR scene exposure. |
| `gpuTextureFilter` | `'trilinear_aniso' \| 'bilinear' \| 'nearest_retro'` | `'trilinear_aniso'` | Simulation Settings Modal; live-switches registered PBR texture sampling modes. |
| `gpuAnisotropy` | `1 \| 4 \| 8 \| 16` | `8` | Simulation Settings Modal; sets hardware anisotropic filtering level. |
| `gpuShadowQuality` | `'pcf_soft' \| 'pcf' \| 'vsm' \| 'off'` | `'pcf_soft'` | Simulation Settings Modal; selects directional solar shadow filtering mode. |
| `gpuBloomEnabled` | `boolean` | `true` | Simulation Settings Modal; toggles `UnrealBloomPass` HDR emissive glow. |
| `gpuBloomStrength` | `number` (`0.05` – `0.80`) | `0.24` | Simulation Settings Modal slider; controls baseline HDR bloom strength. |
| `gpuSsaoEnabled` | `boolean` | `true` | Simulation Settings Modal; toggles linearized depth-buffer cavity ambient occlusion. |
| `gpuSharpenAmount` | `number` (`0.00` – `1.00`) | `0.26` | Simulation Settings Modal; controls foreground Contrast-Adaptive Unsharp Mask (CAS) crispness when Post-FX is enabled. |
| `gpuAntiAliasing` | `'msaa_fxaa' \| 'fxaa' \| 'none'` | `'msaa_fxaa'` | Simulation Settings Modal; selects MSAA + FXAA, FXAA only, or Off. |
| `gpuResolutionScale` | `number` (`0.50` – `1.50`) | `1.0` | Simulation Settings Modal (`0.6x`, `0.75x`, `1.0x`, `1.25x`); scales effective render pixel ratio cleanly across desktop and mobile WebGL2. |
| `maxFpsLimit` | `number` (`0` or `24` – `240`) | `60` | Simulation Settings Modal & FPS Popover; hardware frame pacing cap (`0` = Unlimited/VSync, `30`, `45`, `60`, `90`, `120`, `144`) reducing GPU power draw. |
| `fpsTarget` | `number` (`24` – `240`) | `60` | Simulation Settings Modal & FPS Popover (`30`, `45`, `60`, `90`, `120`); drives progressive GPU feature cuts when `autoCapyLod` (Auto GPU Optimizer) is enabled. |
| `showFpsButton` | `boolean` | `true` | Simulation Settings Modal; shows or hides the top-right FPS telemetry button (`top-right-fps-btn`). |

---

## 8. Frame Performance Governor & Diagnostic Telemetry

- **Max Frame Rate Limiter & Zero-Allocation Target Tracking (`FramePerformanceGovernor.ts`, `CapyGameView.tsx`)**: Enforces `maxFpsLimit` inside the `requestAnimationFrame` loop (`0` = VSync/Unlimited or `30..144` FPS cap) with vsync jitter tolerance so idle/capped GPUs save power without false frame-drop alerts.
- **Adaptive FPS Target Optimizer (`computeAdaptiveGpuMitigation`)**: When enabled (`autoCapyLod`), progressively steps down GPU-heavy features (Capybara LOD, Depth SSAO, Render Scale, HDR Bloom, Solar Shadows, Anti-Aliasing, and Post-FX Direct Pass) across 6 hysteresis-guarded tiers toward `fpsTarget` without mutating persisted settings, restoring features once headroom returns.
- **On-Demand Incident Feed (Zero Auto-Popup Interruptions)**: Frame-drop incidents are recorded silently into `PerformanceLogTracker` (grouped across a rolling 8-second window tracking repeat count `xN`, min/max FPS, and time spans) and are revealed only when clicking the top-right FPS button (`top-right-fps-btn`).
- **Dual Telemetry Modes**:
  - `Summary Mode`: Produces an ultra-compact report (~110–140 tokens) with active scale, live/min FPS, dropped frame counts, backend info, and grouped incidents optimized for pasting into LLM chat contexts.
  - `Detail Mode`: Generates comprehensive diagnostic telemetry including GPU adapter specs, shadow cascade state, draw call counts, VRAM allocations, and complete scene hierarchy details.
- **Selective Snippet Copying (`CapyGameView.tsx`)**: Unlocks text selection (`select-text`) allowing users to highlight and copy individual lines or ranges, in addition to one-click row copy buttons on every incident feed item.

---

## 9. Performance Analysis Mode & Spaceship Flight Controls

- **Fine-Grained CPU/GPU Subsystem Profiler (`PerformanceProfiler.ts`)**: Measures per-frame CPU execution times across 13 distinct engine phases (`input_camera`, `physics_bridge`, `biomechanics`, `world_simulation`, `district_gameplay`, `cosmic_universe`, `chrono_vessel`, `vfx_particles`, `sightline_occlusion`, `scene_graph_matrices`, `gpu_shadow_cascade`, `gpu_render_submit`, `telemetry_hud`) using zero-allocation rolling ring buffers.
- **Hardware GPU Timer Queries**: Supports non-blocking `EXT_disjoint_timer_query_webgl2` on WebGL2 to measure true hardware GPU execution times in milliseconds, identifying whether bottlenecks are CPU-bound or GPU-bound.
- **Action & Event Tracer**: Automatically logs and times discrete asynchronous and user actions (e.g., district transitions, cosmic launches, scale jumps, LOD adaptations) with timestamps and durations.
- **Continuous Spaceship Flight & Mouselook Controls**:
  - In spaceship mode, mouse wheel and bottom-right `Rewind / Play-Pause / Fast Forward` gears (`0.08..1.25 log/s`) smoothly control cruise velocity (`targetCruiseVelocityLogPerSec`) instead of jumping discrete zoom levels.
  - Gentle aerospace momentum damping (`damp(..., 3.2, dt)`) continuously accelerates or brakes the vessel between `-2.0` and `+2.0` log-meters per second, while scale-band selections travel at a constant steady cruise rate (`stepSteadyLogScaleTowardTarget` at `<= 0.90 log/s`) through intervening space with zero exponential snapping.
  - Cherenkov thruster flares, plume length, flight pitch attitude, and velocity-reactive FOV dynamically respond to active throttle.
  - Across both spaceship/cosmic zoom and surface gameplay, dragging with Left/Right mouse smoothly orbits (`applyMouseLookDelta`) without interfering with `WASD` steering or mobile touch joysticks, and pressing `M` toggles Free Mouselook (`requestPointerLock` with seamless cursor-delta fallback inside sandboxed iframes).



