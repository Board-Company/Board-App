import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';

const PlayMenuScreen = () => {
  const [selectedButton, setSelectedButton] = useState<'lichess' | 'nimbus' | null>(null);

  const renderContent = () => {
    if (selectedButton === 'lichess') {
      return (
        <View style={styles.contentContainer}>
          <Text style={styles.contentText}>Lichess content will appear here</Text>
        </View>
      );
    } else if (selectedButton === 'nimbus') {
      return (
        <View style={styles.contentContainer}>
          <Text style={styles.contentText}>Nimbus content will appear here</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        {/* Lichess play button */}
        <TouchableOpacity 
          style={[
            styles.lichessButton, 
            selectedButton === 'lichess' && styles.selectedButton
          ]}
          onPress={() => setSelectedButton('lichess')}
        >
          <Image 
            source={require('../../assets/unnamed.webp')} 
            style={styles.logoImage} 
          />
          <Text style={styles.lichessButtonText}>Play on Lichess</Text>
        </TouchableOpacity>
        <View style={styles.buttonSpacer} />
        <TouchableOpacity 
          style={[
            styles.playButton, 
            selectedButton === 'nimbus' && styles.selectedButton
          ]}
          onPress={() => setSelectedButton('nimbus')}
        >
          <Text style={styles.playButtonText}>Play on Nimbus</Text>
        </TouchableOpacity>
      </View>
      
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    justifyContent: 'flex-start',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 0,
  },
  playButton: {
    backgroundColor: '#8CB369',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  lichessButton: {
    backgroundColor: '#000000',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  playButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  lichessButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  logoImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  buttonSpacer: {
    height: 9.45,
  },
  selectedButton: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default PlayMenuScreen;
