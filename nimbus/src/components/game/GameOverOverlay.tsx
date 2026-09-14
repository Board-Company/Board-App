import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: 'rgba(8, 10, 6, 0.78)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#131313',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#24351B',
  },
  eyebrow: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: '#AEB8A8',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  primary: {
    backgroundColor: '#8CB369',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryText: {
    color: '#081005',
    fontSize: 16,
    fontWeight: '800',
  },
  secondary: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: {
    color: '#C8D5B9',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default GameOverOverlay;
