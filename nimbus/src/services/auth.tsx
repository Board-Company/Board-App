
import { GoogleSignin, statusCodes, User as GoogleUser } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@env';
import { API_URL } from '../env';

interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AuthUser {
  id?: string;
  username?: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

// Cache keys
const AUTH_DATA_KEY = 'auth_data';
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const API_BASE_URL = API_URL;

function normalizeAuthUser(raw: Record<string, unknown>): AuthUser {
  const email = String(raw?.email ?? '');
  const username = raw?.username != null ? String(raw.username) : undefined;
  const id = raw?.id != null ? String(raw.id) : undefined;
  const nameRaw = raw?.name != null ? String(raw.name) : '';
  const name = nameRaw || username || email || 'Player';
  return {
    id: id || username || email,
    username,
    email,
    name,
    picture: raw?.picture != null ? String(raw.picture) : undefined,
  };
}

// Initialize Google Sign-In (webClientId is required for ID tokens on mobile)
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  offlineAccess: true,
  scopes: ['profile', 'email'],
});

// Cache management functions
const cacheAuthData = async (data: AuthResponse): Promise<void> => {
  const normalized: AuthResponse = {
    access_token: data.access_token,
    user: normalizeAuthUser(data.user as unknown as Record<string, unknown>),
  };
  try {
    await Promise.all([
      AsyncStorage.setItem(AUTH_DATA_KEY, JSON.stringify(normalized)),
      AsyncStorage.setItem(AUTH_TOKEN_KEY, normalized.access_token),
      AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(normalized.user)),
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
      AsyncStorage.removeItem(USER_DATA_KEY),
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
      AsyncStorage.getItem(USER_DATA_KEY),
    ]);

    if (!authData || !token || !userData) {
      return null;
    }

    const parsed = JSON.parse(userData) as Record<string, unknown>;
    return {
      access_token: token,
      user: normalizeAuthUser(parsed),
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
    if (!GOOGLE_WEB_CLIENT_ID) {
      throw new Error('GOOGLE_WEB_CLIENT_ID is missing in .env');
    }

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const signInResponse = await GoogleSignin.signIn();

    if (signInResponse.type === 'cancelled') {
      throw new Error('User cancelled the login flow');
    }

    let idToken = signInResponse.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      throw new Error(
        'No ID token from Google. Check GOOGLE_WEB_CLIENT_ID matches the OAuth Web client in Google Cloud.',
      );
    }

    const backendUrl = `${API_BASE_URL}/auth/google`;
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token: idToken }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[GoogleSignIn] Backend error:', response.status, responseText);
      throw new Error(
        responseText ? `Failed to authenticate with backend: ${responseText}` : 'Backend authentication failed',
      );
    }

    const data = JSON.parse(responseText) as AuthResponse;
    data.user = normalizeAuthUser(data.user as unknown as Record<string, unknown>);
    await cacheAuthData(data);
    return data;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('[GoogleSignIn] Error:', err?.message, err?.code);
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('User cancelled the login flow');
    }
    if (err?.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in is in progress');
    }
    if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play services not available');
    }
    const code = err?.code != null ? String(err.code) : '';
    if (code === '10' || err?.message?.includes('DEVELOPER_ERROR')) {
      throw new Error(
        'Google Sign-In configuration error. Use the Web OAuth client ID for webClientId and matching ANDROID/IOS clients in Google Cloud.',
      );
    }
    throw new Error(err?.message || 'Unknown error occurred');
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('GoogleSignin.signOut:', error);
  }
  await clearAuthCache();
};

export const getStoredAuthData = async (): Promise<AuthResponse | null> => {
  return getCachedAuthData();
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const signInWithUsername = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    const loginUrl = `${API_BASE_URL}/token`;
    const formBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = (await response.json()) as AuthResponse;
    data.user = normalizeAuthUser(data.user as unknown as Record<string, unknown>);
    await cacheAuthData(data);
    return data;
  } catch (error) {
    await clearAuthCache();
    console.error('[UsernameSignIn] Request failed:', error);
    throw error;
  }
};
