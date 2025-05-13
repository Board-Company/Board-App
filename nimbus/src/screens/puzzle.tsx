import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PuzzleScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Puzzle</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
});

export default PuzzleScreen; 