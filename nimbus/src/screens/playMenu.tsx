import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

const LichessScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>Play Online (Coming Soon)</Text>
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

export default LichessScreen;
