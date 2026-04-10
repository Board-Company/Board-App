declare module '@env' {
  export const BASE_URL: string;
  /** Optional; if unset, LLM URL is derived from BASE_URL with port 8001. */
  export const LLM_SERVICE_URL: string | undefined;
  export const GOOGLE_WEB_CLIENT_ID: string;
  export const GOOGLE_ANDROID_CLIENT_ID: string;
  export const GOOGLE_IOS_CLIENT_ID: string;
} 