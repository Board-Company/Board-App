import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { createTamagui } from '@tamagui/core'
import { TamaguiProvider } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v4'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import 'react-native-gesture-handler'
import { AuthProvider, useAuth } from './contexts/AuthContext'

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

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={config}>
          <AuthProvider>
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
                  options={{ headerShown: false }}
                >
                  {() => (
                    <ProtectedRoute>
                      <HomeScreen />
                    </ProtectedRoute>
                  )}
                </Stack.Screen>
                <Stack.Screen 
                  name="PlayMenu" 
                  options={{ headerShown: false }}
                >
                  {() => (
                    <ProtectedRoute>
                      <PlayMenuScreen />
                    </ProtectedRoute>
                  )}
                </Stack.Screen>
                <Stack.Screen 
                  name="Play" 
                  options={{ headerShown: false }}
                >
                  {() => (
                    <ProtectedRoute>
                      <PlayScreen />
                    </ProtectedRoute>
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            </NavigationContainer>
          </AuthProvider>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}