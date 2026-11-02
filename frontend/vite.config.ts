/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['frontend/src/**/*.test.{ts,tsx}', 'backend/tests/**/*.test.ts'],
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(import.meta.dirname, './src/tests/setup.ts'),
  },
});
