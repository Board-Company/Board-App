import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: '707897598265-gtmb4jh9p6b1pq9a0l9ql2clbjk5f1kh.apps.googleusercontent.com', // Get this from your Google Cloud Console
});

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    
    // Get the ID token
    const { accessToken } = await GoogleSignin.getTokens();
    
    // Send token to your backend
    const response = await fetch('http://your-backend-url:8000/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: accessToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with backend');
    }

    const data = await response.json();
    return data; // This will contain your JWT token from the backend
    
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('User cancelled the login flow');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in is in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play services not available');
    } else {
      throw new Error('Unknown error occurred');
    }
  }
};

export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    // Clear your local auth state here
  } catch (error) {
    console.error(error);
  }
};
