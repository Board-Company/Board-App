import { Button, YStack, Text } from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>()
  
  return (
    <YStack style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 16 
    }}>
      <Text fontSize="$6" fontWeight="bold">Settings</Text>
      <Text style={{ marginTop: 10 }}>Configure your app settings here.</Text>
      
      <Button 
        theme="blue" 
        onPress={() => navigation.goBack()}
        style={{ marginTop: 20 }}
      >
        Go Back
      </Button>
    </YStack>
  )
} 