module.exports = {
  preset: '@react-native/jest-preset',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-reanimated|react-native-vector-icons|@react-navigation|react-native-track-player|@react-native-firebase|react-native-linear-gradient|react-native-fast-image|react-native-blob-util|react-native-fs|react-native-modal)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '.*MusicPlayerFunctions$': '<rootDir>/__mocks__/MusicPlayerFunctions.js',
    '.*NativeStreaming$': '<rootDir>/__mocks__/NativeStreaming.js',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native-paper$': '<rootDir>/__mocks__/reactNativePaper.js',
    '^@react-navigation/native$':
      '<rootDir>/__mocks__/reactNavigationNative.js',
    '^@react-navigation/native-stack$':
      '<rootDir>/__mocks__/reactNavigationNativeStack.js',
    '^@react-navigation/bottom-tabs$':
      '<rootDir>/__mocks__/reactNavigationBottomTabs.js',
  },
};
