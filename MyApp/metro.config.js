// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'mjs'],
  },
  // Enable Hot Module Replacement and Fast Refresh
  hmr: true,
  transformer: {
    // Explicitly enable Fast Refresh
    experimentalImportSupport: false,
    inlineRequires: true,
    enableBabelRCLookup: false,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);