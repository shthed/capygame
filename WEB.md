# Technical Architecture & Engine Reference: CapyGame 3D

This document details the architecture, multi-scale astrophysical simulation, contiguous multiphysics engine, hardware-accelerated GPU rendering pipeline, and persistent settings of **CapyGame 3D** (`src/`).

---

## 1. Directory & Module Structure

| Path | Responsibility |
| :--- | :--- |
| `src/App.tsx` | Minimal root React component mounting `CapyGameView`. |
| `src/main.tsx` | React 19 entry point wrapping `App` in `AppErrorBoundary` and initializing `PwaService`. |
| `src/components/AppErrorBoundary.tsx` | Diagnostic crash and WebGL recovery boundary with cache-reset controls. |
| `src/services/NativeBridge.ts` | Web vibration haptics (`navigator.vibrate`) and modal Escape/back handler registration. |
| `src/services/PwaService.ts` | Offline Service Worker registration (`./sw.js`) and PWA install prompt lifecycle. |
| `src/capygame/types.ts` | Scale band definitions (`UNIVERSE_SCALE_BANDS`), `PlayStyle` zones, `CapyGameSettings`, `ChronoVesselViewMode`, `PlayerStats`, and mutation/building catalogs. |
| `src/capygame/config/ProceduralGameConfig.ts` | Deterministic `mulberry32` seed PRNG, Fine-Structure Constant ($\alpha^{-1}$) physics solver (`computeFineStructurePhysics`), validated full-game JSON schema, 5 presets, `capy_game_procedural_config_v1`, and `capy_game_onboarding_v1` persistence. |
| `src/capygame/components/CapyGameView.tsx` | Single `40px` (`h-10`) top HUD (`unified-top-bar`), First-Time Chrono-Genesis Configurator (Pilot, Spaceship & $\alpha$), collapsible Chrono-Vessel Flight Strip, Live Procedural JSON Config Editor modal, Scale Atlas, Cosmic Optics, Live Inspector, World Dock, Settings, and `PwaService` card. |
| `src/capygame/engine/ChronoVesselRig.ts` | Future Capybara time-machine Chrono-Vessel (`chase_pod`, `telescope_first_person`, `landed`), brass chrono-rings, Cherenkov thrusters, customizable canopy tint & pilot headgear, and Sanctuary Chrono-Pad docking beacon. |
| `src/capygame/engine/PlayStyleManager.ts` | Contiguous 5-district simulation loop with fixed pre-allocated VRAM pools, bidirectional PBD spine solver, 95% screen-clear sightline transparency, and Chrono-Vessel continuum. |
| `src/capygame/engine/CapyModelGenerator.ts` | Procedural *Hydrochoerus hydrochaeris* 4-tier 60 FPS LOD meshes, custom fur pigments, mutations, hats, and Sanctuary structures. |
| `src/capygame/engine/RealisticWorldEnvironment.ts` | Rayleigh/Mie sky dome, 360-degree Alpine mountains, 24-hour solar/lunar cycle, weather, coupled `24x24` `DataTexture` Home Pool, and exponential fruit trees. |
| `src/capygame/engine/CosmicUniverseBuilder.ts` | N-Body/SPH galaxy coalescence, supernova nucleosynthesis, and on-demand suspended planetary selection stages. |
| `src/capygame/engine/SeamlessUniverseSimulator.ts` | Continuous 63-order-of-magnitude (`10^+28 m` to `10^-35 m`) `1:1` scale hierarchy, monotonic `0.00` to `13.80 Gyr` expansion, $\alpha$-coupled atomic Bohr scaling/Dirac spinor/photon/solar photosphere physics, Object Finder Markers, and Reality Rescaler. |
| `src/capygame/engine/UniverseShaders.ts` | Flux-conserving PSF stars, Hubble narrowband/natural volumetric nebulae, spiral galaxies, and Rayleigh planetary atmospheres. |
| `src/capygame/engine/gpu/HardwareGpuEngine.ts` | WebGL2 `HalfFloatType` `EffectComposer`, PMREM IBL, 3-point lighting, `84 m` azimuth-invariant texel-snapped Hero shadow cascade, half-res Bloom, smooth `C^1` Depth-SSAO, DoF, and CAS. |
| `src/capygame/engine/gpu/FramePerformanceGovernor.ts` | Pure zero-allocation 60 FPS governor computing preset DPR caps, half-resolution bloom scales, distant district tick strides, occluder `depthWrite` restoration, and azimuth-invariant texel-snapped shadow origins. |
| `src/capygame/engine/gpu/PbrTextureSynthesizer.ts` | Seamless Sobel tangent-space `normalMap`, `roughnessMap`, and Laplacian `aoMap` synthesis across all 5 districts and live texture filter switching. |
| `src/capygame/engine/gpu/AaaWorldVfxEngine.ts` | Zero-allocation Structure-of-Arrays `InstancedMesh` burst/footstep particles (with idle burst early-exit), GPU bokeh sun-motes/fireflies, and solar crepuscular god-rays. |
| `src/capygame/engine/gpu/ThreeDisposal.ts` | WebGL subtree geometry, material, and texture disposal utility preventing VRAM leaks across stage transitions. |
| `src/capygame/engine/physics/ContiguousWorldTopology.ts` | Analytic SDF walkability and ground heightfields across all 5 districts and 4 `9.6 m`-wide Grand Promenade Causeways. |
| `src/capygame/engine/physics/ColliderMath.ts` | Zero-allocation yaw-rotated 2D circle-vs-OBB collision resolver and star-system index clamping helpers. |
| `src/capygame/engine/physics/PhysicsWorldBridge.ts` | `SharedArrayBuffer` / transferable `Float32Array` main-thread bridge to `physics.worker.ts`, yaw-aware swept-CCD projection, shallow-water buoyancy, and XPBD soft-body pads. |
| `src/capygame/engine/physics/physics.worker.ts` | Dedicated Web Worker exclusively bundling `@dimforge/rapier3d-compat` Wasm rigid bodies, swept CCD, `RevoluteJoint` see-saws, and kinematic sweepers. |
| `src/capygame/services/AudioService.ts` | Procedural Web Audio synthesizer with master `DynamicsCompressorNode`, damped stereo delay reverb bus, surface-aware paw foley, and clean context disposal. |
| `src/capygame/services/ProgressionService.ts` | Persistent `PlayerStats` (`capy_game_save_v3`), validated DNA/CapyCoin economy & Prestige Ascension, and `CapyGameSettings` (`capy_game_settings_v1`). |

