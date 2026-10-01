import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/header';
import { useAuth } from '../contexts/AuthContext';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { colors, radius, spacing } from '../theme';

interface AppUser {
  id: string;
  username: string;
  email?: string;
}

const SettingsScreen = () => {
  const { signOut, user: appUser } = useAuth() as { signOut: () => Promise<void>; user: AppUser | null };
  const { user: lichessUser, unlinkLichess, isLoading: isLichessLoading } = useLichessAuth();
  const navigation = useNavigation<any>();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      console.error('[Settings] Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleUnlinkLichess = async () => {
    if (!lichessUser?.lichess_username) {
      Alert.alert('No Linked Account', 'There is no Lichess account linked right now.');
      return;
    }

    Alert.alert(
      'Unlink Lichess',
      'Are you sure you want to unlink your Lichess account from Nimbus?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUnlinking(true);
              await unlinkLichess();
              Alert.alert('Unlinked', 'Your Lichess account has been unlinked.');
            } catch (error) {
              console.error('[Settings] Unlink error:', error);
              Alert.alert('Error', 'Failed to unlink Lichess account. Please try again.');
            } finally {
              setIsUnlinking(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Settings</Text>
          <Text style={styles.heroTitle}>Manage your account and connections.</Text>
          <Text style={styles.heroSubtitle}>
            Review your current login, manage Lichess linking, and sign out safely.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionValue}>{appUser?.username || 'Guest'}</Text>
          <Text style={styles.helperText}>{appUser?.email || 'Signed in locally on this device.'}</Text>
          <TouchableOpacity activeOpacity={0.92} style={styles.secondaryButton} onPress={handleLogout}>
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Lichess</Text>
          <Text style={styles.sectionValue}>{lichessUser?.lichess_username || 'Not linked'}</Text>
          <Text style={styles.helperText}>
            {lichessUser?.lichess_username
              ? 'Your online play is connected to Lichess.'
              : 'Link an account from the online play screen to enable matchmaking.'}
          </Text>
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.primaryButton}
            onPress={handleUnlinkLichess}
            disabled={isUnlinking || isLichessLoading}
          >
            {isUnlinking ? (
              <ActivityIndicator color={colors.accentDeep} />
            ) : (
              <Text style={styles.primaryButtonText}>Unlink Lichess</Text>
            )}
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
    paddingBottom: 120,
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
  sectionCard: {
    backgroundColor: colors.backgroundSunken,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentDark,
    gap: 10,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    color: colors.accentDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: colors.backgroundBlack,
    borderRadius: radius.lg,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SettingsScreen;
