import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../components/header';
import { useLichessAuth } from '../contexts/LichessAuthContext';

const LichessScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout } = useLichessAuth();

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#8CB369" />
        <Text style={styles.centerTitle}>Loading Lichess</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Lichess</Text>
          <Text style={styles.heroTitle}>
            {isAuthenticated
              ? `Connected as ${user?.lichess_username || user?.username}`
              : 'Connect your Lichess account'}
          </Text>
          <Text style={styles.heroSubtitle}>
            Keep your online play connected to Nimbus with the same green-and-black look as the rest of the app.
          </Text>
        </View>

        <View style={styles.panel}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            activeOpacity={0.92}
            style={isAuthenticated ? styles.secondaryButton : styles.primaryButton}
            onPress={isAuthenticated ? logout : login}
          >
            <Text style={isAuthenticated ? styles.secondaryButtonText : styles.primaryButtonText}>
              {isAuthenticated ? 'Logout from Lichess' : 'Login with Lichess'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

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
  centerState: {
    flex: 1,
    backgroundColor: '#202020',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
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
  },
  primaryButtonText: {
    color: '#081005',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#111111',
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#24351B',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#D96C6C',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default LichessScreen;
