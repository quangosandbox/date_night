import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BACKEND=local builds the self-contained app (iOS / shareable web): relative asset paths,
// and the API runs on-device instead of calling a server.
const local = process.env.VITE_BACKEND === 'local';

export default defineConfig({
  root: 'client',
  base: local ? './' : '/',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
