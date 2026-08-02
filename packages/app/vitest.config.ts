/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

// Reuses the @ alias; tests run in node (pure service functions only).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
  },
});
