import { Button, YStack, Text, XStack } from 'tamagui'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { View, StyleSheet, Image } from 'react-native'

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
  Login: undefined;
  Register: undefined;
  mailLogin: undefined;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>()
  
  return (
    <YStack style={{ flex: 1, backgroundColor: "#2A2A2A", padding: 16 }}>
      {/* Main content */}
      <YStack style={{ flex: 1, justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        {/* Top section with welcome text */}
        <YStack style={{ alignItems: "center", marginTop: 40, gap: 24 }}>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "bold", textAlign: "center" }}>
            Welcome to Nimbus
          </Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "bold", textAlign: "center" }}>
            Every Move You Make, Glides Into Place.
          </Text>
        </YStack>
        
        {/* Bottom section with buttons */}
        <YStack style={{ width: "100%", gap: 16, marginBottom: 24 }}>
          {/* Get Started button */}
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
            onPress={() => navigation.navigate('Register')}
          >
            Get Started
          </Button>
          
          {/* OR divider */}
          <XStack style={{ alignItems: "center", width: "100%", marginVertical: 8 }}>
            <YStack style={{ flex: 1, height: 1, backgroundColor: "#555" }} />
            <Text style={{ color: "white", marginHorizontal: 16 }}>OR</Text>
            <YStack style={{ flex: 1, height: 1, backgroundColor: "#555" }} />
          </XStack>
          
          {/* Google sign in */}
          <Button 
            style={{ 
              backgroundColor: "#4A4A4A",
              height: 50,
              width: "100%",
              marginBottom: 8
            }}
            color="white"
            fontSize="$4"
            pressStyle={{ opacity: 0.8 }}
            //onPress={() => navigation.navigate('mailLogin')}
          >
            <XStack style={{ alignItems: "center", justifyContent: "center" }}>
              <View style={styles.iconPlaceholder}>
                <Image source={require('../../assets/images/google.png')} style={{ width: 24, height: 24 }}/>
              </View>
              <Text style={{ color: "white", fontSize: 16, marginLeft: 8 }}> Login with Google</Text>
            </XStack>
          </Button>
          
          {/* Email sign in */}
          <Button 
            style={{ 
              backgroundColor: "#4A4A4A",
              height: 50,
              width: "100%",
              marginBottom: 8
            }}
            color="white"
            fontSize="$4"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => navigation.navigate('mailLogin')}
          >
            <XStack style={{ alignItems: "center", justifyContent: "center" }}>
              {/* Simple envelope icon placeholder */}
              <View style={styles.iconPlaceholder}>
                <Text style={{ color: "white", fontSize: 16 }}>✉️</Text>
              </View>
              <Text style={{ color: "white", fontSize: 16, marginLeft: 8 }}>Continue with Email</Text>
            </XStack>
          </Button>
          
        </YStack>
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