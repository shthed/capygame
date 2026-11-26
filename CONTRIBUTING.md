# Contributing to CapyGame

Thank you for your interest in contributing to **CapyGame** ([`https://github.com/capyboop/capygame`](https://github.com/capyboop/capygame), live at [`https://capyboop.com/`](https://capyboop.com/)).

**Related Guides**: [`README.md`](./README.md) | [`SUPPORT.md`](./SUPPORT.md) | [`SECURITY.md`](./SECURITY.md) | [`GAME.md`](./GAME.md) | [`TESTING.md`](./TESTING.md) | [`LICENSE.md`](./LICENSE.md)

---

## Ways to Contribute

- **Report Bugs**: Open a [Bug Report](https://github.com/capyboop/capygame/issues/new/choose) with your browser/device, GPU adapter (WebGL2), and reproduction steps.
- **Suggest Features or Factory / World Ideas**: Use the [Feature Request form](https://github.com/capyboop/capygame/issues/new/choose).
- **Submit Pull Requests**: Fork `https://github.com/capyboop/capygame`, create a focused branch from `main`, and open a Pull Request using [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md).

---

## Local Development Setup

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Required Checks Before Opening a Pull Request

Run the verification suite from the repository root:

```bash
npm run lint && npm run test:unit && npm run build
```

- `npm run lint`: Runs strict TypeScript type-checking (`tsc -p tsconfig.json --noEmit`).
- `npm run test:unit`: Runs the fast deterministic `node:test` unit suite across all 6 test files (`ProgressionAndPhysics.test.ts`, `UniverseAndGpuMath.test.ts`, `CapytorioFactoryEngine.test.ts`, `forestMicroSpecimens.test.ts`, `UfoFlightSequence.test.ts`, and `TutorialCatalog.test.ts`).
- `npm run build`: Builds the production Vite bundle into `dist/` with relative (`./`) asset paths.
- `npm run test:game` / `npm run test:pwa`: Optional Playwright E2E and offline Service Worker checks when changing rendering, controls, factory gameplay, or PWA caching.

---

## Pull Request Guidelines

- Keep changes focused on a single bugfix, feature, or documentation improvement.
- Preserve zero per-frame allocations inside `requestAnimationFrame` loops, physics steps, and GPU/VFX updates.
- Keep relative asset paths (`./assets/...` and `base: './'`) so builds work at both root domains and subpaths.
- Add or update unit tests when changing engine, physics, Capytorio factory, or progression logic.
- Keep relevant documentation in sync (`README.md`, `GAME.md`, `TESTING.md`, `TODO.md`) without emojis or ASCII box-drawing art.
- Never commit secrets, API tokens, or personal data.

---

## License and Contributor Agreement

By submitting a contribution, you agree to the terms in [`LICENSE.md`](./LICENSE.md) (CC BY-NC-SA 4.0 and the Capybara Chill Preamble).
