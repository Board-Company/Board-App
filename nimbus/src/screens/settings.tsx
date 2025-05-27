import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config/constants';

// Add type for app user
interface AppUser {
  id: string;
  username: string;
  email?: string;
}

const SettingsScreen = () => {
  const { signOut, user: appUser } = useAuth() as { signOut: () => Promise<void>, user: AppUser | null };
  const { user: lichessUser, unlinkLichess, isLoading: isLichessLoading } = useLichessAuth();
  const navigation = useNavigation<any>();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      console.error('[Settings] Logout error:', err);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleUnlinkLichess = async () => {
    if (!lichessUser?.lichess_username) {
      Alert.alert('Error', 'No Lichess account is currently linked.');
      return;
    }

    Alert.alert(
      'Unlink Lichess Account',
      'Are you sure you want to unlink your Lichess account? This will not delete your Lichess account, but you will need to link it again to use Lichess features.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUnlinking(true);
              await unlinkLichess();
              Alert.alert('Success', 'Lichess account unlinked successfully.');
            } catch (err) {
              console.error('[Settings] Unlink error:', err);
              Alert.alert('Error', 'Failed to unlink Lichess account. Please try again.');
            } finally {
              setIsUnlinking(false);
            }
          }
        }
      ]
    );
  };

  const renderLichessSection = () => {
    if (!lichessUser) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lichess Account</Text>
        {lichessUser.lichess_username ? (
          <>
            <Text style={styles.accountInfo}>
              Linked as: {lichessUser.lichess_username}
            </Text>
          
            <TouchableOpacity 
              style={[styles.button, styles.unlinkButton]} 
              onPress={handleUnlinkLichess}
              disabled={isUnlinking || isLichessLoading}
            >
              {isUnlinking ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Unlink Lichess Account</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.noAccountText}>No Lichess account linked</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      
      {renderLichessSection()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.accountInfo}>
          Logged in as: {appUser?.username || 'Guest'}
        </Text>
        <TouchableOpacity 
          style={[styles.button, styles.logoutButton]} 
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    padding: 20,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#3A3A3A',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  accountInfo: {
    color: '#E0E0E0',
    fontSize: 16,
    marginBottom: 15,
  },
  noAccountText: {
    color: '#888',
    fontSize: 16,
    fontStyle: 'italic',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#D7263D',
  },
  unlinkButton: {
    backgroundColor: '#E74C3C',
  },
  ratingsContainer: {
    backgroundColor: '#2A2A2A',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  ratingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingText: {
    color: '#E0E0E0',
    fontSize: 14,
    marginVertical: 2,
  },
});

export default SettingsScreen; 