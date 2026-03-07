/* eslint-env jest */
import 'react-native-gesture-handler/jestSetup';

// Mock reanimated to avoid native errors in Jest
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Silence the useNativeDriver warning
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock vector icons to simple components
jest.mock('react-native-vector-icons/Entypo', () => 'Icon');
jest.mock('react-native-vector-icons/Octicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock @gorhom/bottom-sheet provider
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const Provider = ({children}) =>
    React.createElement(React.Fragment, null, children);
  return {
    BottomSheetModalProvider: Provider,
  };
});

// Mock react-native-track-player
jest.mock('react-native-track-player', () => {
  const mock = {
    setupPlayer: jest.fn(async () => {}),
    add: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    reset: jest.fn(async () => {}),
    getState: jest.fn(async () => 'idle'),
    getCurrentTrack: jest.fn(async () => null),
    getActiveTrackIndex: jest.fn(async () => 0),
    updateOptions: jest.fn(() => {}),
    getQueue: jest.fn(async () => []),
  };
  return {
    __esModule: true,
    default: mock,
    ...mock,
    State: {None: 'none', Ready: 'ready', Playing: 'playing', Paused: 'paused'},
    Event: {
      PlaybackActiveTrackChanged: 'PlaybackActiveTrackChanged',
      PlaybackError: 'PlaybackError',
      PlaybackState: 'PlaybackState',
      RemoteDuck: 'RemoteDuck',
    },
    useTrackPlayerEvents: jest.fn(() => {}),
    RepeatMode: {Queue: 'Queue', Track: 'Track'},
  };
});

// Mock AsyncStorage for Jest environment
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({isConnected: true})),
}));

// Mock React Native Firebase
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({name: 'mock'})),
}));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({
    logEvent: jest.fn(),
    setUserId: jest.fn(),
    setUserProperties: jest.fn(),
  })),
}));

// Avoid overriding core react-native internals in tests

// Mock common native UI libs
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-fast-image', () => 'FastImage');

// Mock device info
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '0.0.0'),
  getBrand: jest.fn(() => 'mock'),
  getSystemVersion: jest.fn(() => '0'),
  hasNotch: jest.fn(() => false),
}));

// Mock blob util
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {},
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
  },
  config: jest.fn(() => ({fetch: jest.fn()})),
  fetch: jest.fn(),
}));

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(() => true),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  moveFile: jest.fn(),
  ExternalStorageDirectoryPath: '/mock',
  DocumentDirectoryPath: '/mock',
}));

// Mock clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(() => {}),
  getString: jest.fn(async () => ''),
}));

// react-native-paper is mapped via moduleNameMapper

// Mock react-native-modal
jest.mock('react-native-modal', () => 'Modal');

// Override specific react-native exports for test environment
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    BackHandler: {
      addEventListener: jest.fn(() => ({remove: jest.fn()})),
      removeEventListener: jest.fn(),
    },
    DeviceEventEmitter: {
      addListener: jest.fn(() => ({remove: jest.fn()})),
      removeListener: jest.fn(),
    },
  };
});