---

## 2. Procedural Capybara Anatomy & 4-Tier Dynamic 60 FPS LOD Governor

`CapyModelGenerator.ts` constructs anatomically detailed *Hydrochoerus hydrochaeris* models using contoured `LatheGeometry` barrels, beveled `ExtrudeGeometry` flat-topped skulls, directional bristle-fur albedo and Sobel normal maps, 4-front / 3-hind webbed toes with keratin claws, blinking eyelids, 16 tapered vibrissae whiskers, and 96 instanced 3D bristle-fur tufts (`InstancedMesh`). `PlayStyleManager.ingestFpsSample()` continuously monitors frame times and adjusts detail across four zero-allocation tiers to maintain a smooth 60 FPS:

| LOD Tier | Label | Approximate Triangles | Active Anatomical Features |
| :--- | :--- | :--- | :--- |
| `0` | `Performance LOD` | `~760` | Contoured barrel torso, flat-topped head, blunt snout, cupped pinna ears, articulated limbs, dimpled Head Orange |
| `1` | `Balanced LOD` | `~1,840` | Adds cream underbelly, shoulder/thigh haunches, lower mandible, moist rhinarium nose pad, corneal eye catchlights, webbed paw pads |
| `2` | `High Anatomy LOD` | `~3,420` | Adds 4-front / 3-hind webbed toes and claws, cheek jowls, supraorbital brow ridges, animated blinking eyelids, 5-sepal citrus calyx and stem |
| `3` | `Ultra Bristle LOD` | `~6,480` | Adds 16 tapered muzzle/brow vibrissae whiskers and 96 instanced 3D layered bristle-fur coat tufts |

---

