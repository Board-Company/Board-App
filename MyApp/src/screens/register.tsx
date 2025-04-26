import { Button, YStack, Text , Input} from 'tamagui'
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
    <YStack style={{ flex: 1, backgroundColor: "#2A2A2A", padding: 16 }}>
      <YStack style={{ flex: 1, justifyContent: "space-between", alignItems: "center", gap: 24 }}>
        {/* Top section with title and inputs */}
        <YStack style={{ alignItems: "center", marginTop: 40, gap: 24 , width: "100%"}}>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "bold", textAlign: "center" }}>
            Create an Account
          </Text>
          <Input width="90%" placeholder="Email" borderWidth={2} borderColor="white" />
          <Input width="90%" placeholder="Username" borderWidth={2} borderColor="white" />

          <Input width="90%" placeholder="Password" borderWidth={2} borderColor="white" />
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
          >
            Create Account
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
            >
            Go Back
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
} 