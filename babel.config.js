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
    ...(process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []),
  ],
};