## 3. Dachshund Capy-Snake, Articulated Spine, Sightline Transparency & Botany

In the planetary surface simulation, `RealisticWorldEnvironment.ts` and `PlayStyleManager.ts` run a zero-allocation biomechanical and botanical loop:

- **Sightline-Only Whole-Screen Clear Shader (Zero Offscreen Disappearance)**: `PlayStyleManager.updateHeadLineOfSightTransparency()` triggers occlusion fading **only** when tall geometry strictly blocks the 3D `[camera -> player]` corridor (`doesSphereBlockPlayerSightline`, a 7-ray direct player-target bundle stopping `0.30 m` before the Hero, or when the camera lens physically enters a canopy behind the Hero). Objects ahead of the Hero, ground-level pools (`Home Pool` and `Cozy Onsen` basalt rim stones), and geometry moving offscreen at the viewport edges never trigger fading. When an object *does* block the player, `installSightlineEdgeFadeShader()` (`capy_occ_whole96_*`) `discard`s `>= 95.6%` of the entire viewport (`boxNorm <= 0.978`) so the whole screen remains clear and visible rather than leaving a cramped keyhole border around the player.
- **Solid Slightly-Compressible Spine & Coordinated Backward Walking**: Impact squash is clamped to `+-6%` (`MAX_SOLID_SQUASH = 0.06`). `solveArticulatedSpineAndSolidCollisions()` steps explicit spine nodes (`spineX`, `spineY`, `spineZ`, `spineYaw`) through a 4-iteration Bidirectional Position-Based Dynamics (PBD) rod solver enforcing inextensible link spacing, anti-jackknife bend limits (`MAX_SPINE_BEND_RAD = 0.52 rad`), pairwise non-adjacent separation (`|i - j| >= 2`), and solid obstacle pushback during both forward and reverse walking.
- **2-Joint Foot Kinematics & Ground-Contact Traction**: `evaluateFootContactsAndTraction()` measures sole-to-ground clearance across all active feet; if `groundedFeet === 0` outside water, `isStuckNoFooting` drops horizontal propulsion to `0` while legs paddle in air until footing is restored.
- **Procedural Botanical Morphogenesis & Interactive Placement Ghost**: `RealisticWorldEnvironment.createExponentialTree()` builds fluted trunks, 5 buttress roots, 3-tier Da Vinci pipe-model branches (`1.48^tier`), instanced V-folded citrus leaves, and 4-stage fruit growth (`blossom -> ovary_bud -> swelling -> ripe`). `startBuildingPlacementGhost()` raycasts pointer hover coordinates against `_sanctuaryGroundPlane` with emerald (`Clear`) vs rose (`Blocked`) turf validation.
- **Dynamic Bioluminescent Night Cycle**: `updateBioluminescentNightGlow()` modulates `glow_tail` plumes, `zen_pagoda` shoji lanterns, 3D portal beacons, Grand Promenade Causeway lantern bollards, and `Spore Lagoon` bio-orbs smoothly from dusk through midnight without recompiling WebGL point-light shaders.

---

## 4. Seamless 63-Orders-of-Magnitude `1:1` Universe Simulator (`SeamlessUniverseSimulator.ts`, `UniverseShaders.ts`)

`SeamlessUniverseSimulator.ts` and `UniverseShaders.ts` provide continuous powers-of-10 zooming across 63 orders of magnitude (`logScaleMeters` from `+28.0` down to `-35.0`), spanning 21 physically calibrated scale bands in `UNIVERSE_SCALE_BANDS` (with inner rocky planets, habitable worlds, the main asteroid belt, gas/ice giants, Kuiper belt, and spherical 3D Oort Cometary Cloud unified into a single `solar_systems` band):

- **Hubble & SpaceEngine Radiative Shader Pipeline**:
  - Flux-conserving Point-Spread-Function stars (`createStarPsfMaterial`) with Airy cores, 4-vane diffraction spikes, and Planckian blackbody colors (`2,600 K` to `32,000 K`), plus inclined Hubble Deep Field galaxies (`createDeepFieldGalaxyMaterial`).
  - Self-shielded 5-octave FBM volumetric nebulae and absorptive Bok-globule dust pillars (`createVolumetricNebulaMaterial`, `createDustPillarMaterial`) with in-shader ACES filmic tone mapping and Natural vs Hubble `SHO` narrowband palettes.
  - Sersic spiral galaxy discs, Gaussian WHIM cosmic web filaments, convective solar photospheres, Rayleigh/Mie planetary atmospheres, Kelvin-Helmholtz gas-giant bands, Cassini/Encke rings with cylindrical planet shadows, and cratered lunar regolith.
