import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

type GameOverOverlayProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const GameOverOverlay = ({
  visible,
  title,
  subtitle,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: GameOverOverlayProps) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Game over</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Pressable style={styles.primary} onPress={onPrimary}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
        {secondaryLabel && onSecondary ? (
          <Pressable style={styles.secondary} onPress={onSecondary}>
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayDeep,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryText: {
    color: colors.accentDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default GameOverOverlay;
