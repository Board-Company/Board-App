import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TimeSelector from '../components/TimeSelector';

type RootStackParamList = {
  Play: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Play'>;

const PlayMenuScreen = () => {
  const [selectedTime, setSelectedTime] = useState(10);
  const navigation = useNavigation<NavigationProp>();

  const handleTimeSelected = (time: number) => {
    setSelectedTime(time);
  };

  const handleStartGame = () => {
    navigation.navigate('Play');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Play</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.pawnContainer}>
          <Icon name="chess" size={80} color="white" />
        </View>

        <View style={styles.timeSelectorContainer}>
          <TimeSelector onTimeSelected={handleTimeSelected} />
        </View>

        <TouchableOpacity 
          style={styles.startGameButton}
          onPress={handleStartGame}
        >
          <Text style={styles.startGameText}>Start Game</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="emoji-events" size={24} color="#FFD700" />
          <Text style={styles.menuText}>Tournaments</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="people" size={24} color="white" />
          <Text style={styles.menuText}>Play a Friend</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="smart-toy" size={24} color="white" />
          <Text style={styles.menuText}>Play a Bot</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="school" size={24} color="white" />
          <Text style={styles.menuText}>Play Coach</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreButtonText}>More</Text>
          <Icon name="keyboard-arrow-down" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="person" size={24} color="#8CB369" />
          <Text style={[styles.navText, styles.activeNavText]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="extension" size={24} color="#666" />
          <Text style={styles.navText}>Puzzles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="school" size={24} color="#666" />
          <Text style={styles.navText}>Learn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="visibility" size={24} color="#666" />
          <Text style={styles.navText}>Watch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="menu" size={24} color="#666" />
          <Text style={styles.navText}>More</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 20,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pawnContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  timeSelectorContainer: {
    marginBottom: 20,
  },
  startGameButton: {
    backgroundColor: '#8CB369',
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  startGameText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    width: '100%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  menuText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 15,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 15,
  },
  moreButtonText: {
    color: 'white',
    fontSize: 16,
    marginRight: 5,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingBottom: 30,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  activeNavText: {
    color: '#8CB369',
  },
});

export default PlayMenuScreen;