- **Strict `1:1` Default Scale Law & Unlockable Cosmic Instruments**:
  - Defaults strictly to `realityScaleGamma = 1.0` (`1:1` physical ratios) and `showObjectMarkers = false`.
  - **Object Finder Markers** (`12 DNA` or `30` CapyCoins) project 3D Keplerian orbit hairlines and clickable screen-space diamond reticles (`object-finder-markers-layer`) onto sub-pixel `1:1` planets, moons, stellar cores, and atomic nuclei.
  - **Reality Rescaler** (`20 DNA` or `45` CapyCoins) exposes `realityScaleGamma` (`0.28` to `1.00`), logarithmically/exponentially compressing inter-band (`10^(gamma * deltaLog)`) and intra-system (`r' ~ r^gamma`) size ratios while preserving exact physical `logScaleMeters` telemetry.
- **Single-Line `40px` Unified Top Bar (`unified-top-bar`)**: Consolidates scale steppers, Scale Atlas dropdown (`toggle-scale-atlas-btn`), Cosmic Optics (`toggle-optics-panel-btn`), Live Inspector (`toggle-infographic-btn`), placement ghost controls, DNA/CapyCoin readouts, World Dock (`toggle-menu-btn`), Settings, Overview, and Audio Mute at `y = 0` with zero bottom HUD clutter.

---

## 5. Contiguous Single-World Causeways & Multi-Threaded Physics (`src/capygame/engine/physics/`)

All 5 minigames run simultaneously inside one contiguous walkable world connected by 4 paved `9.6 m`-wide **Grand Promenade Causeways** (`CONTIGUOUS_BRIDGES`):

| Promenade Causeway | Origin (`Sanctuary`) | Destination District | Seamless Walk-In / Walk-Out Mechanics |
| :--- | :--- | :--- | :--- |
| **NW Promenade** | `(-20.5, -20.5)` | `Spore Lagoon` (`-75, -75`) | Sandy beach rim (`33.2 m` to `42.0 m`) slopes into shallow bioluminescent water; walk back SE onto the causeway anytime. |
| **NE Promenade** | `(+20.5, -20.5)` | `Yuzu Breakout` (`+75, -75`) | Open south forecourt (`localZ` `+9.8` to `+19.5`) couples Hero X movement to the Breakout deflector paddle while keeping the south exit open. |
| **SW Promenade** | `(-20.5, +20.5)` | `Number Stampede` (`-75, +75`) | Bounded 4-segment circuit (`localZ` `0` to `-86`) with east/west wooden return boardwalks (`x = +-6.3 m`) and turnaround deck (`z = -92 m`). |
| **SE Promenade** | `(+20.5, +20.5)` | `Yuzu Mountain` (`+75, +75`) | Entry ramp (`localZ` `+8.5` to `+4.5`), continuous safety promenade, rigid-body sweeper hammers, torque-balanced see-saw, and XPBD launch pad. |

- **Rapier3D Wasm + Worker Architecture**: Offloads `@dimforge/rapier3d-compat` rigid bodies, swept CCD (`ccdEnabled = true`), and pure torque-balanced `RevoluteJoint` see-saws to `physics.worker.ts` using lock-free `SharedArrayBuffer` + `Atomics` when `crossOriginIsolated === true` (with zero-allocation transferable `Float32Array` fallback in cross-origin iframes), paired with a `24x24` Saint-Venant shallow-water buoyancy solver (streaming height and gradient bytes directly into Home Pool and Spore Lagoon shader `DataTexture` uniforms via `packRippleTextureBytes()`) and 4-substep XPBD soft-body pad solver.

---

