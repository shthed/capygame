# Agent Instructions & Operational Playbook -- CapyGame

**CapyGame** is a standalone hardware-accelerated 3D multi-scale universe simulator, sandbox world builder, and multiphysics mini-game archipelago built at the repository root (`src/`, `public/`, `scripts/`).

---

## 1. The Golden Invariants (Non-Negotiable Guardrails)

1. **Never merge without explicit approval**: Never merge a pull request or push directly to `main` without explicit confirmation and approval from the user.
2. **Never use root-relative asset URLs**: Never use `/assets/...` URLs in code or CSS. Always use relative `./assets/...` and maintain `base: './'` in [`vite.config.ts`](./vite.config.ts) so bundles resolve cleanly across GitHub Pages root (`/`) and PR previews (`/pull/<number>/`).
3. **Strict documentation maintenance, zero emojis & no ASCII art**: Never include emojis or ASCII art / box-drawing diagrams in repository markdown files (`.md`). Prefer tables, indented bullet hierarchies, GitHub Flavored Markdown alerts, or Mermaid diagrams. Keep [`README.md`](./README.md), [`GAME.md`](./GAME.md), [`TESTING.md`](./TESTING.md), and [`TODO.md`](./TODO.md) synchronized with code reality.
4. **Off-thread Wasm physics & transferable buffers**: Heavy rigid-body and swept-CCD stepping must execute in [`src/capygame/engine/physics/physics.worker.ts`](./src/capygame/engine/physics/physics.worker.ts) via `SharedArrayBuffer` or zero-allocation transferable `Float32Array` buffers.
5. **Zero per-frame allocations in hot paths**: Never instantiate `THREE.Vector3`, `THREE.Matrix4`, `THREE.Color`, objects, or arrays inside `requestAnimationFrame` loops, `PlayStyleManager.tick()`, or GPU particle/physics substeps. Reuse module-scoped scratch structs and typed arrays (`Float32Array`).
6. **Never leave completed items in `TODO.md`**: Remove completed tasks from [`TODO.md`](./TODO.md) immediately rather than checking them off with `[x]`.
7. **Always display working thoughts & structured status updates**: Explain what file or subsystem is being inspected or modified, why, priority (`P0`, `P1`, `P2`), complexity (`Low`, `Medium`, `High`), estimated step duration, and overall ETA.
8. **Verify builds, unit tests & Play Store preflight before finishing**: Add or update unit tests for code changes and always run `npm run lint`, `npm run test:unit`, `npm run build`, and `npm run verify:playstore` cleanly before completing code changes. Keep `package-lock.json` synchronized as the single lockfile (never leave `bun.lock` behind).
9. **SemVer & `CHANGELOG.md` synchronization**: For every non-doc code change, bump `package.json`, `package-lock.json`, `src/capygame/config/appVersion.ts`, `vite.config.ts`, and `twa-manifest.json` (`appVersionName` and `appVersionCode`) using SemVer (`patch` for fixes/perf/CI, `minor` for new features, `major` only when explicitly requested) and add a plain-English `## [X.Y.Z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md` before running verification commands.
10. **Cold-boot lazy chunk & cloud token hygiene**: Never allow `dist/index.html` to eagerly preload `vendor-three`, `feature-universe`, `feature-capytorio`, or `accounts.google.com/gsi/client` (keep shared non-Three modules in `capy-shared-core` and lazy-load Google Identity Services only when the player initiates Google Drive sign-in). Keep Google Drive OAuth access tokens (`drive.file` scope via `VITE_GOOGLE_CLIENT_ID`, zero Firebase SDK or Google API keys) strictly in JavaScript memory (never `localStorage`/`sessionStorage`), revoke/clear tokens on sign-out or HTTP 401 expiry, and require explicit in-app side-by-side confirmation before any save overwrite, restore, or cloud deletion.

---

## 2. Repository Structure

| Subsystem | Location | Scope |
| :--- | :--- | :--- |
| **React Shell & HUD** | `src/App.tsx`, `src/capygame/components/CapyGameView.tsx`, `CapySettingsModal.tsx`, `CapySaveSyncPanel.tsx` | Single `40px` (`h-10`) safe-area-aware top bar, 3-mode switcher (`Infinite Zoom`, `Forest Games`, `Capytorio`), lazy engine & modal loaders, Scale Atlas, Cosmic Optics, Basic/Advanced Settings, Save Backup & Cloud Sync |
| **3D World & Universe Engine** | `src/capygame/engine/*.ts` | 3 standalone modes (pure `10^+30 m` to `10^-35 m` Infinite Zoom, unified bridgeless Forest island, Capytorio factory), lazy `ForestDistrictBuilders` & `ForestMicroDioramaBuilder`, 4-tier 60 FPS Capybara LOD, GLSL shaders |
| **Hardware WebGL2 GPU & VFX** | `src/capygame/engine/gpu/*.ts` | Standardized WebGL2 renderer, Sobel tangent-space PBR synthesizer, PMREM IBL, texel-snapped shadow cascade, `EffectComposer` Bloom/SSAO/DoF/CAS, SoA `InstancedMesh` VFX |
| **Multiphysics Engine** | `src/capygame/engine/physics/*.ts` | `@dimforge/rapier3d-compat` Wasm worker, `ContiguousWorldTopology` unified Forest island & Capytorio terrain, XPBD soft-body pads, shallow-water buoyancy |
| **Audio, Progression & Cloud Sync** | `src/capygame/services/*.ts`, `src/services/*.ts` | Web Audio compressor/reverb synthesizer, full-profile `capygame-save-bundle-v2` (`ProgressionService.ts`, `SaveSyncMath.ts`), direct lazy-loaded GIS Google Drive sync (`CloudSyncService.ts`), Android Play Games bridge & hardware Back sentinel (`NativeBridge.ts`), offline PWA service worker |
| **E2E, Play Store & Showcase Automation** | `scripts/*.mjs`, `twa-manifest.json`, `public/.well-known/assetlinks.json` | Play Store packaging & cold-boot preflight (`verify-playstore-readiness.mjs`), headless Playwright 3D E2E (`test-capygame.mjs`), PWA offline test (`test-pwa-offline.mjs`), gallery screenshot capture |

---

## 3. Build & Verification Commands

From the repository root:

```bash
npm ci                       # Clean dependency install
npm run lint                 # Strict TypeScript check (tsc -p tsconfig.json --noEmit)
npm run test:unit            # Fast deterministic unit tests (node:test via tsx, 8 suites)
npm run build                # Compile production bundle into dist/
npm run verify:playstore     # Validate TWA/PWA manifests, assets & cold-boot preload diet
npm run dev                  # Start Vite dev server on http://localhost:3000
npm run preview              # Serve dist/ on http://localhost:3000
npm run test:game            # Run full Playwright 3D E2E test suite
npm run test:pwa             # Run offline PWA & Service Worker verification
npm run gallery:capture      # Capture 3D district showcase screenshots
npm run gallery:capture:zoom # Capture all 27 logarithmic universe scale screenshots
```
