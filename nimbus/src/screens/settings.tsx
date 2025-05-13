import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

const SettingsScreen = () => {
  const { signOut } = useAuth();
  const navigation = useNavigation<any>();

  const handleLogout = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#D7263D',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SettingsScreen; 