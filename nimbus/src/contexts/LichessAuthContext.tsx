import React, { createContext, useContext, useState, useEffect } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/constants';
import queryString from 'query-string';

interface LichessUser {
  username: string;
  email?: string;
  lichess_username?: string;
  auth_provider?: string;
  lichess_rating?: {
    bullet?: number;
    blitz?: number;
    rapid?: number;
    classical?: number;
  };
}

interface LichessInfo {
  username: string;
  user_id?: string;
  access_token?: string;
  // Add more fields as needed
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: LichessUser | null;
  isLoading: boolean;
  error: string | null;
  lichessInfo: LichessInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  unlinkLichess: () => Promise<void>;
  fetchLichessInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useLichessAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useLichessAuth must be used within a LichessAuthProvider');
  }
  return context;
};

export const LichessAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<LichessUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lichessInfo, setLichessInfo] = useState<LichessInfo | null>(null);

  useEffect(() => {
    checkAuthStatus();
    // Set up URL event listener for OAuth callback
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('lichess_token');
      if (token) {
        await refreshUserData(token);
        await fetchLichessInfo();
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  };

  const getFirstString = (val: string | (string | null)[] | undefined | null) => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
    return undefined;
  };

  const handleDeepLink = async (event: { url: string }) => {
    try {
      console.log('[LichessAuth] Received deep link:', event.url);
      const parsed = queryString.parseUrl(event.url);
      console.log('[LichessAuth] Parsed URL:', parsed);
      const errorData = parsed.query.error ? JSON.parse(parsed.query.error as string) : null;
      const error = errorData?.error || getFirstString(parsed.query.error);
      const errorDescription = errorData?.error_description || getFirstString(parsed.query.error_description);
      const errorStr = errorDescription || error;
      if (errorStr) {
        console.error('[LichessAuth] Auth error:', errorStr);
        throw new Error(errorStr);
      }
      const dataStr = parsed.query.data as string;
      if (dataStr) {
        console.log('[LichessAuth] Processing auth data');
        const authData = JSON.parse(dataStr);
        console.log('[LichessAuth] Parsed auth data:', authData);
        // Store the Lichess token separately if needed, but do not use it as the app JWT
        await AsyncStorage.setItem('lichess_token', authData.access_token);
        // After OAuth, refresh user data and lichess info
        await checkAuthStatus();
        setUser(authData.user);
        setIsAuthenticated(true);
        setError(null);
        console.log('[LichessAuth] Successfully processed auth data');
      } else {
        console.error('[LichessAuth] No data found in deep link');
        throw new Error('No authentication data received');
      }
    } catch (err) {
      console.error('[LichessAuth] Error handling deep link:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete authentication');
      setIsAuthenticated(false);
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Use the app user's JWT for Authorization
      const appToken = await AsyncStorage.getItem('app_token');
      const response = await fetch(`${API_URL}/auth/lichess/login`, {
        headers: appToken ? { 'Authorization': `Bearer ${appToken}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Backend error:', data);
        throw new Error(data.detail || 'Failed to initiate login');
      }
      if (!data.auth_url) {
        console.error('No auth_url in backend response:', data);
        throw new Error('No authorization URL received from backend');
      }
      await Linking.openURL(data.auth_url);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate login');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('lichess_token');
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setLichessInfo(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    }
  };

  const refreshUserData = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to refresh user data');
      }
      const userData = await response.json();
      const structuredUserData: LichessUser = {
        username: userData.username,
        email: userData.email,
        lichess_username: userData.lichess_username,
        auth_provider: userData.auth_provider,
        lichess_rating: userData.lichess_rating
      };
      setUser(structuredUserData);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      console.error('Error refreshing user data:', err);
      setError('Failed to refresh user data');
      setIsAuthenticated(false);
    }
  };

  const fetchLichessInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('lichess_token');
      if (!token) {
        setLichessInfo(null);
        return;
      }
      const response = await fetch(`${API_URL}/users/lichess-info`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        setLichessInfo(null);
        return;
      }
      const data = await response.json();
      setLichessInfo(data.lichess || null);
    } catch (err) {
      setLichessInfo(null);
    }
  };

  const unlinkLichess = async () => {
    try {
      const token = await AsyncStorage.getItem('lichess_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      const response = await fetch(`${API_URL}/users/unlink-lichess`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to unlink Lichess account');
      }
      if (user) {
        setUser({
          ...user,
          lichess_username: undefined,
          lichess_rating: undefined
        });
      }
      setLichessInfo(null);
    } catch (err) {
      console.error('[LichessAuth] Error unlinking account:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink Lichess account');
      throw err;
    }
  };

  const value = {
    isAuthenticated,
    user,
    isLoading,
    error,
    lichessInfo,
    login,
    logout,
    unlinkLichess,
    fetchLichessInfo
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 