import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: [
            'dist/**',
            'build/**',
            'node_modules/**',
            'coverage/**',
            'contracts/openapi.json',
            'public/**',
            '.next/**',
            'next-env.d.ts',
        ],
    },
    { ...js.configs.recommended, files: ['**/*.{js,mjs}'], languageOptions: { globals: globals.node } },
    {
        files: ['scripts/*-smoke.mjs'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
    { ...reactHooks.configs.flat.recommended, files: ['**/*.tsx'] },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-floating-promises': 'error' },
    },
];
