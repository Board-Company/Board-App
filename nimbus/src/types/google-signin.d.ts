declare module '@react-native-google-signin/google-signin' {
  export interface User {
    id: string;
    email: string;
    name: string;
    photo?: string;
  }

  export interface SignInResponse {
    user: User;
  }

  export const statusCodes: {
    SIGN_IN_CANCELLED: string;
    IN_PROGRESS: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
  };

  export default class GoogleSignin {
    static configure(config: {
      webClientId: string;
      offlineAccess?: boolean;
    }): void;
    static hasPlayServices(): Promise<boolean>;
    static signIn(): Promise<SignInResponse>;
    static signOut(): Promise<void>;
  }
} 