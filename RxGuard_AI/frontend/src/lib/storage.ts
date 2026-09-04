import { Platform } from 'react-native';

// Safe localStorage wrapper (web only).
export const storage = {
  get(key: string): string | null {
    if (Platform.OS !== 'web') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const KEYS = {
  token: 'rxguard_token',
  user: 'rxguard_user',
  rememberedEmail: 'rxguard_remembered_email',
  flashMessage: 'rxguard_flash_message',
};
