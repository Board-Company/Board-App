import { createTamagui } from '@tamagui/core'
import { TamaguiProvider } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v4'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import 'react-native-gesture-handler'

// Import your screens
import HomeScreen from './screens/HomeScreen.tsx'
import AboutScreen from './screens/AboutScreen.tsx'
import SettingsScreen from './screens/SettingsScreen.tsx'

// Create Tamagui config
const config = createTamagui(defaultConfig)

type Conf = typeof config

// make imports typed
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}

// Create the stack navigator
const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>
  )
}