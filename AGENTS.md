# Agent Instructions & Operational Playbook — CapyGame 3D

**CapyGame 3D** is a standalone hardware-accelerated 3D multi-scale universe simulator, sandbox world builder, and multiphysics mini-game archipelago built at the repository root (`src/`, `public/`, `scripts/`).

---

## 1. The Golden Invariants (Non-Negotiable Guardrails)

1. **Never merge without explicit approval**: Never merge a pull request or push directly to `main` without explicit confirmation and approval from the user.
2. **Never use root-relative asset URLs**: Never use `/assets/...` URLs in code or CSS. Always use relative `./assets/...` and maintain `base: './'` in [`vite.config.ts`](./vite.config.ts) so bundles resolve cleanly across GitHub Pages root (`/`) and PR previews (`/pull/<number>/`).
3. **Strict documentation maintenance, zero emojis & no ASCII art**: Never include emojis or ASCII art / box-drawing diagrams in repository markdown files (`.md`). Prefer tables, indented bullet hierarchies, GitHub Flavored Markdown alerts, or Mermaid diagrams. Keep [`README.md`](./README.md), [`GAME.md`](./GAME.md), [`TESTING.md`](./TESTING.md), and [`TODO.md`](./TODO.md) synchronized with code reality.
4. **Off-thread Wasm physics & transferable buffers**: Heavy rigid-body and swept-CCD stepping must execute in [`src/capygame/engine/physics/physics.worker.ts`](./src/capygame/engine/physics/physics.worker.ts) via `SharedArrayBuffer` or zero-allocation transferable `Float32Array` buffers.
5. **Zero per-frame allocations in hot paths**: Never instantiate `THREE.Vector3`, `THREE.Matrix4`, `THREE.Color`, objects, or arrays inside `requestAnimationFrame` loops, `PlayStyleManager.tick()`, or GPU particle/physics substeps. Reuse module-scoped scratch structs and typed arrays (`Float32Array`).
6. **Never leave completed items in `TODO.md`**: Remove completed tasks from [`TODO.md`](./TODO.md) immediately rather than checking them off with `[x]`.
7. **Always display working thoughts & structured status updates**: Explain what file or subsystem is being inspected or modified, why, priority (`P0`, `P1`, `P2`), complexity (`Low`, `Medium`, `High`), estimated step duration, and overall ETA.
8. **Verify builds before finishing**: Always run `npm run lint` and `npm run build` cleanly before completing code changes.

---

## 2. Repository Structure

| Subsystem | Location | Scope |
| :--- | :--- | :--- |
| **React Shell & HUD** | `src/App.tsx`, `src/capygame/components/CapyGameView.tsx` | Single `40px` (`h-10`) top bar, 65-order Scale Atlas, Cosmic Optics, Live Inspector, World Dock, Settings |
| **3D World & Universe Engine** | `src/capygame/engine/*.ts` | Contiguous 5-district world, 4-tier 60 FPS Capybara LOD, `10^+30 m` to `10^-35 m` `1:1` Universe Simulator, astrophysical shaders |
| **Hardware GPU & VFX Pipeline** | `src/capygame/engine/gpu/*.ts` | Sobel tangent-space PBR synthesizer, PMREM IBL, texel-snapped shadow cascade, `EffectComposer` Bloom/SSAO/DoF/CAS, SoA `InstancedMesh` VFX |
| **Multiphysics Engine** | `src/capygame/engine/physics/*.ts` | `@dimforge/rapier3d-compat` Wasm worker, `ContiguousWorldTopology` Grand Promenade Causeways, XPBD soft-body pads, shallow-water buoyancy |
| **Audio & Progression** | `src/capygame/services/*.ts`, `src/services/*.ts` | Web Audio compressor/reverb synthesizer, persistent `capy_game_save_v3` & `capy_game_settings_v1`, offline PWA service worker |
| **E2E & Showcase Automation** | `scripts/*.mjs` | Headless Playwright 3D E2E verification (`test-capygame.mjs`), PWA offline test (`test-pwa-offline.mjs`), and gallery screenshot capture |

---

## 3. Build & Verification Commands

From the repository root:

```bash
npm ci                       # Clean dependency install
npm run lint                 # Strict TypeScript check (tsc -p tsconfig.json --noEmit)
npm run test:unit            # Fast deterministic unit tests (node:test via tsx)
npm run build                # Compile production bundle into dist/
npm run dev                  # Start Vite dev server on http://localhost:3000
npm run preview              # Serve dist/ on http://localhost:3000
npm run test:game            # Run full Playwright 3D E2E test suite
npm run test:pwa             # Run offline PWA & Service Worker verification
npm run gallery:capture      # Capture 3D district showcase screenshots
npm run gallery:capture:zoom # Capture all 27 logarithmic universe scale screenshots
```
