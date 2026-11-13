# CapyGame 3D -- Active Roadmap & TODO

This document tracks pending architectural and gameplay enhancements for **CapyGame 3D**.

> [!NOTE]
> **Task Hygiene Rule**: Do not leave completed items in `TODO.md`. When a task or milestone is finished, remove it immediately rather than checking it off. Never use emojis or ASCII art in documentation files.

For subsystem references, see:
- **Technical Architecture & Engine Reference**: [`WEB.md`](./WEB.md)
- **Testing & Verification Guide**: [`TESTING.md`](./TESTING.md)
- **Contributor & Agent Playbook**: [`AGENTS.md`](./AGENTS.md)

---

## Milestone 1: WebGPU Compute Wake Simulation

- [ ] **WGSL Compute Shallow-Water Wake Grid (`ContiguousWorldTopology.ts`)**:
  - Port the `24x24` `ShallowWaterFluidSolver` to a `128x128` WGSL compute shader for higher-resolution real-time coastal and lagoon wake waves on hardware WebGPU adapters.

---

## Milestone 2: Contiguous World Expansion & Replay Telemetry

- [ ] **Deterministic Input Ghost Racing on Yuzu Mountain (`fallguys`)**:
  - Record compact quantized input/transform keyframes during Yuzu Mountain summit runs so players can race against their personal-best translucent Capybara ghost.
- [ ] **Cloud Save Import / Export JSON Portability (`ProgressionService.ts`)**:
  - Add one-click JSON export and import in the Simulation Settings modal so players can back up and transfer `capy_game_save_v3` and `capy_game_settings_v1` across browsers and devices.
