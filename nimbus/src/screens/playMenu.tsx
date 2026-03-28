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

type RootStackParamList = {
  PlayMenu: undefined;
  OnlineGame: { gameType: string; timeControl: string };
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
        <Icon name="expand-more" size={22} color="#8CB369" />
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
                  {selected ? <Icon name="check" size={20} color="#111111" /> : null}
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
        <ActivityIndicator size="large" color="#8CB369" />
        <Text style={styles.centerStateTitle}>Finding opponent...</Text>
        <Text style={styles.centerStateSubtitle}>Nimbus is searching for a match on Lichess.</Text>
      </View>
    );
  }

  if (isLoading || profileLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#8CB369" />
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
                    thumbColor={playOnline ? '#8CB369' : '#D0D0D0'}
                    trackColor={{ false: '#4A4A4A', true: '#314420' }}
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
    backgroundColor: '#202020',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 20,
  },
  heroCard: {
    backgroundColor: '#2D2D2D',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  eyebrow: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  heroSubtitle: {
    color: '#C7C7C7',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  infoCard: {
    backgroundColor: '#2F2F2F',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#3C3C3C',
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  helperText: {
    color: '#B8B8B8',
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
    paddingBottom: 12,
  },
  ratingLabel: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  ratingValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    backgroundColor: '#292929',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 64,
  },
  selectorCard: {
    backgroundColor: '#292929',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#3C3C3C',
    minHeight: 82,
    justifyContent: 'center',
  },
  selectorLabel: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  selectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#8CB369',
    borderRadius: 18,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryPillButton: {
    backgroundColor: '#232F1A',
    borderRadius: 14,
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillButtonText: {
    color: '#8CB369',
    fontSize: 14,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerStateTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  centerStateSubtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#2D2D2D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    minHeight: 360,
    maxHeight: '72%',
  },
  modalHandle: {
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#6C6C6C',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalList: {
    flexGrow: 0,
  },
  modalOption: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#292929',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionSelected: {
    backgroundColor: '#8CB369',
    borderColor: '#8CB369',
  },
  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOptionTextSelected: {
    color: '#111111',
  },
  modalCancelButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PlayMenuScreen;
