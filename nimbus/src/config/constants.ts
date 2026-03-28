import { BASE_URL } from '@env';

/** Trim trailing slashes so `${API_URL}/users/me` never becomes `//users/me`. */
export const API_URL = (BASE_URL || '').replace(/\/+$/, '');

// Other constants can be added here as needed 