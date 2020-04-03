module.exports = {
  settings: {
    node: {
      "resolvePaths": [__dirname],
      "tryExtensions": [".ts"]
    }
  },
  extends: [
    'airbnb-typescript/base',
    "plugin:node/recommended",
    'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  rules: {
    'no-underscore-dangle': [ 'error', { allowAfterThis: true }],
    'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    'import/prefer-default-export': 'off',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module'
  },
};
