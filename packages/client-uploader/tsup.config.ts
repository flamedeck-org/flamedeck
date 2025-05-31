import { defineConfig } from 'tsup';
import fs from 'fs-extra'; // Make sure fs-extra is in devDependencies
import path from 'path'; // path is a Node.js built-in

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'], // Output CJS and ESM
  dts: true, // Generate .d.ts files
  splitting: false, // Recommended for libraries to produce single files per format
  sourcemap: true,
  clean: true, // Clean the dist directory before building
  // If you need to ensure "use client" for React Server Components / Next.js App Router:
  // esbuildOptions(options) {
  //   options.banner = {
  //     js: '"use client";',
  //   };
  // },
  onSuccess: async () => {
    console.log('Build successful with tsup!');

    // Copy README.md to dist directory
    const readmePath = path.resolve(__dirname, 'README.md');
    const distReadmePath = path.resolve(__dirname, 'dist', 'README.md');
    try {
      if (await fs.pathExists(readmePath)) {
        await fs.copy(readmePath, distReadmePath);
        console.log('Successfully copied README.md to dist');
      }
    } catch (error) {
      console.error('Error copying README.md:', error);
    }

    // --- Add package.json generation to dist ---
    const rootPackageJsonPath = path.resolve(__dirname, 'package.json');
    const distDir = path.resolve(__dirname, 'dist');
    const distPackageJsonPath = path.resolve(distDir, 'package.json');

    try {
      const packageJsonContent = await fs.readJson(rootPackageJsonPath);

      // Create a new package.json for the dist folder
      const distPackageJson = {
        name: packageJsonContent.name,
        version: packageJsonContent.version,
        description: packageJsonContent.description,
        type: packageJsonContent.type, // Keep type, tsup generates .js (ESM) and .cjs (CJS)
        main: './index.cjs', // Corrected path for CJS
        module: './index.js', // Corrected path for ESM (when type: "module")
        types: './index.d.ts', // Main types entry
        exports: {
          '.': {
            types: './index.d.ts',
            import: './index.js', // ESM entry (when type: "module")
            require: './index.cjs', // CJS entry
          },
        },
        files: [
          // Explicitly list files in dist that are part of the package
          'index.js',
          'index.js.map',
          'index.cjs',
          'index.cjs.map',
          'index.d.ts',
          'index.d.cts', // For CJS types if generated
          'README.md', // Include README in package files
        ],
        keywords: packageJsonContent.keywords,
        author: packageJsonContent.author,
        license: packageJsonContent.license,
        sideEffects: packageJsonContent.sideEffects,
        dependencies: packageJsonContent.dependencies || {},
        peerDependencies: packageJsonContent.peerDependencies || {},
      };

      await fs.ensureDir(distDir);
      await fs.writeJson(distPackageJsonPath, distPackageJson, { spaces: 2 });
      console.log('Successfully created package.json in dist');
    } catch (error) {
      console.error('Error creating dist package.json:', error);
      throw error; // Fail the build if package.json creation fails
    }
    // --- End package.json generation ---
  },
});
