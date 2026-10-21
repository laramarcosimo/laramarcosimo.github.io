/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_ID = Date.now().toString(36);

/** Escribe dist/version.json con el id de esta compilación. */
const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
  },
});

export default defineConfig({
  test: { environment: 'node', setupFiles: ['src/test/setup.ts'], include: ['src/test/**/*.test.ts'], exclude: ['**/._*', '**/node_modules/**'] },
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separa las librerías del código de la app: cada archivo queda por debajo de 500 kB y se cachea mejor.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react')) return 'react';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
