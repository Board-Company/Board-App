import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLichessAuth } from '../contexts/LichessAuthContext';
import { useNavigation } from '@react-navigation/native';

const PlayMenuScreen = () => {
  const { isAuthenticated, user, isLoading, error, login, logout } = useLichessAuth();
  const navigation = useNavigation();

  useEffect(() => {
    if (isAuthenticated) {
      // Replace 'MainTabs' with your actual main screen name if different
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [isAuthenticated, navigation]);

  if (isLoading) {
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
            Welcome, {user?.lichess_username || user?.username}!
          </Text>
          {user?.lichess_rating && (
            <View style={styles.ratingsContainer}>
              <Text style={styles.ratingTitle}>Your Ratings:</Text>
              {user.lichess_rating.bullet && (
                <Text style={styles.ratingText}>Bullet: {user.lichess_rating.bullet}</Text>
              )}
              {user.lichess_rating.blitz && (
                <Text style={styles.ratingText}>Blitz: {user.lichess_rating.blitz}</Text>
              )}
              {user.lichess_rating.rapid && (
                <Text style={styles.ratingText}>Rapid: {user.lichess_rating.rapid}</Text>
              )}
              {user.lichess_rating.classical && (
                <Text style={styles.ratingText}>Classical: {user.lichess_rating.classical}</Text>
              )}
            </View>
          )}
          <TouchableOpacity style={styles.button} onPress={logout}>
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
  ratingsContainer: {
    backgroundColor: '#3A3A3A',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
  },
  ratingTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  ratingText: {
    color: 'white',
    fontSize: 16,
    marginVertical: 5,
  },
});

export default PlayMenuScreen;
