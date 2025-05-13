import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BotGameScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Play a Bot</Text>
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

export default BotGameScreen; 