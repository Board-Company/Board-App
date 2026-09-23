import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/header';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { colors, radius, spacing } from '../theme';

type RootStackParamList = {
  PlayMenu: undefined;
  OnlineGame: { gameType: string; timeControl: string };
  OnlineFriendGameHistory: undefined;
  OnlineFriendGameReview: { gameId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlayMenu'>;

const GAME_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard Chess' },
  { value: 'chess960', label: 'Chess 960' },
];

const TIME_CONTROL_OPTIONS = [
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
];

type PickerButtonProps = {
  label: string;
  value: string;
  onPress: () => void;
};

function PickerButton({ label, value, onPress }: PickerButtonProps) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.selectorCard} onPress={onPress}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.selectorValueRow}>
        <Text style={styles.selectorValue}>{value}</Text>
        <Icon name="expand-more" size={22} color={colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

type OptionModalProps = {
  visible: boolean;
  title: string;
  options: Array<{ value: string; label: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

function OptionModal({ visible, title, options, selectedValue, onSelect, onClose }: OptionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {options.map(option => {
              const selected = option.value === selectedValue;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.9}
                  style={[styles.modalOption, selected && styles.modalOptionSelected]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>
                    {option.label}
                  </Text>
                  {selected ? <Icon name="check" size={20} color={colors.backgroundBlack} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity activeOpacity={0.9} style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const PlayMenuScreen = () => {
  const { isAuthenticated, user, isLoading, login, unlinkLichess, lichessInfo, fetchLichessInfo } = useLichessAuth();
  const [lichessProfile, setLichessProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [gameType, setGameType] = useState('standard');
  const [timeControl, setTimeControl] = useState('600');
  const [gameTypeModalOpen, setGameTypeModalOpen] = useState(false);
  const [timeControlModalOpen, setTimeControlModalOpen] = useState(false);
  const [playOnline, setPlayOnline] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    if (isAuthenticated) {
      fetchLichessInfo();
    }
  }, [fetchLichessInfo, isAuthenticated]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!lichessInfo?.access_token) {
        setLichessProfile(null);
        return;
      }

      setProfileLoading(true);
      try {
        const response = await fetch('https://lichess.org/api/account', {
          headers: {
            Authorization: `Bearer ${lichessInfo.access_token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Lichess profile');
        }

        const data = await response.json();
        setLichessProfile(data);
      } catch {
        setLichessProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [lichessInfo]);

  const handleStartGame = () => {
    if (playOnline) {
      setIsMatchmaking(true);
      setTimeout(() => {
        setIsMatchmaking(false);
        navigation.navigate('OnlineGame', { gameType, timeControl });
      }, 2500);
      return;
    }

    navigation.navigate('OnlineGame', { gameType, timeControl });
  };

  const handleUnlink = async () => {
    try {
      await unlinkLichess();
      setLichessProfile(null);
    } catch {
      // handled in context
    }
  };

  const displayName = user?.lichess_username || user?.username || 'Player';
  const selectedGameType = GAME_TYPE_OPTIONS.find(option => option.value === gameType)?.label ?? 'Select game type';
  const selectedTime = TIME_CONTROL_OPTIONS.find(option => option.value === timeControl)?.label ?? 'Select time';

  if (isMatchmaking) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.centerStateTitle}>Finding opponent...</Text>
        <Text style={styles.centerStateSubtitle}>Nimbus is searching for a match on Lichess.</Text>
      </View>
    );
  }

  if (isLoading || profileLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.centerStateTitle}>Loading online play</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Nimbus Online</Text>
          <Text style={styles.heroTitle}>
            {isAuthenticated ? `Ready to play, ${displayName}?` : 'Connect Lichess to start playing online'}
          </Text>
          <Text style={styles.heroSubtitle}>
            Keep the Nimbus look while choosing your mode, time control, and matchmaking style.
          </Text>
        </View>

        {isAuthenticated ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View>
                    <Text style={styles.infoLabel}>Linked account</Text>
                    <Text style={styles.infoValue}>{lichessInfo?.username || displayName}</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.9} style={styles.secondaryPillButton} onPress={handleUnlink}>
                    <Text style={styles.secondaryPillButtonText}>Unlink</Text>
                  </TouchableOpacity>
                </View>
                {lichessProfile ? (
                  <View style={styles.ratingGrid}>
                    {Object.entries(lichessProfile.perfs ?? {})
                      .filter(([, value]: [string, any]) => Boolean(value?.rating))
                      .slice(0, 4)
                      .map(([key, value]: [string, any]) => (
                        <View key={key} style={styles.ratingCard}>
                          <Text style={styles.ratingLabel}>{key}</Text>
                          <Text style={styles.ratingValue}>{value.rating}</Text>
                        </View>
                      ))}
                  </View>
                ) : (
                  <Text style={styles.helperText}>Lichess profile data will appear here once it loads.</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Game Setup</Text>
              <View style={styles.infoCard}>
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.infoValue}>Use Matchmaking</Text>
                    <Text style={styles.helperText}>Toggle queue-based pairing before launching the game.</Text>
                  </View>
                  <Switch
                    value={playOnline}
                    onValueChange={setPlayOnline}
                    thumbColor={playOnline ? colors.accent : colors.neutral}
                    trackColor={{ false: colors.borderMuted, true: colors.accentTrack }}
                  />
                </View>

                <PickerButton
                  label="Game Type"
                  value={selectedGameType}
                  onPress={() => setGameTypeModalOpen(true)}
                />
                <PickerButton
                  label="Time Control"
                  value={selectedTime}
                  onPress={() => setTimeControlModalOpen(true)}
                />

                <TouchableOpacity activeOpacity={0.92} style={styles.primaryButton} onPress={handleStartGame}>
                  <Text style={styles.primaryButtonText}>Start Online Game</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.92}
                  style={styles.secondaryOutlineButton}
                  onPress={() => navigation.navigate('OnlineFriendGameHistory')}
                >
                  <Text style={styles.secondaryOutlineButtonText}>Friend games history</Text>
                  <Text style={styles.secondaryOutlineHint}>
                    Finished Play with Friend games from your account (Board API)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connect</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>Link your Lichess account</Text>
              <Text style={styles.helperText}>
                Sign in once to unlock online games, matchmaking, and account syncing inside Nimbus.
              </Text>
              <TouchableOpacity activeOpacity={0.92} style={styles.primaryButton} onPress={login}>
                <Text style={styles.primaryButtonText}>Login With Lichess</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <OptionModal
        visible={gameTypeModalOpen}
        title="Select Game Type"
        options={GAME_TYPE_OPTIONS}
        selectedValue={gameType}
        onSelect={setGameType}
        onClose={() => setGameTypeModalOpen(false)}
      />
      <OptionModal
        visible={timeControlModalOpen}
        title="Select Time Control"
        options={TIME_CONTROL_OPTIONS}
        selectedValue={timeControl}
        onSelect={setTimeControl}
        onClose={() => setTimeControlModalOpen(false)}
      />
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
    gap: 20,
  },
  heroCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.borderMuted,
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
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  heroSubtitle: {
    color: colors.neutral,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  ratingCard: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: spacing.md,
  },
  ratingLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  ratingValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 64,
  },
  selectorCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    minHeight: 82,
    justifyContent: 'center',
  },
  selectorLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  selectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectorValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.backgroundBlack,
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryOutlineButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.xs,
  },
  secondaryOutlineButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryOutlineHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryPillButton: {
    backgroundColor: colors.accentDark,
    borderRadius: radius.lg,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerStateTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  centerStateSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlaySoft,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    minHeight: 360,
    maxHeight: '72%',
  },
  modalHandle: {
    width: 54,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.textDisabled,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modalOptionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalOptionTextSelected: {
    color: colors.backgroundBlack,
  },
  modalCancelButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  modalCancelText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PlayMenuScreen;
