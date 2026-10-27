import { z } from 'zod';

const profileStorageKey = 'osrs-helper.preferences.v1';

export const profilePreferencesSchema = z.object({
  username: z.string().trim().max(12, 'Le pseudo est limité à 12 caractères.'),
  capitalGp: z
    .number()
    .int()
    .min(0, 'Le capital ne peut pas être négatif.')
    .max(999_999_999_999, 'Le montant est trop élevé.'),
  strategy: z.enum(['Prudente', 'Équilibrée', 'Agressive']),
  skillingStyle: z.enum(['Toutes', 'AFK', 'Actif']),
  compactNumbers: z.boolean(),
});

export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;

export const defaultProfilePreferences: ProfilePreferences = {
  username: '',
  capitalGp: 0,
  strategy: 'Équilibrée',
  skillingStyle: 'Toutes',
  compactNumbers: false,
};

export function loadProfilePreferences(): ProfilePreferences {
  if (typeof window === 'undefined') return defaultProfilePreferences;

  try {
    const stored = window.localStorage.getItem(profileStorageKey);
    if (!stored) return defaultProfilePreferences;

    const parsed: unknown = JSON.parse(stored);
    const result = profilePreferencesSchema.safeParse(parsed);
    return result.success ? result.data : defaultProfilePreferences;
  } catch {
    return defaultProfilePreferences;
  }
}

export function saveProfilePreferences(preferences: ProfilePreferences) {
  if (typeof window === 'undefined') return false;

  const result = profilePreferencesSchema.safeParse(preferences);
  if (!result.success) return false;

  try {
    window.localStorage.setItem(profileStorageKey, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}

export function hasSavedProfilePreferences() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(profileStorageKey) !== null;
  } catch {
    return false;
  }
}

export function clearProfilePreferences() {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.removeItem(profileStorageKey);
    return true;
  } catch {
    return false;
  }
}
