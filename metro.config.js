const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
async function createConfig() {
  const defaultConfig = await getDefaultConfig(__dirname);

  const config = {
    resolver: {
      // Ensure Metro will process ESM files that some packages ship (.mjs/.cjs)
      sourceExts: Array.from(
        new Set([
          ...(defaultConfig.resolver.sourceExts || []),
          'cjs',
          'mjs',
          'ts',
          'tsx',
        ]),
      ),
    },
    transformer: {
      // Enable experimental import support to handle ESM modules properly
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: true,
          inlineRequires: true,
        },
      }),
    },
  };

  return mergeConfig(defaultConfig, config);
}

module.exports = createConfig();
