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

const PACKAGE_VERSION = (() => {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof parsed.version === 'string' && parsed.version.trim()
      ? parsed.version.trim()
      : '1.2.4';
  } catch {
    return '1.2.4';
  }
})();

export default defineConfig({
  base: './',
  define: {
    __CAPYGAME_VERSION__: JSON.stringify(PACKAGE_VERSION),
  },
  plugins: [react(), tailwindcss(), capytorioLuaSourcesPlugin(), disableViteHmrWebSocketPlugin()],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (
            norm.includes('/node_modules/react/') ||
            norm.includes('/node_modules/react-dom/') ||
            norm.includes('/node_modules/scheduler/') ||
            norm.includes('/node_modules/lucide-react/') ||
            norm.includes('vite/preload-helper')
          ) {
            return 'vendor-react';
          }
          if (norm.includes('/src/capygame/engine/gpu/GpuEngineTypes.ts')) {
            return 'capy-gpu-types';
          }
          if (norm.includes('/node_modules/three/')) {
            return 'vendor-three';
          }
          if (
            !norm.includes('/CapytorioStateGuard.ts') &&
            !norm.includes('/CapytorioModuleLoader.ts') &&
            !norm.includes('/CapytorioEntityInfoPanel.tsx') &&
            !norm.includes('/CapytorioPediaView.tsx') &&
            (norm.includes('/src/capygame/engine/Capytorio') ||
              norm.includes('/src/capygame/engine/capytorioLuaDefaults.ts') ||
              norm.includes('/src/capygame/engine/FactorioBlueprintCodec.ts') ||
              norm.includes('/src/capygame/engine/capytorio/') ||
              norm.includes('/src/capygame/components/Capytorio') ||
              norm.includes('/src/capygame/components/capytorio/'))
          ) {
            return 'feature-capytorio';
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
    noDiscovery: true,
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
      'three/examples/jsm/environments/RoomEnvironment.js',
      'three/examples/jsm/lights/RectAreaLightUniformsLib.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/OutputPass.js',
      'three/examples/jsm/postprocessing/Pass.js',
      'three/examples/jsm/postprocessing/ShaderPass.js',
      'three/examples/jsm/postprocessing/UnrealBloomPass.js',
      'three/examples/jsm/shaders/CopyShader.js',
      'three/examples/jsm/shaders/FXAAShader.js',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.playwright-cli/**',
        '**/.aistudio/**',
        '**/dist/**',
        '**/docs/**',
        '**/scripts/**',
        '**/public/assets/**',
      ],
    },
  },
});

