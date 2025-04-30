import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface HeaderProps {
  // Add any props you might need here, such as
  // onPress?: () => void;
  // backgroundColor?: string;
}

const Header: React.FC<HeaderProps> = (props) => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>nimbus</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    width: '100%',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default Header;
