import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import mdx from '@mdx-js/rollup';
import rehypeHighlight from 'rehype-highlight';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    mdx({ rehypePlugins: [rehypeHighlight] }),
    react(),
    viteCommonjs(),
    mode === 'development' && componentTagger(),
    mode !== 'development' &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
        release: {
          name: process.env.VERCEL_GIT_COMMIT_SHA,
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@trace-view-pilot/shared-importer': path.resolve(
        __dirname,
        '../../packages/shared-importer/src'
      ),
    },
  },
  build: {
    sourcemap: true,
  },
}));
