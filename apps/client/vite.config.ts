import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import mdx from '@mdx-js/rollup';
import rehypeHighlight from 'rehype-highlight';

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
}));
