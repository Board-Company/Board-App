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
              <ActivityIndicator color="#8CB369" />
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
            <Icon name="person" size={18} color="#8CB369" />
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
    backgroundColor: '#202020',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#131313',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#24351B',
  },
  eyebrow: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroSubtitle: {
    color: '#AEB8A8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  panel: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#24351B',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#8CB369',
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#081005',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#24351B',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#24351B',
  },
  dividerText: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#D96C6C',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    textAlign: 'center',
  },
});
