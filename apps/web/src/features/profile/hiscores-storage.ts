import { type OsrsHiscoresSnapshot, validateHiscoresSnapshot } from '@/features/profile/hiscores';

const hiscoresStorageKey = 'osrs-helper.hiscores.v1';

export function loadHiscoresSnapshot(): OsrsHiscoresSnapshot | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(hiscoresStorageKey);
    if (!stored) return null;
    return validateHiscoresSnapshot(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveHiscoresSnapshot(snapshot: OsrsHiscoresSnapshot): boolean {
  if (typeof window === 'undefined') return false;
  const validated = validateHiscoresSnapshot(snapshot);
  if (!validated) return false;

  try {
    window.localStorage.setItem(hiscoresStorageKey, JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}

export function clearHiscoresSnapshot(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.removeItem(hiscoresStorageKey);
    return true;
  } catch {
    return false;
  }
}
