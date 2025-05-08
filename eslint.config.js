import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/", 
      "node_modules/", 
      ".nx/", 
      ".yarn/", 
      "tmp/", 
      "**/*.gen.ts", 
      "coverage/", 
      "apps/client/dist/",
      "supabase/functions/"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "**/*.config.js", 
      "**/*.config.ts", 
      "**/*.config.cjs",
      "**/vite-env.d.ts",
      "**/examples/**" // Exclude example directories from typed-linting block
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          "./apps/client/tsconfig.app.json",
          "./packages/shared-importer/tsconfig.json",
          "./packages/client-uploader/tsconfig.lib.json"
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      "no-debugger": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-dupe-keys": "error",
      "no-empty": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  }
);
