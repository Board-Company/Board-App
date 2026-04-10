import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface HeaderProps {
  // Add any props you might need here, such as
  // onPress?: () => void;
  // backgroundColor?: string;
}

const Header: React.FC<HeaderProps> = (props) => {
  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>nimbus</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#2A2A2A',
  },
  header: {
    height: 60,
    width: '100%',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: '#8CB369',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'lowercase',
    fontFamily: Platform.select({
      ios: 'Courier',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});

export default Header;
