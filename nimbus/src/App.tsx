import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { createTamagui } from '@tamagui/core'
import { TamaguiProvider } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v4'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import 'react-native-gesture-handler'

// Import your screens
import LoginScreen from './screens/login.tsx'
import mailLogin from './screens/mailLogin.tsx'
import RegisterScreen from './screens/register.tsx'
import HomeScreen from './screens/home.tsx'
import PlayMenuScreen from './screens/playMenu.tsx'
import PlayScreen from './screens/play.tsx'

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={config}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">
              <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="mailLogin" 
                component={mailLogin} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="PlayMenu" 
                component={PlayMenuScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Play" 
                component={PlayScreen} 
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}