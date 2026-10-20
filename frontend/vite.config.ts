import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Identificador único de cada compilación; el cliente lo compara con /version.json para auto-actualizarse
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_ID }) });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        // Librerías pesadas en chunks propios: se cachean entre versiones y recharts solo carga en Reportes
        // Тяжёлые библиотеки — отдельными чанками. recharts и его зависимости (d3-*, victory-vendor…) грузятся только на странице «Отчёты»:
        // общие мелкие пакеты (clsx и т.п.) остаются в основном чанке, иначе вход в приложение тянул бы 390 КБ графиков.
        manualChunks(id: string) {
          if (id.includes('commonjsHelpers')) return 'react'; // хелперы CJS нужны входу — не прячем в чанк графиков
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(recharts|recharts-scale|d3-[^/]+|victory-vendor|internmap|decimal\.js-light|react-smooth|fast-equals|eventemitter3|tiny-invariant|lodash)\//.test(id)) return 'charts';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge)\//.test(id)) return 'react';
          if (/node_modules\/(@tanstack|axios|zustand)\//.test(id)) return 'query';
          if (/node_modules\/@supabase\//.test(id)) return 'supabase';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