## 6. Hardware-Accelerated 3D GPU Engine, AAA VFX & Studio Audio (`src/capygame/engine/gpu/`)

- **3-Point Lighting, PMREM IBL & Azimuth-Invariant Shadow Cascade (`HardwareGpuEngine.ts`, `FramePerformanceGovernor.ts`)**: Pairs solar `DirectionalLight` and `HemisphereLight` with a counter-azimuth `rimLight`, `RectAreaLight` specular softbox, procedural Sky + Studio `PMREMGenerator` environment map, Hero Contact Shadow decal, and a tight `84 m` (`+-42 m`) texel-snapped shadow cascade positioned strictly along `currentSunDir` so solar azimuth never warps across `+-75 m` districts.
- **60 FPS Frame-Budget & Anti-Glitch Pipeline (`FramePerformanceGovernor.ts`, `PlayStyleManager.ts`, `CapyGameView.tsx`)**: Pre-warms `capy_occ_whole96_*` shader programs at startup, restores `depthWrite = true` whenever sightline `uCapyOccBlend <= 0.02`, offsets stacked district causeways/aprons/collars with `polygonOffset` to eliminate Z-fighting, prunes hidden cosmic and 21-band `Object3D` subtrees via `matrixWorldAutoUpdate = false`, strides distant (`> 85 m`) district ticks, throttles continuous React HUD `setState` calls to `~12 Hz`, and paces software WebGL via `WebGL2RenderingContext.fenceSync` (`afterDraw()`) while driving hardware GPUs at unthrottled 60 FPS `requestAnimationFrame`.
- **Full 5-District Sobel Tangent-Space PBR (`PbrTextureSynthesizer.ts`)**: Generates periodic seamless `DataTexture` heightfields baked via 3x3 Sobel gradients into `NoColorSpace` `normalMap`, `roughnessMap`, and Laplacian `aoMap` sets across all 5 districts, 4 causeways, dual-octave clearcoat ocean waves, Capybara bristle fur, and dimpled citrus peel, with live `1x..16x` anisotropic and `trilinear_aniso` / `bilinear` / `nearest_retro` switching.
- **Zero-Allocation GPU VFX & Studio Audio (`AaaWorldVfxEngine.ts`, `AudioService.ts`)**: Steps SoA `InstancedMesh` burst/footstep particles (skipping idle loops in `O(1)`), GPU bokeh sun-motes/fireflies, solar crepuscular god-rays, velocity-reactive FOV, quadratic camera trauma, and compressed stereo-reverb surface footsteps (`turf`, `cobble`, `water`).
- **Multi-Pass HDR Post-Processing (`EffectComposer` + `CapyGpuMasterFilterShader`)**: Runs `RenderPass` (`HalfFloatType` + `DepthTexture`) -> half-resolution `UnrealBloomPass` (`0.5x`–`0.65x` scale) -> fused single-pass smooth `C^1` Depth-SSAO + foreground CAS sharpening + far-field optical Depth-of-Field + chromatic dispersion + color-grading filter profiles (`natural_pbr`, `cinema_filmic`, `vibrant_hdr`, `golden_hour`, `noir_contrast`, `retro_crt`) -> `OutputPass` (`AgX` / `ACESFilmic` / `Neutral` / `Reinhard`) -> `FXAAShader`.

---

## 7. CapyGame 3D Settings Reference (`localStorage` key: `capy_game_settings_v1`)

