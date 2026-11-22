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
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'lucide-react',
      'three',
      'three/webgpu',
      'three/tsl',
      'three/examples/jsm/environments/RoomEnvironment.js',
      'three/examples/jsm/lights/RectAreaLightUniformsLib.js',
      'three/examples/jsm/postprocessing/EffectComposer.js',
      'three/examples/jsm/postprocessing/OutputPass.js',
      'three/examples/jsm/postprocessing/Pass.js',
      'three/examples/jsm/postprocessing/ShaderPass.js',
      'three/examples/jsm/postprocessing/UnrealBloomPass.js',
      'three/examples/jsm/shaders/CopyShader.js',
      'three/examples/jsm/shaders/FXAAShader.js',
      'three/addons/tsl/display/BloomNode.js',
      'three/addons/tsl/display/FXAANode.js',
      'three/addons/tsl/display/GTAONode.js',
      'three/addons/tsl/display/TRAANode.js',
      '@dimforge/rapier3d-compat',
      'clsx',
      'tailwind-merge',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
  },
});

