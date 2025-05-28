import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { Text, YStack, XStack, Button, Select, Adapt, Sheet } from 'tamagui';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown } from '@tamagui/lucide-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

const SelectorButton = ({ label, onPress }) => (
  <Button
    onPress={onPress}
    style={{
      backgroundColor: '#23262F',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#8CB369',
      width: '100%',
      height: 52,
      justifyContent: 'space-between',
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    }}
  >
    <Text color="#8CB369" fontSize={18} fontWeight="bold">
      {label}
    </Text>
    <ChevronDown color="#8CB369" size={22} />
  </Button>
);

const OptionButton = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      width: '100%',
      paddingVertical: 18,
      marginBottom: 8,
      backgroundColor: selected ? '#8CB369' : '#23262F',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#8CB369',
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    }}
  >
    <Text color={selected ? '#fff' : '#8CB369'} fontSize={18} fontWeight={selected ? 'bold' : 'normal'}>
      {label}
    </Text>
    {selected && (
      <Text style={{ marginLeft: 8, color: '#fff', fontSize: 18 }}>✓</Text>
    )}
  </TouchableOpacity>
);

const PlayMenuScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout, unlinkLichess, lichessInfo, fetchLichessInfo } = useLichessAuth();
  const [lichessProfile, setLichessProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [gameType, setGameType] = useState('standard');
  const [timeControl, setTimeControl] = useState('600');
  const navigation = useNavigation<NavigationProp>();
  const [gameTypeModalOpen, setGameTypeModalOpen] = useState(false);
  const [timeControlModalOpen, setTimeControlModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLichessInfo();
    }
  }, [isAuthenticated, fetchLichessInfo]);

  // Fetch live Lichess profile info from Lichess API using access_token
  useEffect(() => {
    const fetchProfile = async () => {
      if (lichessInfo && lichessInfo.access_token) {
        setProfileLoading(true);
        setProfileError(null);
        try {
          const response = await fetch('https://lichess.org/api/account', {
            headers: {
              'Authorization': `Bearer ${lichessInfo.access_token}`,
              'Accept': 'application/json',
            },
          });
          if (!response.ok) {
            throw new Error('Failed to fetch Lichess profile');
          }
          const data = await response.json();
          setLichessProfile(data);
        } catch (err: any) {
          setProfileError(err.message || 'Failed to fetch Lichess profile');
          setLichessProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setLichessProfile(null);
      }
    };
    fetchProfile();
  }, [lichessInfo]);

  const handleUnlink = async () => {
    try {
      await unlinkLichess();
      setLichessProfile(null);
    } catch (err) {
      // Error is already handled in the context
    }
  };

  const handleStartGame = () => {
    navigation.navigate('OnlineGame', { gameType, timeControl });
  };

  if (isLoading || profileLoading) {
    return (
      <YStack style={{ flex: 1, backgroundColor: '$background', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#181A20" padding={24} alignItems="center">
      {/* Heading */}
      <Text fontSize={32} color="#8CB369" fontWeight="bold" marginBottom={8} marginTop={16} textAlign="center">
        {isAuthenticated ? `Welcome, ${user?.username}!` : 'Play Online with Lichess'}
      </Text>

      {/* Lichess Linked Info */}
      {isAuthenticated && lichessInfo && (
        <Text fontSize={18} color="#B0B0B0" marginBottom={24} textAlign="center">
          Lichess Linked: <Text color="#8CB369" fontWeight="bold">{lichessInfo.username}</Text>
        </Text>
      )}

      {/* Profile Card */}
      {isAuthenticated && lichessProfile && (
        <YStack
          backgroundColor="#23262F"
          borderRadius={16}
          padding={20}
          width="100%"
          maxWidth={400}
          marginBottom={24}
          shadowColor="#000"
          shadowOpacity={0.1}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 2 }}
        >
          <Text fontSize={22} fontWeight="bold" color="#8CB369" marginBottom={12}>
            Lichess Profile
          </Text>
          <Text color="#fff" marginBottom={4}>Username: {lichessProfile.username}</Text>
          <Text color="#fff" marginBottom={4}>ID: {lichessProfile.id}</Text>
          <Text fontSize={18} fontWeight="bold" color="#8CB369" marginBottom={8} marginTop={8}>
            Ratings:
          </Text>
          {lichessProfile.perfs && Object.entries(lichessProfile.perfs).map(([key, value]: [string, any]) => (
            value.rating && (
              <Text key={key} color="#fff" marginBottom={2}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {value.rating}
              </Text>
            )
          ))}
        </YStack>
      )}

      {/* Selectors and Buttons */}
      {isAuthenticated && (
        <YStack width="100%" maxWidth={400} gap={16}>
          <YStack style={{ marginTop: 16, marginBottom: 8, gap: 12, width: '100%' }}>
            <SelectorButton
              label={GAME_TYPE_OPTIONS.find(o => o.value === gameType)?.label || 'Select game type'}
              onPress={() => setGameTypeModalOpen(true)}
            />
            <Modal
              visible={gameTypeModalOpen}
              transparent
              animationType="slide"
              onRequestClose={() => setGameTypeModalOpen(false)}
            >
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <View style={{ height: '40%', backgroundColor: '#23262F', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 5, backgroundColor: '#444', borderRadius: 3, alignSelf: 'center', marginBottom: 16 }} />
                  <Text color="#8CB369" fontSize={18} marginBottom={16}>Select Game Type</Text>
                  {GAME_TYPE_OPTIONS.map(option => (
                    <OptionButton
                      key={option.value}
                      label={option.label}
                      selected={gameType === option.value}
                      onPress={() => {
                        setGameType(option.value);
                        setGameTypeModalOpen(false);
                      }}
                    />
                  ))}
                  <Button
                    onPress={() => setGameTypeModalOpen(false)}
                    style={{
                      marginTop: 24,
                      backgroundColor: 'transparent',
                      borderColor: '#8CB369',
                      borderWidth: 1,
                      borderRadius: 8,
                      width: 120,
                    }}
                  >
                    <Text color="#8CB369" fontSize={18}>Cancel</Text>
                  </Button>
                </View>
              </View>
            </Modal>
            <SelectorButton
              label={TIME_CONTROL_OPTIONS.find(o => o.value === timeControl)?.label || 'Select time control'}
              onPress={() => setTimeControlModalOpen(true)}
            />
            <Modal
              visible={timeControlModalOpen}
              transparent
              animationType="slide"
              onRequestClose={() => setTimeControlModalOpen(false)}
            >
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <View style={{
                  height: '40%',
                  backgroundColor: '#23262F',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  padding: 24,
                  alignItems: 'center'
                }}>
                  <View
                    style={{
                      width: 60,
                      height: 7,
                      backgroundColor: '#B0B0B0',
                      borderRadius: 4,
                      alignSelf: 'center',
                      marginBottom: 12,
                      marginTop: 4,
                      opacity: 0.8,
                    }}
                  />
                  <Text
                    style={{
                      color: '#B0B0B0',
                      fontSize: 14,
                      textAlign: 'center',
                      marginBottom: 12,
                      opacity: 0.8,
                    }}
                  >
                    Swipe down to close
                  </Text>
                  <Text color="#8CB369" fontSize={18} marginBottom={16}>Select Time Control</Text>
                  <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>
                    {TIME_CONTROL_OPTIONS.map(option => (
                      <OptionButton
                        key={option.value}
                        label={option.label}
                        selected={timeControl === option.value}
                        onPress={() => {
                          setTimeControl(option.value);
                          setTimeControlModalOpen(false);
                        }}
                      />
                    ))}
                  </ScrollView>
                  <Button
                    onPress={() => setTimeControlModalOpen(false)}
                    style={{
                      marginTop: 24,
                      backgroundColor: 'transparent',
                      borderColor: '#8CB369',
                      borderWidth: 1,
                      borderRadius: 8,
                      width: 120,
                    }}
                  >
                    <Text color="#8CB369" fontSize={18}>Cancel</Text>
                  </Button>
                </View>
              </View>
            </Modal>
          </YStack>

          <Button
            backgroundColor="#8CB369"
            borderRadius={8}
            marginBottom={8}
            onPress={handleStartGame}
            disabled={!gameType || !timeControl}
          >
            <Text color="#fff" fontSize={20}>Start Game</Text>
          </Button>
        
        </YStack>
      )}

      {/* Not Authenticated */}
      {!isAuthenticated && (
        <YStack gap={24} alignItems="center" marginTop={32}>
          <Button backgroundColor="#8CB369" borderRadius={8} onPress={login}>
            <Text color="#fff" fontSize={24}>Login with Lichess</Text>
          </Button>
        </YStack>
      )}
    </YStack>
  );
};

export default PlayMenuScreen;
