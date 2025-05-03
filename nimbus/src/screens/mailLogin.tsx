import { Button, YStack, Text, Input} from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Alert, TouchableOpacity, View } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAuth } from '../contexts/AuthContext'
import React, { useState } from 'react'

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function mailLogin() {
  const navigation = useNavigation<NavigationProp>()
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email, password);
      navigation.navigate('Home');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'Please check your credentials and try again'
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <YStack style={{ flex: 1, backgroundColor: "#2A2A2A", padding: 16 }}>
      {/* Top left back arrow icon */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ position: 'absolute', top: 32, left: 16, zIndex: 10, padding: 8 }}
      >
        {/* If this icon does not render, ensure react-native-vector-icons is linked and try rebuilding the app. */}
        <Ionicons name="chevron-back" size={28} color="#A4BE7B" />
      </TouchableOpacity>
      <YStack style={{ flex: 1, justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        {/* Top section with title and inputs */}
        <YStack style={{ alignItems: "center", marginTop: 40, gap: 24 , width: "100%"}}>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "bold", textAlign: "center" }}>
            Login
          </Text>
          <Input 
            width="90%" 
            placeholder="Email" 
            borderWidth={2} 
            borderColor="white" 
            value={email}
            onChangeText={setEmail}
          />
          <Input 
            width="90%" 
            placeholder="Password" 
            borderWidth={2} 
            borderColor="white" 
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
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
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
} 