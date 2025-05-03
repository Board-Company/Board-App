import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';

type RootStackParamList = {
  Home: undefined;
  About: undefined;
  Settings: undefined;
  Login: undefined;
  Register: undefined;
  mailLogin: undefined;
  PlayMenu: undefined;
  Play: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    if (!loading && !user) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [user, loading, navigation]);

  if (loading) {
    return null; // Or a loading spinner
  }

  return user ? <>{children}</> : null;
} 