import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/header';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

type RootStackParamList = {
  MainTabs: undefined;
  Login: undefined;
  Register: undefined;
  UserLogin: undefined;
  Play: undefined;
  BotGame: undefined;
  Puzzle: undefined;
  LocalGame: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { signIn, loading, error } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await signIn();
      navigation.navigate('MainTabs');
    } catch (signInError) {
      console.error('Google sign in error:', signInError);
    }
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Access</Text>
          <Text style={styles.heroTitle}>Play, review, and train in one place.</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to save your games, connect Lichess, and use the full Nimbus experience.
          </Text>
        </View>

        <View style={styles.panel}>
          <TouchableOpacity activeOpacity={0.92} style={styles.primaryButton} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.secondaryButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Image source={require('../../assets/images/google.png')} style={styles.googleIcon} />
                <Text style={styles.secondaryButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('UserLogin')}
          >
            <Icon name="person" size={18} color={colors.accent} />
            <Text style={styles.secondaryButtonText}>Continue with Username</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  panel: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accentDark,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.accentDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentDark,
    backgroundColor: colors.backgroundBlack,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accentDark,
  },
  dividerText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    textAlign: 'center',
  },
});
