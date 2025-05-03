import { Button, YStack, Text , Input} from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useState } from 'react'
import { Alert } from 'react-native'
import { register, signInWithEmail } from '../services/auth.tsx'
import { useAuth } from '../contexts/AuthContext'

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (email && username && password) {
      try {
        setLoading(true)
        const success = await register({ email, username, password });
        if (success) {
          // Sign in the user after successful registration
          const authData = await signInWithEmail(email, password);
          await signIn(); // This will update the auth context
          navigation.navigate('Home');
        } else {
          Alert.alert('Registration failed', 'Please try again');
        }
      } catch (error) {
        console.error('Registration error:', error);
        Alert.alert('Registration failed', error instanceof Error ? error.message : 'Please try again');
      } finally {
        setLoading(false)
      }
    } else {
      Alert.alert('Please fill all fields');
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
            style={{ 
              backgroundColor: "#A4BE7B",
              height: 50,
              width: "100%"
            }}
            color="white"
            fontSize="$5"
            fontWeight="bold"
            pressStyle={{ opacity: 0.8 }}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

              <Button 
            style={{ 
              backgroundColor: "#333333",
              height: 50,
              width: "100%",
              borderColor: "#A4BE7B",
              borderWidth: 1
            }}
            color="#A4BE7B"
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