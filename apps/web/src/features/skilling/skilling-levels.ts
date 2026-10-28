import { z } from 'zod';

const storageKey = 'osrs-helper.skilling-levels.v1';
const levelsSchema = z.record(z.string(), z.number().int().min(1).max(99));

export type SkillingLevels = Record<string, number>;

export function loadSkillingLevels(skills: readonly string[]): SkillingLevels {
  const defaults = Object.fromEntries(skills.map((skill) => [skill, 1]));
  if (typeof window === 'undefined') return defaults;

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaults;
    const result = levelsSchema.safeParse(JSON.parse(stored));
    if (!result.success) return defaults;
    return { ...defaults, ...result.data };
  } catch {
    return defaults;
  }
}

export function saveSkillingLevels(levels: SkillingLevels) {
  if (typeof window === 'undefined') return false;
  const result = levelsSchema.safeParse(levels);
  if (!result.success) return false;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}

export function clearSkillingLevels() {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
