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
import { View, Text, Image } from 'react-native'
import ErrorBoundary from './components/ErrorBoundary'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import SettingsScreen from './screens/settings.tsx'
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'

// Import your screens
import LoginScreen from './screens/login.tsx'
import RegisterScreen from './screens/register.tsx'
import HomeScreen from './screens/home.tsx'
import LichessScreen from './screens/playMenu.tsx'
import PlayScreen from './screens/play.tsx'
import UserLogin from './screens/userLogin.tsx'
import BotGameScreen from './screens/botGame.tsx'
import PuzzleScreen from './screens/puzzle.tsx'
import LocalGameScreen from './screens/localGame.tsx'

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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <Text style={{ color: 'black', fontSize: 24 }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
};

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <TamaguiProvider config={config}>
            <AuthProvider>
              <NavigationContainer>
                <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="Register" component={RegisterScreen} />
                  <Stack.Screen name="UserLogin" component={UserLogin} />
                  <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
                    {() => (
                      <ProtectedRoute>
                        <Tab.Navigator
                          screenOptions={{
                            headerShown: false,
                            tabBarStyle: { backgroundColor: '#1A1A1A', borderTopWidth: 0, height: 70 },
                            tabBarActiveTintColor: '#8CB369',
                            tabBarInactiveTintColor: '#666',
                          }}
                        >
                          <Tab.Screen
                            name="Home"
                            component={HomeScreen}
                            options={{
                              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                                <MaterialIcon name="sports-esports" size={size} color={color} />
                              ),
                              tabBarLabel: 'Home',
                            }}
                          />
                          <Tab.Screen
                            name="Lichess"
                            component={LichessScreen}
                            options={{
                              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                                <Image 
                                  source={require('../assets/lichess.webp')} 
                                  style={{ width: size, height: size, tintColor: color }} 
                                />
                              ),
                              tabBarLabel: 'Lichess',
                            }}
                          />
                          <Tab.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{
                              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                                <MaterialIcon name="settings" size={size} color={color} />
                              ),
                              tabBarLabel: 'Settings',
                            }}
                          />
                        </Tab.Navigator>
                      </ProtectedRoute>
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Play" component={PlayScreen} />
                  <Stack.Screen name="BotGame" component={BotGameScreen} />
                  <Stack.Screen name="Puzzle" component={PuzzleScreen} />
                  <Stack.Screen name="LocalGame" component={LocalGameScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </AuthProvider>
          </TamaguiProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}