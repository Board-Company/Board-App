import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Header from '../components/header';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

// Define the navigation param list type
type RootStackParamList = {
  Home: undefined;
  PlayMenu: undefined;
  Login: undefined;
  Register: undefined;
  mailLogin: undefined;
};

// Create a typed navigation prop
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.bottomContainer}>
        {/* Play button */}
        <TouchableOpacity 
          style={styles.playButton}
          onPress={() => navigation.navigate('PlayMenu')}
        >
          <Text style={styles.playButtonText}>Play</Text>
        </TouchableOpacity>
        {/* Logout button */}
        <TouchableOpacity 
          style={[styles.playButton, { backgroundColor: '#D7263D', marginTop: 16 }]}
          onPress={handleLogout}
        >
          <Text style={styles.playButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    justifyContent: 'space-between',
  },
  bottomContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  playButton: {
    backgroundColor: '#8CB369',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  playButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
