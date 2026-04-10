import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

export default function UserLogin() {
  const navigation = useNavigation<NavigationProp>();
  const { signInWithUsername } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);
      await signInWithUsername(username, password);
      navigation.navigate('MainTabs');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'Please check your credentials and try again',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Username Login</Text>
          <Text style={styles.heroTitle}>Sign back into Nimbus.</Text>
          <Text style={styles.heroSubtitle}>
            Use your Nimbus username and password to get back to your saved games and settings.
          </Text>
        </View>

        <View style={styles.formCard}>
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

          <TouchableOpacity activeOpacity={0.92} style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.primaryButtonText}>{loading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.92} style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Back</Text>
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
