// Learn more https://docs.expo.io/guides/customizing-metro
const { withTamagui } = require('@tamagui/metro-plugin')
const { getDefaultConfig } = require('@react-native/metro-config')

module.exports = withTamagui(getDefaultConfig(__dirname), {
  config: './tamagui.config.ts',
  components: ['tamagui'],
})