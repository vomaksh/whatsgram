import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
    {
        ignores: ['dist/**', 'out/**', '.vite/**', 'node_modules/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,
    importPlugin.flatConfigs.typescript,
    {
        files: ['**/*.{js,ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
    files: ['eslint.config.mjs'],
    rules: {
      'import/no-unresolved': 'off',
    },
  }
);
