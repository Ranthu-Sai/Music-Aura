// Use native NewPipe module with v0.25.1 (fixes "page needs to be reloaded" error)
import {NativeModules} from 'react-native';

const {StreamModule} = NativeModules;

if (!StreamModule) {
  console.error(
    '❌ StreamModule is not available. Ensure the native module is linked correctly.',
  );
}

export default StreamModule;
