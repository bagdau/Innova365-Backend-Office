import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(@codemirror|@lezer|codemirror|style-mod|w3c-keyname|crelt)\//.test(id)) return 'editor';
          if (/node_modules\/(react|react-dom|scheduler|clsx)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  server: { port: 5180, proxy: { '/api': { target: 'http://localhost:8200', changeOrigin: true } } },
});
