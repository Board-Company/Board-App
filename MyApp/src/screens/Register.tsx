import { Stack, Text, Button, XStack, YStack } from 'tamagui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const Register = ({ navigation }: Props) => {
    return (
        <YStack space="$4" flex={1} alignItems="center" justifyContent="center">
            <Text fontSize={20} fontWeight="bold">
                Register
            </Text>
            <XStack space="$4">
                <Button
                    size="$4"
                    theme="blue"
                    onPress={() => navigation.navigate('Home')}
                >
                    Create Account
                </Button>
                <Button
                    size="$4"
                    theme="blue"
                    onPress={() => navigation.navigate('Login')}
                >
                    Back to Login
                </Button>
            </XStack>
        </YStack>
    )
}

export default Register;
