import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function capytorioLuaSourcesPlugin(): Plugin {
  const recipeLuaPath = path.resolve(process.cwd(), 'public/data/capytorio/recipe.lua');
  const techLuaPath = path.resolve(process.cwd(), 'public/data/capytorio/technology.lua');

  return {
    name: 'capy:capytorio-lua-sources',
    enforce: 'pre',
    configureServer(server) {
      server.watcher.add([recipeLuaPath, techLuaPath]);
    },
    transform(_code, id) {
      const normalized = id.replace(/\\/g, '/');
      if (normalized.endsWith('/src/capygame/engine/capytorioLuaDefaults.ts')) {
        this.addWatchFile(recipeLuaPath);
        this.addWatchFile(techLuaPath);
        const recipeSrc = fs.existsSync(recipeLuaPath) ? fs.readFileSync(recipeLuaPath, 'utf8') : '';
        const techSrc = fs.existsSync(techLuaPath) ? fs.readFileSync(techLuaPath, 'utf8') : '';
        return {
          code: `export const DEFAULT_RECIPE_LUA_SOURCE = ${JSON.stringify(recipeSrc)};\nexport const DEFAULT_TECH_LUA_SOURCE = ${JSON.stringify(techSrc)};\n`,
          map: null,
        };
      }
      return null;
    },
  };
}

function disableViteHmrWebSocketPlugin(): Plugin {
  return {
    name: 'capy:disable-vite-hmr-websocket',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return {
          code: code
            .replace(
              /console\.debug\("\[vite\] connecting\.\.\."\);?/g,
              '/* [vite] hmr websocket disabled */'
            )
            .replace(
              /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
              '/* transport.connect disabled when hmr is false */'
            ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), capytorioLuaSourcesPlugin(), disableViteHmrWebSocketPlugin()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    holdUntilCrawlEnd: false,
    esbuildOptions: {
      sourcemap: false,
    },
    exclude: ['@dimforge/rapier3d-compat'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'lucide-react',
      'three',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    watch: {
      ignored: ['**/.playwright-cli/**', '**/.aistudio/**', '**/dist/**', '**/docs/**'],
    },
  },
});

