import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export const GoogleSignInButton: React.FC = () => {
  const { signIn, loading, error } = useAuth();

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={signIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Google</Text>
        )}
      </TouchableOpacity>
      {error && (
        <Text style={styles.errorText}>
          {error.message}
        </Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
  },
}); 