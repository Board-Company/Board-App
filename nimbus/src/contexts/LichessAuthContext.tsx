import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../env';
import queryString from 'query-string';
import { getStoredAuthData } from '../services/auth';
import { useAuth } from './AuthContext';

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
  fetchLichessInfo: (appJwtOverride?: string) => Promise<void>;
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
  const { isAuthenticated: isAppAuthenticated, loading: isAppAuthLoading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<LichessUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lichessInfo, setLichessInfo] = useState<LichessInfo | null>(null);

  useEffect(() => {
    // Set up URL event listener for OAuth callback
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

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
      if (!dataStr) {
        console.error('[LichessAuth] No data found in deep link');
        throw new Error('No authentication data received');
      }

      console.log('[LichessAuth] Processing auth data');
      const authData = JSON.parse(dataStr);
      console.log('[LichessAuth] Parsed auth data:', authData);

      // Store the Lichess token
      await AsyncStorage.setItem('lichess_token', authData.access_token);
      
      // Update state with user data
      setUser(authData.user);
      setIsAuthenticated(true);
      setError(null);
      
      // Fetch fresh Lichess info
      await fetchLichessInfo();
      
      console.log('[LichessAuth] Successfully processed auth data');
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
      
      // Get the app's JWT from auth service
      const authData = await getStoredAuthData();
      if (!authData?.access_token) {
        throw new Error('Please log in to the app first');
      }

      console.log('[LichessAuth] Starting Lichess login with app JWT');
      const response = await fetch(`${API_URL}/auth/lichess/login`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('[LichessAuth] Backend error:', data);
        throw new Error(data.detail || 'Failed to initiate login');
      }
      if (!data.auth_url) {
        console.error('[LichessAuth] No auth_url in backend response:', data);
        throw new Error('No authorization URL received from backend');
      }

      console.log('[LichessAuth] Opening Lichess auth URL');
      await Linking.openURL(data.auth_url);
    } catch (err) {
      console.error('[LichessAuth] Login error:', err);
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

  // Memoize fetchLichessInfo to prevent unnecessary polling
  const fetchLichessInfo = useCallback(async (appJwtOverride?: string) => {
    try {
      let token = appJwtOverride;
      if (!token) {
        const authData = await getStoredAuthData();
        token = authData?.access_token || undefined;
      }
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
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use app JWT for all app API calls
      const authData = await getStoredAuthData();
      if (authData?.access_token) {
        await refreshUserData(authData.access_token);
        await fetchLichessInfo(authData.access_token);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLichessInfo(null);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  }, [fetchLichessInfo]);

  useEffect(() => {
    if (isAppAuthLoading) {
      return;
    }

    if (!isAppAuthenticated) {
      setUser(null);
      setIsAuthenticated(false);
      setLichessInfo(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    checkAuthStatus();
  }, [checkAuthStatus, isAppAuthenticated, isAppAuthLoading]);

  const unlinkLichess = async () => {
    try {
      // Get the app's JWT for unlinking
      const authData = await getStoredAuthData();
      if (!authData?.access_token) {
        throw new Error('Please log in to the app first');
      }

      console.log('[LichessAuth] Unlinking Lichess account with app JWT');
      const response = await fetch(`${API_URL}/users/unlink-lichess`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to unlink Lichess account');
      }

      // Clear Lichess token and update state
      await AsyncStorage.removeItem('lichess_token');
      if (user) {
        setUser({
          ...user,
          lichess_username: undefined,
          lichess_rating: undefined
        });
      }
      setLichessInfo(null);
      console.log('[LichessAuth] Successfully unlinked Lichess account');
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
