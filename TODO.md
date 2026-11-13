# CapyGame 3D -- Active Roadmap & TODO

This document tracks pending architectural and gameplay enhancements for **CapyGame 3D**.

> [!NOTE]
> **Task Hygiene Rule**: Do not leave completed items in `TODO.md`. When a task or milestone is finished, remove it immediately rather than checking it off. Never use emojis or ASCII art in documentation files.

For subsystem references, see:
- **Technical Architecture & Engine Reference**: [`GAME.md`](./GAME.md)
- **Testing & Verification Guide**: [`TESTING.md`](./TESTING.md)
- **Contributor & Agent Playbook**: [`AGENTS.md`](./AGENTS.md)

---

## Milestone 1: WebGPU Performance & Visual Quality

- [ ] **WGSL Compute Shallow-Water Wake Grid (`ContiguousWorldTopology.ts`)**:
  - Port the CPU `24x24` `ShallowWaterFluidSolver` to a 2D `128x128` WGSL compute shader dispatch (`@compute @workgroup_size(8, 8)`) reading and writing GPU storage buffers, propagating wakes and dynamic ripples directly into vertex displacement textures without CPU readback stalls.
- [ ] **GPU Indirect Draw & Occlusion Culling Compute Pass (`HardwareGpuEngine.ts`)**:
  - Implement a GPU-driven indirect draw call compute pipeline (`drawIndexedIndirect`) using GPU storage buffers (`instancedArray`) and bounding-sphere visibility tests to cull distant district foliage, props, and cosmic star clusters entirely on the GPU before render passes.
- [ ] **Clustered Forward+ Tiled Lighting Compute Pass (`WebGpuPipeline.ts`)**:
  - Build a 3D clustered light grid compute shader (`16x9x24` view-frustum clusters) allocating lantern point lights and bioluminescent flora emitters, enabling dozens of dynamic light sources across all five districts with constant-time per-fragment evaluation.
- [ ] **Hardware Subgroup Reductions & Compute Particle Physics (`WebGpuPipeline.ts`)**:
  - Query `device.features.has('subgroups')` and `subgroup-broadcast` for wave-level reductions in the compute particle systems (fireflies, motes, asteroid dust) to maximize ALU throughput and eliminate threadgroup barriers.
- [ ] **Idle-Time Async Pipeline Compilation (`PlayStyleManager.ts`)**:
  - Warm up specialized material variant pipelines (underwater fog, sandstorms, night biomes) incrementally via `requestIdleCallback` after initial boot, ensuring stutter-free district transitions while keeping initial load immediate.
- [ ] **TSL Atmospheric Volumetric Light Shafts & Sun Crepuscular Rays (`RealisticWorldEnvironment.ts`)**:
  - Add a half-resolution raymarching TSL post-processing pass driven by the directional sun/moon vector and shadow depth buffer, adding god rays and atmospheric haze when looking toward the sun through canopy trees.
- [ ] **Temporal Anti-Aliasing (TAA) with History Buffer Accumulation (`WebGpuPipeline.ts`)**:
  - Integrate subpixel Halton jittering on the projection matrix paired with an accumulation history buffer in the TSL `PostProcessing` chain to eliminate specular shimmer on high-frequency metal and water surfaces.

---

## Milestone 2: Contiguous World Expansion & Replay Telemetry

- [ ] **Deterministic Input Ghost Racing on Yuzu Mountain (`fallguys`)**:
  - Record compact quantized input/transform keyframes during Yuzu Mountain summit runs so players can race against their personal-best translucent Capybara ghost.
- [ ] **Cloud Save Import / Export JSON Portability (`ProgressionService.ts`)**:
  - Add one-click JSON export and import in the Simulation Settings modal so players can back up and transfer `capy_game_save_v3` and `capy_game_settings_v1` across browsers and devices.
