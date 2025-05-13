import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LocalGameScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Local Game</Text>
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

export default LocalGameScreen; 