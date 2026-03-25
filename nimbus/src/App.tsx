import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
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
import { LichessAuthProvider } from './contexts/LichessAuthContext'

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
import OnlineGameScreen from './screens/onlineGame.tsx'
import ChessAIScreen from './screens/chessAI.tsx'
import LocalGameHistoryScreen from './screens/localGameHistory.tsx'
import LocalGameReviewScreen from './screens/localGameReview.tsx'

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

const App = () => {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <TamaguiProvider config={tamaguiConfig}>
            <AuthProvider>
              <LichessAuthProvider>
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
                    <Stack.Screen name="LocalGameHistory" component={LocalGameHistoryScreen} />
                    <Stack.Screen name="LocalGameReview" component={LocalGameReviewScreen} />
                    <Stack.Screen name="OnlineGame" component={OnlineGameScreen} />
                    <Stack.Screen name="ChessAI" component={ChessAIScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
              </LichessAuthProvider>
            </AuthProvider>
          </TamaguiProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

export default App
