import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';

const PlayMenuScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout, unlinkLichess, lichessInfo, fetchLichessInfo } = useLichessAuth();
  const [lichessProfile, setLichessProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  if (isLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      {isAuthenticated ? (
        <View style={styles.content}>
          <Text style={styles.welcomeText}>
            Welcome, {user?.username}!
          </Text>
          {lichessInfo ? (
            <>
              <Text style={styles.text}>Lichess Linked: {lichessInfo.username}</Text>
              {profileError && <Text style={styles.errorText}>{profileError}</Text>}
              {lichessProfile && (
                <View style={styles.profileContainer}>
                  <Text style={styles.profileTitle}>Lichess Profile</Text>
                  <Text style={styles.profileText}>Username: {lichessProfile.username}</Text>
                  <Text style={styles.profileText}>ID: {lichessProfile.id}</Text>
                  <Text style={styles.profileText}>Created: {new Date(lichessProfile.createdAt).toLocaleDateString()}</Text>
                  <Text style={styles.profileText}>Seen: {new Date(lichessProfile.seenAt).toLocaleDateString()}</Text>
                  {lichessProfile.perfs && (
                    <View style={styles.ratingsContainer}>
                      <Text style={styles.ratingTitle}>Ratings:</Text>
                      {Object.entries(lichessProfile.perfs).map(([key, value]: [string, any]) => (
                        value.rating && (
                          <Text key={key} style={styles.ratingText}>{key.charAt(0).toUpperCase() + key.slice(1)}: {value.rating}</Text>
                        )
                      ))}
                    </View>
                  )}
                </View>
              )}
              <TouchableOpacity 
                style={[styles.button, styles.unlinkButton]} 
                onPress={handleUnlink}
              >
                <Text style={styles.buttonText}>Unlink Lichess Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.button} onPress={login}>
              <Text style={styles.buttonText}>Link Lichess Account</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.button, styles.logoutButton]} 
            onPress={logout}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.text}>Play Online with Lichess</Text>
          <TouchableOpacity style={styles.button} onPress={login}>
            <Text style={styles.buttonText}>Login with Lichess</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  welcomeText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#7FA650',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  unlinkButton: {
    backgroundColor: '#E74C3C',  // Red color for unlink
  },
  logoutButton: {
    backgroundColor: '#7FA650',  // Green color for logout
  },
  profileContainer: {
    backgroundColor: '#3A3A3A',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
  },
  profileTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  profileText: {
    color: 'white',
    fontSize: 16,
    marginVertical: 2,
  },
  ratingsContainer: {
    marginTop: 10,
  },
  ratingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  ratingText: {
    color: 'white',
    fontSize: 15,
    marginVertical: 1,
  },
});

export default PlayMenuScreen;
