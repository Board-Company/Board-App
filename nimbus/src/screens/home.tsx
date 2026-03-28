import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/header';
import { useAuth } from '../contexts/AuthContext';

type RootStackParamList = {
  Home: undefined;
  Lichess: undefined;
  BotGame: undefined;
  Puzzle: undefined;
  Play: undefined;
  LocalGame: undefined;
  Login: undefined;
  Register: undefined;
  UserLogin: undefined;
  ChessAI: undefined;
  FriendGame: undefined;
  LocalGameHistory: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HomeAction = {
  title: string;
  subtitle: string;
  icon: string;
  route: keyof RootStackParamList;
};

/** Order matches the original vertical home menu, plus local history & friend games. */
const actions: HomeAction[] = [
  {
    title: 'Test a Bot',
    subtitle: 'Built-in engine on this device',
    icon: 'smart-toy',
    route: 'Play',
  },
  {
    title: 'Puzzle',
    subtitle: 'Sharpen tactics and patterns',
    icon: 'extension',
    route: 'Puzzle',
  },
  {
    title: 'Local Game',
    subtitle: 'Pass and play on one device',
    icon: 'people',
    route: 'LocalGame',
  },
  {
    title: 'Play Online',
    subtitle: 'Lichess matchmaking & online',
    icon: 'public',
    route: 'Lichess',
  },
  {
    title: 'Chess AI Coach',
    subtitle: 'Play and talk through moves',
    icon: 'psychology',
    route: 'ChessAI',
  },
  {
    title: 'Game History',
    subtitle: 'Review saved local games',
    icon: 'history',
    route: 'LocalGameHistory',
  },
  {
    title: 'Play With Friend',
    subtitle: 'Create or join a private game',
    icon: 'group',
    route: 'FriendGame',
  },
];

function ActionCard({ action, onPress }: { action: HomeAction; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.actionCard} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Icon name={action.icon} size={22} color="#081005" />
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionTitle} numberOfLines={2}>
          {action.title}
        </Text>
        <Text style={styles.actionSubtitle} numberOfLines={2}>
          {action.subtitle}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color="#5A6B52" style={styles.chevron} />
    </TouchableOpacity>
  );
}

/** Tab bar is `position: 'absolute'` in App.tsx — pad scroll content so rows aren't hidden under it. */
const TAB_BAR_OVERLAY_PAD = 108;

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const displayName = user?.username || user?.name || 'Player';

  const scrollBottomPad = Math.max(insets.bottom, 12) + TAB_BAR_OVERLAY_PAD;

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        bounces
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Dashboard</Text>
          <Text style={styles.heroTitle}>Welcome back, {displayName}</Text>
          <Text style={styles.heroSubtitle}>
            Pick a mode and jump straight into your next game.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Game Mode</Text>
          <View style={styles.actionList}>
            {actions.map(action => (
              <View key={action.title} style={styles.actionListItem}>
                <ActionCard
                  action={action}
                  onPress={() => navigation.navigate(action.route as never)}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
  },
  heroCard: {
    backgroundColor: '#333333',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#435C33',
  },
  eyebrow: {
    color: '#8CB369',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroSubtitle: {
    color: '#C8D5B9',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  actionList: {
    gap: 8,
  },
  actionListItem: {
    width: '100%',
  },
  actionCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#435C33',
    minHeight: 64,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#8CB369',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 4,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: '#C8D5B9',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
});

export default HomeScreen;
