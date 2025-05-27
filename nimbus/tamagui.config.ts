import { createTamagui } from '@tamagui/core'
import { defaultConfig } from '@tamagui/config/v4'

const tamaguiConfig = createTamagui(defaultConfig)

export default tamaguiConfig
export type AppConfig = typeof tamaguiConfig 