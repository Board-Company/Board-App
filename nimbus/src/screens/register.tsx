import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/header';
import { register } from '../services/auth.tsx';
import { useAuth } from '../contexts/AuthContext';

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
            placeholderTextColor="#6F7A68"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#6F7A68"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6F7A68"
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
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  heroSubtitle: {
    color: '#AEB8A8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#24351B',
    gap: 12,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#24351B',
    backgroundColor: '#111111',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#8CB369',
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#081005',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#24351B',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
