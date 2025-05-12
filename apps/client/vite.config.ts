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
      '@flamedeck/speedscope-import': path.resolve(
        __dirname,
        '../../packages/speedscope-import/src'
      ),
      '@flamedeck/speedscope-core': path.resolve(__dirname, '../../packages/speedscope-core/src'),
      '@flamedeck/speedscope-theme': path.resolve(__dirname, '../../packages/speedscope-theme/src'),
      '@flamedeck/speedscope-gl': path.resolve(__dirname, '../../packages/speedscope-gl/src'),
    },
  },
  build: {
    sourcemap: true,
  },
}));
