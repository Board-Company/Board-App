import { Button, YStack, Text, XStack } from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { View, StyleSheet } from 'react-native'

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>()
  
  return (
    <YStack f={1} bg="#2A2A2A" p="$4">
      {/* Main content */}
      <YStack f={1} jc="center" ai="center" gap="$6">
        <Text color="white" fontSize="$8" fontWeight="bold" textAlign="center">
          Welcome to Nimbus
        </Text>
        <Text color="white" fontSize="$6" fontWeight="bold" textAlign="center">
          Every Move You Make, Glides Into Place.
        </Text>
        
        {/* Get Started button */}
        <Button 
          bg="#A4BE7B" 
          color="white"
          fontSize="$5"
          fontWeight="bold"
          h={50}
          w="100%"
          mt="$6"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => navigation.navigate('About')}
        >
          Get Started
        </Button>
        
        {/* OR divider */}
        <XStack ai="center" w="100%" my="$2">
          <YStack f={1} h={1} bg="#555" />
          <Text color="white" mx="$4">OR</Text>
          <YStack f={1} h={1} bg="#555" />
        </XStack>
        
        {/* Email sign in - without Expo icons */}
        <Button 
          bg="#4A4A4A" 
          color="white"
          fontSize="$4"
          h={50}
          w="100%"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => navigation.navigate('About')}
        >
          <XStack ai="center" jc="center">
            {/* Simple envelope icon placeholder */}
            <View style={styles.iconPlaceholder}>
              <Text color="white" fontSize={16}>✉️</Text>
            </View>
            <Text color="white" fontSize="$4" ml="$2">Continue with Email</Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  )
}

// Additional styles for our custom icon placeholder
const styles = StyleSheet.create({
  iconPlaceholder: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  }
});