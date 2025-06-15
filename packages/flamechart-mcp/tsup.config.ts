import { defineConfig } from 'tsup';
import fs from 'fs-extra';
import path from 'path';

export default defineConfig([
  // Main library entry
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    // Bundle workspace dependencies but exclude native dependencies
    noExternal: [
      '@flamedeck/speedscope-core',
      '@flamedeck/speedscope-import',
      '@flamedeck/flamechart-to-png',
    ],
    external: ['canvas'],
    onSuccess: async () => {
      console.log('Main library build successful!');
      await generateDistPackageJson();
    },
  },
  // CLI entry with executable banner
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: false,
    minify: false,
    banner: {
      js: '#!/usr/bin/env node\n',
    },
    // Bundle workspace dependencies but exclude native dependencies
    noExternal: [
      '@flamedeck/speedscope-core',
      '@flamedeck/speedscope-import',
      '@flamedeck/flamechart-to-png',
    ],
    external: ['canvas'],
    onSuccess: async () => {
      console.log('CLI build successful!');
      // Set execute permissions for the CLI file
      const cliPath = path.resolve(__dirname, 'dist', 'cli.js');
      if (await fs.pathExists(cliPath)) {
        await fs.chmod(cliPath, 0o755);
        console.log('Set execute permissions for cli.js');
      }
    },
  },
]);

async function generateDistPackageJson() {
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
      type: packageJsonContent.type,
      main: './index.js',
      types: './index.d.ts',
      bin: './cli.js',
      exports: {
        '.': {
          types: './index.d.ts',
          import: './index.js',
        },
        './cli': {
          types: './cli.d.ts',
          import: './cli.js',
        },
      },
      files: [
        'index.js',
        'index.js.map',
        'index.d.ts',
        'cli.js',
        'cli.js.map',
        'cli.d.ts',
        'README.md',
        'images/**/*',
      ],
      keywords: packageJsonContent.keywords,
      author: packageJsonContent.author,
      license: packageJsonContent.license,
      repository: packageJsonContent.repository,
      homepage: packageJsonContent.homepage,
      bugs: packageJsonContent.bugs,
      sideEffects: packageJsonContent.sideEffects,
      dependencies: {
        // Only include external dependencies (those not bundled)
        fastmcp: packageJsonContent.dependencies.fastmcp,
        long: packageJsonContent.dependencies.long,
        pako: packageJsonContent.dependencies.pako,
        tslib: packageJsonContent.dependencies.tslib,
        'uint8array-json-parser': packageJsonContent.dependencies['uint8array-json-parser'],
        zod: packageJsonContent.dependencies.zod,
        // Add external native dependencies that are not bundled
        canvas: '^3.1.0',
      },
      peerDependencies: packageJsonContent.peerDependencies || {},
    };

    await fs.ensureDir(distDir);
    await fs.writeJson(distPackageJsonPath, distPackageJson, { spaces: 2 });
    console.log('Successfully created package.json in dist');

    // Copy README.md to dist if it exists
    const readmePath = path.resolve(__dirname, 'README.md');
    const distReadmePath = path.resolve(distDir, 'README.md');

    if (await fs.pathExists(readmePath)) {
      await fs.copy(readmePath, distReadmePath);
      console.log('Successfully copied README.md to dist');
    }

    // Copy images directory to dist if it exists
    const imagesPath = path.resolve(__dirname, 'images');
    const distImagesPath = path.resolve(distDir, 'images');

    if (await fs.pathExists(imagesPath)) {
      await fs.copy(imagesPath, distImagesPath);
      console.log('Successfully copied images directory to dist');
    }
  } catch (error) {
    console.error('Error creating dist package.json:', error);
    throw error;
  }
}
