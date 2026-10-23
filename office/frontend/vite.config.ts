import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler|clsx)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  server: { port: 5190, proxy: { '/api': { target: 'http://localhost:8300', changeOrigin: true } } },
});
