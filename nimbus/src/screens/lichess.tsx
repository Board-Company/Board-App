import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../components/header';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { colors, radius, spacing } from '../theme';

const LichessScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout } = useLichessAuth();

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.centerTitle}>Loading Lichess</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Lichess</Text>
          <Text style={styles.heroTitle}>
            {isAuthenticated
              ? `Connected as ${user?.lichess_username || user?.username}`
              : 'Connect your Lichess account'}
          </Text>
          <Text style={styles.heroSubtitle}>
            Keep your online play connected to Nimbus with the same green-and-black look as the rest of the app.
          </Text>
        </View>

        <View style={styles.panel}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            activeOpacity={0.92}
            style={isAuthenticated ? styles.secondaryButton : styles.primaryButton}
            onPress={isAuthenticated ? logout : login}
          >
            <Text style={isAuthenticated ? styles.secondaryButtonText : styles.primaryButtonText}>
              {isAuthenticated ? 'Logout from Lichess' : 'Login with Lichess'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  centerState: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  panel: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentDark,
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.accentDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.backgroundBlack,
    borderRadius: radius.lg,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default LichessScreen;
