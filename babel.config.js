module.exports = {
  presets: [
    [
      'module:@react-native/babel-preset',
      {
        jsxRuntime: 'automatic',
      },
    ],
  ],
  plugins: [
    'react-native-worklets/plugin',
    // Remove console logs in production
    process.env.NODE_ENV === 'production' && 'transform-remove-console',
  ].filter(Boolean),
};
