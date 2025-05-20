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

interface AuthContextType {
  isAuthenticated: boolean;
  user: LichessUser | null;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
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
      // Use query-string to parse the URL
      const parsed = queryString.parseUrl(event.url);
      const data = getFirstString(parsed.query.data);
      const error = getFirstString(parsed.query.error);
      const errorDescription = getFirstString(parsed.query.error_description);

      const errorStr = errorDescription || error;
      if (errorStr) {
        throw new Error(errorStr);
      }

      if (data) {
        const authData = JSON.parse(data);
        await AsyncStorage.setItem('lichess_token', authData.access_token);
        setUser(authData.user);
        setIsAuthenticated(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error handling deep link:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete authentication');
      setIsAuthenticated(false);
    }
  };

  const login = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/auth/lichess/login`);
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
      setUser(userData);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      console.error('Error refreshing user data:', err);
      setError('Failed to refresh user data');
      setIsAuthenticated(false);
    }
  };

  const value = {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 