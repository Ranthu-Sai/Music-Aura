import {View, StatusBar, StyleSheet, Platform, PermissionsAndroid} from 'react-native';
import {useEffect, useCallback, useRef} from 'react';
import {GetLanguageValue} from '../LocalStorage/Languages';

export const InitialScreen = ({navigation}) => {
  const hasStartedInitRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  const requestStoragePermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      if (Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        );
      } else {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
      }
    } catch (_) {}
  }, []);

  const InitialCall = useCallback(async () => {
    if (hasNavigatedRef.current) {
      return;
    }

    try {
      await requestStoragePermission();
      const lang = await GetLanguageValue();

      if (hasNavigatedRef.current) {
        return;
      }

      hasNavigatedRef.current = true;
      if (lang && lang !== '') {
        navigation.replace('MainRoute');
      } else {
        navigation.replace('Onboarding');
      }
    } catch (err) {
      console.warn('InitialCall error, navigating to MainRoute fallback:', err);
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        navigation.replace('MainRoute');
      }
    }
  }, [navigation, requestStoragePermission]);

  useEffect(() => {
    if (hasStartedInitRef.current) {
      return;
    }
    hasStartedInitRef.current = true;
    InitialCall();
  }, [InitialCall]);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
