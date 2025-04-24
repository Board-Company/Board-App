import { Stack, Text, Button, YStack } from 'tamagui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const Home = ({ navigation }: Props) => {
    return (
        <YStack space="$4" flex={1} alignItems="center" justifyContent="center">
            <Text fontSize={20} fontWeight="bold">
                Welcome Home!
            </Text>
            <Button
                size="$4"
                theme="blue"
                onPress={() => navigation.navigate('Login')}
            >
                Logout
            </Button>
        </YStack>
    )
}

export default Home;
