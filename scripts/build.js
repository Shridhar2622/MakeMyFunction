import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

async function buildExtension() {
  console.log('[MakeMyFunction Build] Building extension scripts as IIFE standalone bundles...');

  // 1. Build Content Script as standalone IIFE (no imports, no code splitting)
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      lib: {
        entry: resolve('src/content/index.ts'),
        name: 'MakeMyFunctionContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  // 2. Build Main World Bridge as standalone IIFE
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve('src/editor/mainWorldBridge.ts'),
        name: 'MakeMyFunctionMainWorld',
        formats: ['iife'],
        fileName: () => 'mainWorldBridge.js'
      }
    }
  });

  // 3. Build Background Service Worker as standalone IIFE
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve('src/background/index.ts'),
        name: 'MakeMyFunctionBackground',
        formats: ['iife'],
        fileName: () => 'background.js'
      }
    }
  });

  // 4. Build Extension Popup UI (HTML + React)
  await build({
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          popup: resolve('index.html')
        }
      }
    }
  });

  console.log('[MakeMyFunction Build] Extension build completed successfully! All scripts are IIFE standalone bundles.');
}

buildExtension().catch((err) => {
  console.error('[MakeMyFunction Build] Build failed:', err);
  process.exit(1);
});
