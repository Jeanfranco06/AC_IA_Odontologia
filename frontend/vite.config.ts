/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  cacheDir: path.resolve(import.meta.dirname, './node_modules/.vite'),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['frontend/src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(import.meta.dirname, './src/tests/setup.ts'),
  },
});
