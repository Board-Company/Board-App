import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TamaguiProvider } from 'tamagui'
import tamaguiConfig from '../tamagui.config'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import 'react-native-gesture-handler'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { View, Text, Image, StyleSheet } from 'react-native'
import ErrorBoundary from './components/ErrorBoundary'
import ScreenSafeArea from './components/ScreenSafeArea'
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
import FriendGameScreen from './screens/friendGame.tsx'
import ChessAIScreen from './screens/chessAI.tsx'
import LocalGameHistoryScreen from './screens/localGameHistory.tsx'
import LocalGameReviewScreen from './screens/localGameReview.tsx'
import OnlineFriendGameHistoryScreen from './screens/onlineFriendGameHistory.tsx'
import OnlineFriendGameReviewScreen from './screens/onlineFriendGameReview.tsx'

type RootStackParamList = {
  Login: undefined
  Register: undefined
  UserLogin: undefined
  MainTabs: undefined
  Play: undefined
  BotGame: undefined
  Puzzle: undefined
  LocalGame: undefined
  LocalGameHistory: undefined
  LocalGameReview: { gameId: string }
  OnlineGame: { gameType: string; timeControl: string }
  OnlineFriendGameHistory: undefined
  OnlineFriendGameReview: { gameId: string }
  FriendGame: undefined
  ChessAI: undefined
}

// Create the stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>()

function withScreenSafeArea<P extends object>(Screen: React.ComponentType<P>, edges?: Edge[]) {
  const Wrapped = (props: P) => (
    <ScreenSafeArea edges={edges}>
      <Screen {...props} />
    </ScreenSafeArea>
  )
  Wrapped.displayName = `WithScreenSafeArea(${Screen.displayName || Screen.name || 'Screen'})`
  return Wrapped
}

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

type TabIconProps = {
  focused: boolean;
  color: string;
  size: number;
  iconName?: string;
  imageSource?: number;
};

const TabIcon = ({ focused, color, size, iconName, imageSource }: TabIconProps) => (
  <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
    {imageSource ? (
      <Image
        source={imageSource}
        style={{ width: size, height: size, tintColor: color }}
      />
    ) : (
      <MaterialIcon name={iconName ?? 'circle'} size={size} color={color} />
    )}
  </View>
)

const MainTabsNavigator = () => {
  const insets = useSafeAreaInsets()
  return (
    <ScreenSafeArea style={{ flex: 1 }}>
      <ProtectedRoute>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            sceneStyle: styles.tabScene,
            tabBarStyle: {
              backgroundColor: '#111111',
              borderTopWidth: 0,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 10),
              minHeight: 68 + insets.bottom,
              height: undefined,
              marginHorizontal: 12,
              marginBottom: 10,
              borderRadius: 22,
              position: 'absolute',
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarItemStyle: styles.tabBarItem,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarLabelPosition: 'below-icon',
            tabBarActiveTintColor: '#8CB369',
            tabBarInactiveTintColor: '#7B7B7B',
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} iconName="sports-esports" />
              ),
              tabBarLabel: 'Home',
            }}
          />
          <Tab.Screen
            name="Lichess"
            component={LichessScreen}
            options={{
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon
                  focused={focused}
                  color={color}
                  size={size}
                  imageSource={require('../assets/lichess.webp')}
                />
              ),
              tabBarLabel: 'Lichess',
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} iconName="settings" />
              ),
              tabBarLabel: 'Settings',
            }}
          />
        </Tab.Navigator>
      </ProtectedRoute>
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  tabScene: {
    backgroundColor: '#202020',
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabIconShell: {
    minWidth: 52,
    minHeight: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabIconShellActive: {
    backgroundColor: '#232F1A',
  },
})

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
                    <Stack.Screen name="Login" component={withScreenSafeArea(LoginScreen)} />
                    <Stack.Screen name="Register" component={withScreenSafeArea(RegisterScreen)} />
                    <Stack.Screen name="UserLogin" component={withScreenSafeArea(UserLogin)} />
                    <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
                    <Stack.Screen name="Play" component={withScreenSafeArea(PlayScreen)} />
                    <Stack.Screen name="BotGame" component={withScreenSafeArea(BotGameScreen)} />
                    <Stack.Screen name="Puzzle" component={withScreenSafeArea(PuzzleScreen)} />
                    <Stack.Screen name="LocalGame" component={withScreenSafeArea(LocalGameScreen)} />
                    <Stack.Screen name="LocalGameHistory" component={withScreenSafeArea(LocalGameHistoryScreen)} />
                    <Stack.Screen name="LocalGameReview" component={withScreenSafeArea(LocalGameReviewScreen)} />
                    <Stack.Screen name="OnlineGame" component={withScreenSafeArea(OnlineGameScreen)} />
                    <Stack.Screen
                      name="OnlineFriendGameHistory"
                      component={withScreenSafeArea(OnlineFriendGameHistoryScreen)}
                    />
                    <Stack.Screen
                      name="OnlineFriendGameReview"
                      component={withScreenSafeArea(OnlineFriendGameReviewScreen)}
                    />
                    <Stack.Screen name="FriendGame" component={withScreenSafeArea(FriendGameScreen)} />
                    <Stack.Screen name="ChessAI" component={withScreenSafeArea(ChessAIScreen)} />
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
