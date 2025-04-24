import { Stack, Text, Button, XStack, YStack } from 'tamagui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const Login = ({ navigation }: Props) => {
    return (
        <YStack space="$4" flex={1} alignItems="center" justifyContent="center">
            <Text fontSize={20} fontWeight="bold">Login</Text>
            <XStack space="$4">
                <Button
                    size="$4"
                    theme="blue"
                    onPress={() => navigation.navigate('Home')}
                >
                    Login
                </Button>
                <Button
                    size="$4"
                    theme="blue"
                    onPress={() => navigation.navigate('Register')}
                >
                    Register
                </Button>
            </XStack>
        </YStack>
    )
}

export default Login;
