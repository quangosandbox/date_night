// Single-file, fully on-device build (everything inlined) for sharing as one web page.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

process.env.VITE_BACKEND = 'local';

export default defineConfig({
  root: 'client',
  base: './',
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_BACKEND': JSON.stringify('local') },
  build: { outDir: '../dist-artifact', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
});
