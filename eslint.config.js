import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.nx/',
      '.yarn/',
      'tmp/',
      '**/*.gen.ts',
      'coverage/',
      'apps/client/dist/',
      'supabase/functions/',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.cjs',
      '**/vite-env.d.ts',
      '**/examples/**', // Exclude example directories from typed-linting block
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          './apps/client/tsconfig.app.json',
          './packages/client-uploader/tsconfig.lib.json',
          './packages/speedscope-theme/tsconfig.json',
          './packages/speedscope-gl/tsconfig.json',
          './packages/speedscope-import/tsconfig.json',
          './packages/speedscope-core/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-debugger': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-dupe-keys': 'error',
      'no-empty': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  // Prettier integration - MUST BE LAST to override other formatting rules
  {
    files: ['**/*.{ts,tsx,js,jsx,json,html,css,md,mdx,yaml,yml}'], // Files Prettier should format
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules, // Disables ESLint rules that conflict with Prettier
      'prettier/prettier': 'warn', // Runs Prettier as an ESLint rule and reports differences as warnings
    },
  }
);
