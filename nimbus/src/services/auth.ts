import { GoogleSignin, statusCodes, User as GoogleUser } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: '707897598265-33vag82hncte292mk5qp7l2mpsq8h72g.apps.googleusercontent.com',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
  scopes: ['profile', 'email']
});

export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    // Check Play Services first
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Attempt sign in
    const userInfo = await GoogleSignin.signIn();
    console.log('Google Sign-In Success:', userInfo);
    
    // Get the ID token
    const { idToken } = await GoogleSignin.getTokens();
    console.log('Got ID token');
    
    // Send token to your backend
    const response = await fetch('http://10.0.2.2:8000/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: idToken
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend authentication failed:', errorText);
      throw new Error(`Failed to authenticate with backend: ${errorText}`);
    }

    const data: AuthResponse = await response.json();
    console.log('Backend authentication successful');
    
    // Store the auth data
    await AsyncStorage.setItem('auth_data', JSON.stringify(data));
    
    return data;
    
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('User cancelled the login flow');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in is in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play services not available');
    } else if (error.code === 'DEVELOPER_ERROR') { // Use string literal instead of statusCodes
      console.error('DEVELOPER_ERROR details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw new Error('Google Sign In configuration error. Please check your setup.');
    } else {
      throw new Error(error.message || 'Unknown error occurred');
    }
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
    await AsyncStorage.removeItem('auth_data');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const getStoredAuthData = async (): Promise<AuthResponse | null> => {
  try {
    const storedData = await AsyncStorage.getItem('auth_data');
    return storedData ? JSON.parse(storedData) : null;
  } catch (error) {
    console.error('Error getting stored auth data:', error);
    return null;
  }
};
