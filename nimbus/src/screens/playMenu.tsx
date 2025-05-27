import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
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

const PlayMenuScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout, unlinkLichess, lichessInfo, fetchLichessInfo } = useLichessAuth();
  const [lichessProfile, setLichessProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [gameType, setGameType] = useState('standard');
  const [timeControl, setTimeControl] = useState('600');
  const navigation = useNavigation<NavigationProp>();

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
    <YStack style={{ flex: 1, backgroundColor: '$background', padding: '$4' }}>
      {error && (
        <Text style={{ color: '$red10', textAlign: 'center', marginBottom: '$4' }}>{error}</Text>
      )}
      {isAuthenticated ? (
        <YStack style={{ gap: '$4', alignItems: 'center' }}>
          <Text style={{ fontSize: 32, color: '$color' }}>
            Welcome, {user?.username}!
          </Text>
          {lichessInfo ? (
            <>
              <Text style={{ fontSize: 24, color: '$color' }}>Lichess Linked: {lichessInfo.username}</Text>
              {profileError && <Text style={{ color: '$red10' }}>{profileError}</Text>}
              {lichessProfile && (
                <YStack style={{ backgroundColor: '$gray', padding: '$4', borderRadius: '$4', width: '100%' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '$color', marginBottom: 8 }}>Lichess Profile</Text>
                  <Text style={{ color: '$color' }}>Username: {lichessProfile.username}</Text>
                  <Text style={{ color: '$color' }}>ID: {lichessProfile.id}</Text>
                  <Text style={{ color: '$color' }}>Created: {new Date(lichessProfile.createdAt).toLocaleDateString()}</Text>
                  <Text style={{ color: '$color' }}>Seen: {new Date(lichessProfile.seenAt).toLocaleDateString()}</Text>
                  {lichessProfile.perfs && (
                    <YStack style={{ marginTop: '$2' }}>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '$color', marginBottom: 4 }}>Ratings:</Text>
                      {Object.entries(lichessProfile.perfs).map(([key, value]: [string, any]) => (
                        value.rating && (
                          <Text key={key} style={{ color: '$color' }}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}: {value.rating}
                          </Text>
                        )
                      ))}
                    </YStack>
                  )}
                </YStack>
              )}

              <YStack style={{ gap: '$4', width: '100%', maxWidth: 400 }}>
                <Select
                  id="game-type"
                  value={gameType}
                  onValueChange={setGameType}
                >
                  <Select.Trigger iconAfter={ChevronDown}>
                    <Select.Value placeholder="Select game type" />
                  </Select.Trigger>

                  <Adapt when="sm" platform="touch">
                    <Sheet modal dismissOnSnapToBottom>
                      <Sheet.Frame>
                        <Sheet.ScrollView>
                          <Adapt.Contents />
                        </Sheet.ScrollView>
                      </Sheet.Frame>
                      <Sheet.Overlay />
                    </Sheet>
                  </Adapt>

                  <Select.Content>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label>Game Type</Select.Label>
                        <Select.Item index={0} value="standard">
                          <Select.ItemText>Standard Chess</Select.ItemText>
                        </Select.Item>
                        <Select.Item index={1} value="chess960">
                          <Select.ItemText>Chess 960</Select.ItemText>
                        </Select.Item>
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>

                <Select
                  id="time-control"
                  value={timeControl}
                  onValueChange={setTimeControl}
                >
                  <Select.Trigger iconAfter={ChevronDown}>
                    <Select.Value placeholder="Select time control" />
                  </Select.Trigger>

                  <Adapt when="sm" platform="touch">
                    <Sheet modal dismissOnSnapToBottom>
                      <Sheet.Frame>
                        <Sheet.ScrollView>
                          <Adapt.Contents />
                        </Sheet.ScrollView>
                      </Sheet.Frame>
                      <Sheet.Overlay />
                    </Sheet>
                  </Adapt>

                  <Select.Content>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        <Select.Label>Time Control</Select.Label>
                        <Select.Item index={0} value="300">
                          <Select.ItemText>5 minutes</Select.ItemText>
                        </Select.Item>
                        <Select.Item index={1} value="600">
                          <Select.ItemText>10 minutes</Select.ItemText>
                        </Select.Item>
                        <Select.Item index={2} value="900">
                          <Select.ItemText>15 minutes</Select.ItemText>
                        </Select.Item>
                        <Select.Item index={3} value="1800">
                          <Select.ItemText>30 minutes</Select.ItemText>
                        </Select.Item>
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>

                <Button
                  style={{ backgroundColor: '$green10' }}
                  onPress={handleStartGame}
                  disabled={!gameType || !timeControl}
                >
                  <Text style={{ color: 'white', fontSize: 24 }}>Start Game</Text>
                </Button>

                <Button
                  style={{ backgroundColor: '$red10' }}
                  onPress={handleUnlink}
                >
                  <Text style={{ color: 'white', fontSize: 24 }}>Unlink Lichess Account</Text>
                </Button>

                <Button
                  style={{ backgroundColor: '$green10' }}
                  onPress={logout}
                >
                  <Text style={{ color: 'white', fontSize: 24 }}>Logout</Text>
                </Button>
              </YStack>
            </>
          ) : (
            <Button style={{ backgroundColor: '$green10' }} onPress={login}>
              <Text style={{ color: 'white', fontSize: 24 }}>Link Lichess Account</Text>
            </Button>
          )}
        </YStack>
      ) : (
        <YStack style={{ gap: '$4', alignItems: 'center' }}>
          <Text style={{ fontSize: 32, color: '$color' }}>Play Online with Lichess</Text>
          <Button style={{ backgroundColor: '$green10' }} onPress={login}>
            <Text style={{ color: 'white', fontSize: 24 }}>Login with Lichess</Text>
          </Button>
        </YStack>
      )}
    </YStack>
  );
};

export default PlayMenuScreen;