| Setting Property | TypeScript Type | Default | UI Location & Behavior |
| :--- | :--- | :--- | :--- |
| `cameraFollowBehind` | `boolean` | `true` | World Dock & Simulation Settings Modal; aligns chase camera azimuth behind the Capybara heading. |
| `autoCapyLod` | `boolean` | `true` | Simulation Settings Modal; dynamically steps Capybara LOD (`0` to `3`) to maintain 60 FPS. |
| `manualCapyLodTier` | `0 \| 1 \| 2 \| 3` | `3` | Simulation Settings Modal (`Perf`, `Balanced`, `High`, `Ultra`); locks Capybara LOD when `autoCapyLod` is `false`. |
| `dayNightAutoCycle` | `boolean` | `true` | Simulation Settings Modal; advances solar/lunar time continuously across 24 hours. |
| `timeOfDayHours` | `number` (`0` – `24`) | `9.5` | Simulation Settings Modal; sets manual solar hour (`0.0` to `24.0`). |
| `weatherMode` | `'auto' \| 'clear' \| 'rain' \| 'storm' \| 'mist' \| 'snow'` | `'auto'` | Simulation Settings Modal; selects automatic weather progression or locks a specific state. |
| `cameraDistance` | `number` | `1.0` | Simulation Settings Modal; scales camera follow distance (`0.6x` to `1.5x`). |
| `turnSensitivity` | `number` | `1.0` | Simulation Settings Modal; scales angular steering rate (`0.5x` to `2.0x`). |
| `fov` | `number` | `58` | Simulation Settings Modal; adjusts baseline vertical perspective field of view (`45` to `75` degrees). |
| `worldFogEnabled` | `boolean` | `true` | Simulation Settings Modal; toggles atmospheric horizon fog attenuation. |
| `touchControlsMode` | `'auto' \| 'always' \| 'hidden'` | `'auto'` | Simulation Settings Modal; controls visibility of the directional touch pad. |
| `showObjectMarkers` | `boolean` | `false` | Cosmic Optics Popover; projects clickable diamond reticles onto sub-pixel `1:1` cosmic/atomic bodies once unlocked. |
| `realityScaleGamma` | `number` (`0.28` – `1.00`) | `1.0` | Cosmic Optics Popover; defaults to `1.0` (`1:1` scale) and compresses scale ratios once Reality Rescaler is unlocked. |
| `astrophysicsPalette` | `'natural' \| 'hubble'` | `'natural'` | Cosmic Optics Popover; switches emission nebulae between Natural broadband and Hubble `SHO` narrowband palettes. |
| `gpuQualityPreset` | `'performance' \| 'balanced' \| 'high' \| 'ultra'` | `'high'` | Simulation Settings Modal; configures shadows, anisotropy, bloom, SSAO, and CAS sharpening in one click. |
| `gpuPostProcessing` | `boolean` | `true` | Simulation Settings Modal; toggles `HalfFloatType` `EffectComposer` post-processing vs direct rendering. |
| `gpuVisualFilter` | `'natural_pbr' \| 'cinema_filmic' \| 'vibrant_hdr' \| 'golden_hour' \| 'noir_contrast' \| 'retro_crt'` | `'natural_pbr'` | Simulation Settings Modal; selects active GPU color-grading and lens profile. |
| `gpuToneMapping` | `'agx' \| 'aces' \| 'neutral' \| 'reinhard'` | `'agx'` | Simulation Settings Modal; selects hardware HDR tone mapping curve. |
| `gpuExposure` | `number` (`0.50` – `2.00`) | `1.12` | Simulation Settings Modal; scales linear HDR scene exposure. |
| `gpuTextureFilter` | `'trilinear_aniso' \| 'bilinear' \| 'nearest_retro'` | `'trilinear_aniso'` | Simulation Settings Modal; live-switches registered PBR texture sampling modes. |
| `gpuAnisotropy` | `1 \| 2 \| 4 \| 8 \| 16` | `8` | Simulation Settings Modal; sets hardware anisotropic filtering level. |
| `gpuShadowQuality` | `'pcf_soft' \| 'pcf' \| 'vsm' \| 'off'` | `'pcf_soft'` | Simulation Settings Modal; selects directional solar shadow filtering mode. |
| `gpuBloomEnabled` | `boolean` | `true` | Simulation Settings Modal; toggles `UnrealBloomPass` HDR emissive glow. |
| `gpuBloomStrength` | `number` (`0.00` – `1.50`) | `0.36` | Persisted in `capy_game_settings_v1`; controls baseline HDR bloom strength. |
| `gpuSsaoEnabled` | `boolean` | `true` | Simulation Settings Modal; toggles linearized depth-buffer cavity ambient occlusion. |
| `gpuSharpenAmount` | `number` (`0.00` – `1.00`) | `0.28` | Simulation Settings Modal; controls foreground Contrast-Adaptive Unsharp Mask (CAS) crispness. |
