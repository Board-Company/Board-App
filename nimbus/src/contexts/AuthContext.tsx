import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithGoogle, signOut, getStoredAuthData, signInWithEmail } from '../services/auth';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check for existing user session
    const loadUser = async () => {
      try {
        const authData = await getStoredAuthData();
        if (authData) {
          setUser(authData.user);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const authData = await signInWithGoogle();
      setUser(authData.user);
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const authData = await signInWithEmail(email, password);
      setUser(authData.user);
    } catch (error) {
      console.error('Email sign in error:', error);
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
        signInWithEmail: handleEmailSignIn,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 