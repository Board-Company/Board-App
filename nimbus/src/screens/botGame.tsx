import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../components/header';
import { colors, radius, spacing } from '../theme';

const BotGameScreen = () => (
  <View style={styles.container}>
    <Header />
    <View style={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Nimbus Bot</Text>
        <Text style={styles.title}>Bot play is coming next.</Text>
        <Text style={styles.subtitle}>
          This screen is now styled to match the rest of Nimbus, and it is ready for the bot flow when you wire it in.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Planned Here</Text>
        <Text style={styles.panelText}>Choose difficulty, side, and time control before starting a bot match.</Text>
        <TouchableOpacity activeOpacity={0.92} style={styles.button}>
          <Text style={styles.buttonText}>Bot Setup Coming Soon</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    gap: spacing.lg,
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
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
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
    gap: 10,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  buttonText: {
    color: colors.accentDeep,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default BotGameScreen;
