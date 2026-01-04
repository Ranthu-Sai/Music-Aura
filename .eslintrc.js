module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    'prettier/prettier': 0,
    'quotes':0,
    'no-unstable-nested-components':0,
    'semi':0,
  },
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**', '**/*.test.*', '**/*.spec.*'],
      env: { jest: true, node: true },
      globals: { jest: true },
    },
  ],
};
