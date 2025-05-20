import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';

const LichessScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout } = useLichessAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8CB369" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
      
      {isAuthenticated ? (
        <View style={styles.content}>
          <Text style={styles.welcome}>Welcome, {user?.lichess_username || user?.username}!</Text>
          <TouchableOpacity style={styles.button} onPress={logout}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>Connect with Lichess</Text>
          <Text style={styles.subtitle}>Play chess with your Lichess account</Text>
          <TouchableOpacity style={styles.button} onPress={login}>
            <Text style={styles.buttonText}>Login with Lichess</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 30,
    textAlign: 'center',
  },
  welcome: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#8CB369',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: '#FF6B6B',
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default LichessScreen; 