import { BASE_URL, LLM_SERVICE_URL } from '@env';

/** Trim trailing slashes so `${API_URL}/users/me` never becomes `//users/me`. */
export const API_URL = (BASE_URL || '').replace(/\/+$/, '');

/**
 * Board-LLM base URL. Set LLM_SERVICE_URL in `.env` when API and LLM use different hosts or ports
 * (e.g. EC2 with nginx paths, or LLM on another port than derived from BASE_URL).
 * Otherwise we reuse BASE_URL's host and set port to 8001.
 */
export const LLM_API_URL = (() => {
  const explicit = (LLM_SERVICE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) {
    return explicit;
  }
  try {
    const u = new URL(BASE_URL || 'http://localhost:8000/');
    u.port = '8001';
    return u.origin;
  } catch {
    return 'http://localhost:8001';
  }
})();