import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

const PuzzleScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Puzzle</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
  },
});

export default PuzzleScreen; 