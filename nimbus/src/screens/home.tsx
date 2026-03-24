import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Header from '../components/header';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Define the navigation param list type
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
  TestSelect: undefined;
  ChessAI: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Game Mode</Text>
        </View>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TestSelect')}>
            <Icon name="smart-toy" size={32} color="#8CB369" />
            <Text style={styles.menuText}>Testhis  a Bot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Puzzle')}>
            <Icon name="extension" size={32} color="#8CB369" />
            <Text style={styles.menuText}>Puzzle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('LocalGame')}>
            <Icon name="people" size={32} color="#8CB369" />
            <Text style={styles.menuText}>Local Game</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Lichess')}>
            <Icon name="public" size={32} color="#8CB369" />
            <Text style={styles.menuText}>Play Online</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ChessAI')}>
            <Icon name="psychology" size={32} color="#8CB369" />
            <Text style={styles.menuText}>Chess AI Coach</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    width: 260,
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    gap: 20,
  },
  menuText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
