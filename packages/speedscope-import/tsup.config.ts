import { defineConfig } from 'tsup';
import fs from 'fs-extra';
import path from 'path';

export default defineConfig({
    entry: ['src/lib.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    // Bundle workspace dependencies since this is a utility package
    noExternal: ['@flamedeck/speedscope-core'],
    external: ['long', 'pako', 'uint8array-json-parser'],
    onSuccess: async () => {
        console.log('Build successful!');
        await generateDistPackageJson();
    },
});

async function generateDistPackageJson() {
    const rootPackageJsonPath = path.resolve(__dirname, 'package.json');
    const distDir = path.resolve(__dirname, 'dist');
    const distPackageJsonPath = path.resolve(distDir, 'package.json');

    try {
        const packageJsonContent = await fs.readJson(rootPackageJsonPath);

        const distPackageJson = {
            name: packageJsonContent.name,
            version: packageJsonContent.version,
            description: packageJsonContent.description,
            type: packageJsonContent.type,
            main: './lib.js',
            types: './lib.d.ts',
            exports: {
                '.': {
                    types: './lib.d.ts',
                    import: './lib.js',
                },
            },
            files: [
                'lib.js',
                'lib.js.map',
                'lib.d.ts',
                'README.md',
            ],
            keywords: packageJsonContent.keywords,
            author: packageJsonContent.author,
            license: packageJsonContent.license,
            repository: packageJsonContent.repository,
            homepage: packageJsonContent.homepage,
            bugs: packageJsonContent.bugs,
            sideEffects: packageJsonContent.sideEffects,
            dependencies: {
                // Only external dependencies (not bundled workspace packages)
                // Note: @flamedeck/speedscope-core is bundled, so it's not included here
                long: packageJsonContent.dependencies.long,
                pako: packageJsonContent.dependencies.pako,
                'uint8array-json-parser': packageJsonContent.dependencies['uint8array-json-parser'],
            },
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
    } catch (error) {
        console.error('Error creating dist package.json:', error);
        throw error;
    }
}
