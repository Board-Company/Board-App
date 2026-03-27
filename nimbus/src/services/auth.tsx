
import { GoogleSignin, statusCodes, User as GoogleUser } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@env';

interface RegisterData {
  email: string;
  username: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

// Cache keys
const AUTH_DATA_KEY = 'auth_data';
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const API_BASE_URL = BASE_URL.replace(/\/+$/, '');

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: "707897598265-f18r9das4pigimbkt1niife5655ol5lc.apps.googleusercontent.com",
  offlineAccess: true,
  scopes: ['profile', 'email']
});

// Cache management functions
const cacheAuthData = async (data: AuthResponse): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(AUTH_DATA_KEY, JSON.stringify(data)),
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access_token),
      AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user))
    ]);
  } catch (error) {
    console.error('Error caching auth data:', error);
    throw error;
  }
};

const clearAuthCache = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_DATA_KEY),
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_DATA_KEY)
    ]);
  } catch (error) {
    console.error('Error clearing auth cache:', error);
    throw error;
  }
};

const getCachedAuthData = async (): Promise<AuthResponse | null> => {
  try {
    const [authData, token, userData] = await Promise.all([
      AsyncStorage.getItem(AUTH_DATA_KEY),
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(USER_DATA_KEY)
    ]);

    if (!authData || !token || !userData) {
      return null;
    }

    return {
      access_token: token,
      user: JSON.parse(userData)
    };
  } catch (error) {
    console.error('Error getting cached auth data:', error);
    return null;
  }
};

export const register = async (data: RegisterData): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Registration failed');
    }

    return true;
  } catch (error) {
    throw error;
  }
};

export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    console.log('[GoogleSignIn] Starting Google Sign-In process...');
    console.log('[GoogleSignIn] Using webClientId:', GOOGLE_WEB_CLIENT_ID);
    
    console.log('[GoogleSignIn] Checking Play Services...');
    await GoogleSignin.hasPlayServices();
    console.log('[GoogleSignIn] Play Services available.');
    
    // Attempt sign in
    console.log('[GoogleSignIn] Attempting sign in...');
    const signInResponse = await GoogleSignin.signIn();
    console.log('[GoogleSignIn] Full sign in response:', JSON.stringify(signInResponse, null, 2));
    
    // Access idToken from the nested data object
    const idToken = signInResponse.data?.idToken;
    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }
    
    // Send token to your backend
    const backendUrl = `${BASE_URL}/auth/google`;
    console.log('[GoogleSignIn] Preparing to send request to:', backendUrl);
    const backendPayload = { token: idToken };
    console.log('[GoogleSignIn] Backend payload:', JSON.stringify(backendPayload, null, 2));
    
    try {
      console.log('[GoogleSignIn] Sending request to backend...');
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(backendPayload),
      });
      
      console.log('[GoogleSignIn] Backend response status:', response.status);
      console.log('[GoogleSignIn] Backend response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
      
      const responseText = await response.text();
      console.log('[GoogleSignIn] Backend response text:', responseText);
      
      if (!response.ok) {
        console.error('[GoogleSignIn] Backend authentication failed:', responseText);
        throw new Error(`Failed to authenticate with backend: ${responseText}`);
      }
      
      const data: AuthResponse = JSON.parse(responseText);
      console.log('[GoogleSignIn] Backend authentication successful:', JSON.stringify(data, null, 2));
      // Cache the auth data
      await cacheAuthData(data);
      return data;
    } catch (error) {
      console.error('[GoogleSignIn] Network or parsing error:', error);
      throw error;
    }
  } catch (error: any) {
    console.error('[GoogleSignIn] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('User cancelled the login flow');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in is in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play services not available');
    } else if (error.code === 'DEVELOPER_ERROR') {
      console.error('[GoogleSignIn] DEVELOPER_ERROR details:', {
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
    await clearAuthCache();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const getStoredAuthData = async (): Promise<AuthResponse | null> => {
  return getCachedAuthData();
};

export const signInWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const loginUrl = `${API_BASE_URL}/token`;
    const formBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    console.log('[UsernameSignIn] BASE_URL:', BASE_URL);
    console.log('[UsernameSignIn] API_BASE_URL:', API_BASE_URL);
    console.log('[UsernameSignIn] loginUrl:', loginUrl);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formBody,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    await cacheAuthData(data);
    return data;
  } catch (error) {
    console.error('[UsernameSignIn] Request failed:', error);
    throw error;
  }
};
