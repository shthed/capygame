import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
  plugins: [react(), tailwindcss(), disableViteHmrWebSocketPlugin()],
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

