import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

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
          <ActivityIndicator color={colors.textPrimary} />
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
    // Google's brand blue. Deliberately not a theme token: the Sign-In button
    // has to match Google's branding guidelines, not ours.
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
  },
}); 