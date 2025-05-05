import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  root: __dirname,
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlamedeckUpload', // Global variable name for UMD build
      fileName: (format) => `flamedeck-upload.${format}.js`,
      formats: ['es', 'umd'] // Generate ESM and UMD formats
    },
    rollupOptions: {
      // If your library has external dependencies, list them here
      // to prevent them from being bundled into your library.
      // Example: external: ['react']
      external: [], 
      output: {
        // Provide global variables to use in the UMD build
        // for externalized dependencies
        // Example: globals: { react: 'React' }
        globals: {},
      },
    },
    outDir: 'dist',
    emptyOutDir: true, // Ensure the dist directory is cleaned before build
  },
  plugins: [
    dts({ // Generate declaration files
      insertTypesEntry: true, // Create a single index.d.ts entry file
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'), // Use the library tsconfig
    }),
  ],
}); 