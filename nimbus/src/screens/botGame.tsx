import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../components/header';

const BotGameScreen = () => (
  <View style={styles.container}>
    <Header />
    <View style={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Nimbus Bot</Text>
        <Text style={styles.title}>Bot play is coming next.</Text>
        <Text style={styles.subtitle}>
          This screen is now styled to match the rest of Nimbus, and it is ready for the bot flow when you wire it in.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Planned Here</Text>
        <Text style={styles.panelText}>Choose difficulty, side, and time control before starting a bot match.</Text>
        <TouchableOpacity activeOpacity={0.92} style={styles.button}>
          <Text style={styles.buttonText}>Bot Setup Coming Soon</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202020',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#131313',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#24351B',
  },
  eyebrow: {
    color: '#8CB369',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    color: '#AEB8A8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  panel: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#24351B',
    gap: 10,
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    color: '#AEB8A8',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 52,
    backgroundColor: '#8CB369',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#081005',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default BotGameScreen;
