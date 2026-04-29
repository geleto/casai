// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		files: ['src/**/*.ts', 'tests/**/*.ts'],
		extends: [
			js.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: true,
			},
		},
		rules: {
			// Base formatting
			"indent": ["error", "tab", { "SwitchCase": 1 }],
			'linebreak-style': 'off',

			// Spacing rules
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'comma-spacing': ['error', { before: false, after: true }],
			'keyword-spacing': ['error', { before: true, after: true }],
			'space-infix-ops': 'error',
			'space-before-blocks': 'error',
			'space-before-function-paren': 'off',
			'space-in-parens': ['error', 'never'],
			'no-multi-spaces': 'error',

			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-deprecated": "off",
			"@typescript-eslint/no-useless-default-assignment": "off",
			'@typescript-eslint/restrict-template-expressions': 'off',
			'preserve-caught-error': 'off',

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					"argsIgnorePattern": "^_",
					"varsIgnorePattern": "^_"
				}
			]
		}
	},
	{
		files: ['tests/**/*.ts'],
		rules: {
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
		},
	}
);
