import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

// Linting exists here for one specific bug that has now happened twice.
//
// A value gets used inside useMemo or useEffect but left out of the dependency
// list, so the calculation never re-runs and the screen quietly shows stale
// data. The build passes. Nothing warns. The only way it was caught both times
// was noticing wrong numbers on screen.
//
// react-hooks/exhaustive-deps finds exactly that, which is why it is an error
// here rather than a warning - a warning would scroll past.
export default [
  { ignores: ['dist/**', 'android/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The two that have actually caught bugs here, kept as errors.
      //
      // no-undef found two crashes in one sitting: a variable used in one
      // component while only defined in another, which throws the moment the
      // screen opens. Both got through a passing build and a browser check.
      //
      // exhaustive-deps found the stale-list bug twice - a value used in a
      // calculation but missing from its dependency list, so the screen quietly
      // showed old numbers.
      'no-undef': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Unused variables are usually a half-finished edit - a removed feature
      // leaving its import behind, or a renamed prop still referenced.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],

      // The newer compiler-oriented rules are about performance and style
      // rather than correctness. Worth seeing, but as warnings - fifteen of
      // them as errors is how a real one gets scrolled past.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
]
