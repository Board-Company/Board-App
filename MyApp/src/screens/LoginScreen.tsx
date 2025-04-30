import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const LoginScreen: React.FC = () => {
  const handleSignInSuccess = (userInfo: any) => {
    console.log('Sign-in success:', userInfo);
    // Handle successful sign-in (e.g., navigate to home screen, update auth context)
  };

  const handleSignInError = (error: Error) => {
    console.error('Sign-in error:', error);
    // Handle sign-in error (e.g., show error message)
  };

  return (
    <View style={styles.container}>
      <GoogleSignInButton
        onSignInSuccess={handleSignInSuccess}
        onSignInError={handleSignInError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
}); 