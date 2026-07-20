/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const name = chunkInfo.name.replace(/\.ts-loader$/, '-loader').replace(/\.ts$/, '').replace(/\.tsx$/, '');
          return `assets/${name}.js`;
        },
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name.replace(/\.ts-loader$/, '-loader').replace(/\.ts$/, '').replace(/\.tsx$/, '');
          return `assets/${name}.js`;
        },
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@/': path.resolve(__dirname, 'src') + '/',
    },
  },
});
