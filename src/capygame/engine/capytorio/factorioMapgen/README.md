# Vendored `factorio-mapgen` Nauvis Runtime

This directory bundles the exact Factorio Nauvis noise-expression compiler, WebAssembly SIMD noise kernel, and chunk tile/entity autoplace engine from [`shthed/factorio-mapgen`](https://github.com/shthed/factorio-mapgen).

- **Code License**: MIT License, Copyright (c) 2026 Frank Hamand.
- **Game Data Notice**: `nauvisNoiseData.js` contains extracted vanilla Nauvis noise-expression and autoplace prototype definitions from Factorio (copyright Wube Software). This project is not affiliated with Wube Software.
- **Chunk Budget**: Routed into the lazy-loaded `feature-capytorio-mapgen` Vite chunk so it is never preloaded on cold boot and stays well under the 500 KB feature-chunk budget.
