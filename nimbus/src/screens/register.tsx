import { Button, YStack, Text, Input } from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useState } from 'react'
import { ToastAndroid } from 'react-native'
import { register, signInWithUsername } from '../services/auth.tsx'
import { useAuth } from '../contexts/AuthContext'

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  UserLogin: undefined;
  PlayMenu: undefined;
  Play: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { signInWithUsername } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const showError = (message: string) => {
    ToastAndroid.show(message, ToastAndroid.LONG);
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    if (!email || !username || !password) {
      showError('Please fill all fields');
      return;
    }

    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true)
      await register({ email, username, password });
      // If we get here, registration was successful
      try {
        await signInWithUsername(username, password);
        // Navigate to home
        navigation.navigate('Home');
      } catch (error) {
        showError('Registration successful. Please sign in manually.');
        navigation.navigate('UserLogin');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('Username already registered')) {
        showError('This username is already taken. Please choose another one.');
      } else if (errorMessage.includes('Email already registered')) {
        showError('This email is already registered. Please use another email.');
      } else {
        showError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <YStack style={{ flex: 1, backgroundColor: "#2A2A2A", padding: 16 }}>
      <YStack style={{ flex: 1, justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        {/* Top section with title and inputs */}
        <YStack style={{ alignItems: "center", marginTop: 40, gap: 24 , width: "100%"}}>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "bold", textAlign: "center" }}>
            Create an Account
          </Text>
          <Input width="90%" placeholder="Email" borderWidth={2} borderColor="white" value={email} onChangeText={setEmail} />
          <Input width="90%" placeholder="Username" borderWidth={2} borderColor="white" value={username} onChangeText={setUsername} />
          <Input width="90%" placeholder="Password" borderWidth={2} borderColor="white" value={password} onChangeText={setPassword} secureTextEntry />
        </YStack>

        {/* Bottom section with buttons */}
        <YStack style={{ width: "100%", gap: 16, marginBottom: 24 }}>
          <Button 
            style={{ backgroundColor: "#A4BE7B", height: 50, width: "100%" }}
            fontSize="$5"
            fontWeight="bold"
            pressStyle={{ opacity: 0.8 }}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={{ color: 'white' }}>{loading ? 'Registering...' : 'Register'}</Text>
          </Button>

          <Button 
            style={{ 
              backgroundColor: "#333333",
              height: 50,
              width: "100%",
              borderColor: "#A4BE7B",
              borderWidth: 1
            }}
            fontSize="$4"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            Go Back
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
} 