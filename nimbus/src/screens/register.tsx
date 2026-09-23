import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/header';
import { register } from '../services/auth.tsx';
import { useAuth } from '../contexts/AuthContext';
import { colors, radius, spacing } from '../theme';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  UserLogin: undefined;
  MainTabs: undefined;
  Play: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { signInWithUsername } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleRegister = async () => {
    if (!email || !username || !password) {
      Alert.alert('Missing Info', 'Please fill all fields.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      await register({ email, username, password });
      try {
        await signInWithUsername(username, password);
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } catch {
        Alert.alert('Account Created', 'Registration worked. Please sign in with your username.');
        navigation.navigate('UserLogin');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Username already registered')) {
        Alert.alert('Username Taken', 'That username is already in use.');
      } else if (errorMessage.includes('Email already registered')) {
        Alert.alert('Email In Use', 'That email is already registered.');
      } else {
        Alert.alert('Registration Failed', 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Create Account</Text>
          <Text style={styles.heroTitle}>Set up your Nimbus account.</Text>
          <Text style={styles.heroSubtitle}>
            Save local games, unlock online features, and keep your profile in sync.
          </Text>
        </View>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textPlaceholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textPlaceholder}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity activeOpacity={0.92} style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? 'Registering...' : 'Register'}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.92} style={styles.secondaryButton} onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentDark,
    gap: spacing.md,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentDark,
    backgroundColor: colors.backgroundBlack,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    color: colors.accentDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: radius.lg,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.accentDark,
    backgroundColor: colors.backgroundBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
