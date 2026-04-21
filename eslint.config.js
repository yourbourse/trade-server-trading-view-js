import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'charting_library/**',
            'public/**',
            'src/schema/public-api/**',
            '**/*.config.ts',
            '**/*.config.js',
        ],
    },
    js.configs.recommended,
    ...tsPlugin.configs['flat/recommended'],
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',
            // Replacements for the deprecated ban-types rule (was 'off' in original config)
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-wrapper-object-types': 'off',
            quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
            semi: ['warn', 'always'],
        },
    },
];
