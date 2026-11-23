# Security Policy

**Related Guides**: [`README.md`](./README.md) | [`CONTRIBUTING.md`](./CONTRIBUTING.md) | [`SUPPORT.md`](./SUPPORT.md) | [`GAME.md`](./GAME.md)

---

## Supported Versions

Security fixes are applied to the latest production release:

- **Production (`main` / [`https://capyboop.com/`](https://capyboop.com/))**: Supported
- **Older Releases (prior Git tags)**: Not supported

---

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub Issues or Pull Requests.

Instead, report vulnerabilities privately using **GitHub Private Vulnerability Reporting**:

- [Open a Private Security Advisory](https://github.com/capyboop/capygame/security/advisories/new)

Please include:

- A clear description of the vulnerability and potential impact.
- Steps to reproduce or a minimal proof of concept.
- Affected subsystem (React HUD, Three.js / WebGPU renderer, Rapier3D physics worker, Capytorio Lua parser, or PWA Service Worker).

We will acknowledge receipt, investigate, and coordinate a fix before public disclosure.

---

## Security Architecture Notes

- **100% Local-First Execution**: All 3D rendering, physics simulation (`physics.worker.ts`), procedural world generation, and Capytorio Lua parsing execute locally in your browser.
- **No Accounts or External Telemetry**: Saves (`capy_game_save_v3`), settings (`capy_game_settings_v1`), and world configs (`capy_game_procedural_config_v1`) remain strictly in on-device browser storage.
- **Custom Lua Parsing**: Capytorio `recipe.lua` and `technology.lua` imports are parsed by a pure static table parser (`CapytorioLuaParser.ts`) without executing arbitrary Lua or JavaScript code.
