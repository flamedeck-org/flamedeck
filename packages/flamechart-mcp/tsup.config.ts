import { defineConfig } from 'tsup';

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
        noExternal: ['@flamedeck/speedscope-core', '@flamedeck/speedscope-import', '@flamedeck/flamechart-to-png'],
        external: ['canvas', 'sharp'],
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
            js: '#!/usr/bin/env node',
        },
        // Bundle workspace dependencies but exclude native dependencies
        noExternal: ['@flamedeck/speedscope-core', '@flamedeck/speedscope-import', '@flamedeck/flamechart-to-png'],
        external: ['canvas', 'sharp'],
        esbuildOptions(options) {
            // Remove the shebang from the source since we're adding it via banner
            options.banner = undefined;
        },
    },
]); 