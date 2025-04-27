// vite.config.ts
import { defineConfig } from "file:///Users/zacharymarion/src/trace-view-pilot/.yarn/__virtual__/vite-virtual-5f7c64b596/3/.yarn/berry/cache/vite-npm-5.4.18-7cad39367b-10c0.zip/node_modules/vite/dist/node/index.js";
import react from "file:///Users/zacharymarion/src/trace-view-pilot/.yarn/__virtual__/@vitejs-plugin-react-swc-virtual-a2d207393e/3/.yarn/berry/cache/@vitejs-plugin-react-swc-npm-3.9.0-b06089e6d1-10c0.zip/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { componentTagger } from "file:///Users/zacharymarion/src/trace-view-pilot/.yarn/__virtual__/lovable-tagger-virtual-770e62dd3f/3/.yarn/berry/cache/lovable-tagger-npm-1.1.8-9db03953a1-10c0.zip/node_modules/lovable-tagger/dist/index.js";
import { viteCommonjs } from "file:///Users/zacharymarion/.yarn/berry/cache/@originjs-vite-plugin-commonjs-npm-1.0.3-75b36e7757-10c0.zip/node_modules/@originjs/vite-plugin-commonjs/lib/index.js";
import mdx from "file:///Users/zacharymarion/src/trace-view-pilot/.yarn/__virtual__/@mdx-js-rollup-virtual-c748d4091c/3/.yarn/berry/cache/@mdx-js-rollup-npm-3.1.0-6594fd6ead-10c0.zip/node_modules/@mdx-js/rollup/index.js";
var __vite_injected_original_dirname = "/Users/zacharymarion/src/trace-view-pilot/apps/client";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    react(),
    mdx(),
    viteCommonjs(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@trace-view-pilot/shared-importer": path.resolve(__vite_injected_original_dirname, "../../packages/shared-importer/src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvemFjaGFyeW1hcmlvbi9zcmMvdHJhY2Utdmlldy1waWxvdC9hcHBzL2NsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3phY2hhcnltYXJpb24vc3JjL3RyYWNlLXZpZXctcGlsb3QvYXBwcy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3phY2hhcnltYXJpb24vc3JjL3RyYWNlLXZpZXctcGlsb3QvYXBwcy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcbmltcG9ydCB7IHZpdGVDb21tb25qcyB9IGZyb20gJ0BvcmlnaW5qcy92aXRlLXBsdWdpbi1jb21tb25qcyc7XG5pbXBvcnQgbWR4IGZyb20gJ0BtZHgtanMvcm9sbHVwJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA4MDgwLFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBtZHgoKSxcbiAgICB2aXRlQ29tbW9uanMoKSxcbiAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmXG4gICAgY29tcG9uZW50VGFnZ2VyKCksXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgXCJAdHJhY2Utdmlldy1waWxvdC9zaGFyZWQtaW1wb3J0ZXJcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi8uLi9wYWNrYWdlcy9zaGFyZWQtaW1wb3J0ZXIvc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlWLFNBQVMsb0JBQW9CO0FBQzlXLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxTQUFTO0FBTGhCLElBQU0sbUNBQW1DO0FBUXpDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLElBQUk7QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVMsaUJBQ1QsZ0JBQWdCO0FBQUEsRUFDbEIsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDcEMscUNBQXFDLEtBQUssUUFBUSxrQ0FBVyxvQ0FBb0M7QUFBQSxJQUNuRztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
