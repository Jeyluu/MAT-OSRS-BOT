import { z } from 'zod';

export const osrsHiscoresSkills = [
  { id: 'overall', label: 'Overall', maximumLevel: 2_376 },
  { id: 'attack', label: 'Attack', maximumLevel: 99 },
  { id: 'defence', label: 'Defence', maximumLevel: 99 },
  { id: 'strength', label: 'Strength', maximumLevel: 99 },
  { id: 'hitpoints', label: 'Hitpoints', maximumLevel: 99 },
  { id: 'ranged', label: 'Ranged', maximumLevel: 99 },
  { id: 'prayer', label: 'Prayer', maximumLevel: 99 },
  { id: 'magic', label: 'Magic', maximumLevel: 99 },
  { id: 'cooking', label: 'Cooking', maximumLevel: 99, skillingSkill: 'Cooking' },
  {
    id: 'woodcutting',
    label: 'Woodcutting',
    maximumLevel: 99,
    skillingSkill: 'Woodcutting',
  },
  {
    id: 'fletching',
    label: 'Fletching',
    maximumLevel: 99,
    skillingSkill: 'Fletching',
  },
  { id: 'fishing', label: 'Fishing', maximumLevel: 99 },
  { id: 'firemaking', label: 'Firemaking', maximumLevel: 99 },
  { id: 'crafting', label: 'Crafting', maximumLevel: 99, skillingSkill: 'Crafting' },
  { id: 'smithing', label: 'Smithing', maximumLevel: 99, skillingSkill: 'Smithing' },
  { id: 'mining', label: 'Mining', maximumLevel: 99 },
  {
    id: 'herblore',
    label: 'Herblore',
    maximumLevel: 99,
    skillingSkill: 'Herblore',
  },
  { id: 'agility', label: 'Agility', maximumLevel: 99 },
  { id: 'thieving', label: 'Thieving', maximumLevel: 99 },
  { id: 'slayer', label: 'Slayer', maximumLevel: 99 },
  { id: 'farming', label: 'Farming', maximumLevel: 99, skillingSkill: 'Farming' },
  { id: 'runecraft', label: 'Runecraft', maximumLevel: 99, skillingSkill: 'Runecraft' },
  { id: 'hunter', label: 'Hunter', maximumLevel: 99 },
  { id: 'construction', label: 'Construction', maximumLevel: 99 },
  { id: 'sailing', label: 'Sailing', maximumLevel: 99 },
] as const;

export type OsrsHiscoresSkillId = (typeof osrsHiscoresSkills)[number]['id'];
export type OsrsHiscoresScore = {
  rank: number | null;
  level: number | null;
  experience: number | null;
};
export type OsrsHiscoresScores = Record<OsrsHiscoresSkillId, OsrsHiscoresScore>;

export interface OsrsHiscoresSnapshot {
  readonly username: string;
  readonly importedAt: number;
  readonly scores: OsrsHiscoresScores;
}

const integerTextSchema = z
  .string()
  .regex(/^-?\d+$/, 'La réponse doit contenir des nombres entiers séparés par des virgules.')
  .transform(Number)
  .refine(Number.isSafeInteger, 'Une valeur dépasse la précision numérique prise en charge.');

const scoreSchema = z.object({
  rank: z.number().int().positive().nullable(),
  level: z.number().int().min(1).max(2_376).nullable(),
  experience: z.number().int().min(0).nullable(),
});

const snapshotSchema = z.object({
  username: z.string().trim().min(1).max(12),
  importedAt: z.number().int().positive(),
  scores: z.record(z.string(), scoreSchema),
});

export type ParseHiscoresResult =
  | { readonly success: true; readonly scores: OsrsHiscoresScores }
  | { readonly success: false; readonly error: string };

function normalizeScore(value: number): number | null {
  return value === -1 ? null : value;
}

export function parseOsrsHiscoresLite(text: string): ParseHiscoresResult {
  const rows = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (rows.length < osrsHiscoresSkills.length) {
    return {
      success: false,
      error: `La réponse contient ${rows.length} enregistrements; ${osrsHiscoresSkills.length} enregistrements HiScores sont attendus (total compris).`,
    };
  }

  const entries: [OsrsHiscoresSkillId, OsrsHiscoresScore][] = [];

  for (const [index, skill] of osrsHiscoresSkills.entries()) {
    const fields = rows[index]?.split(',');
    const row = z
      .tuple([integerTextSchema, integerTextSchema, integerTextSchema])
      .safeParse(fields);
    if (!row.success) {
      return {
        success: false,
        error: `Ligne ${index + 1} (${skill.label}) invalide : vérifie le format rank,level,XP.`,
      };
    }

    const [rank, level, experience] = row.data;
    const validRank = rank === -1 || rank > 0;
    const validLevel = level === -1 || (level >= 1 && level <= skill.maximumLevel);
    const validExperience = experience >= -1;
    if (!validRank || !validLevel || !validExperience) {
      return {
        success: false,
        error: `Valeur invalide à la ligne ${index + 1} (${skill.label}).`,
      };
    }

    const parsedScore = scoreSchema.safeParse({
      rank: normalizeScore(rank),
      level: normalizeScore(level),
      experience: normalizeScore(experience),
    });
    if (!parsedScore.success) {
      return {
        success: false,
        error: `Le niveau ou l’expérience de ${skill.label} est hors limites.`,
      };
    }

    entries.push([skill.id, parsedScore.data]);
  }

  return { success: true, scores: Object.fromEntries(entries) as OsrsHiscoresScores };
}

export function createHiscoresSnapshot(
  username: string,
  scores: OsrsHiscoresScores,
  importedAt = Date.now(),
): OsrsHiscoresSnapshot | null {
  return validateHiscoresSnapshot({ username, scores, importedAt });
}

export function validateHiscoresSnapshot(value: unknown): OsrsHiscoresSnapshot | null {
  const result = snapshotSchema.safeParse(value);
  if (!result.success) return null;

  const expectedIds = osrsHiscoresSkills.map(({ id }) => id).sort();
  const savedIds = Object.keys(result.data.scores).sort();
  if (
    expectedIds.length !== savedIds.length ||
    expectedIds.some((id, index) => id !== savedIds[index])
  ) {
    return null;
  }

  for (const skill of osrsHiscoresSkills) {
    const score = result.data.scores[skill.id];
    if (!score || (score.level !== null && score.level > skill.maximumLevel)) return null;
  }

  return result.data as OsrsHiscoresSnapshot;
}

export function hiscoresLevelsForSkilling(
  snapshot: OsrsHiscoresSnapshot,
  currentLevels: Readonly<Record<string, number>>,
): Record<string, number> {
  const levels = { ...currentLevels };
  for (const skill of osrsHiscoresSkills) {
    if (!('skillingSkill' in skill)) continue;
    const level = snapshot.scores[skill.id]?.level;
    if (level !== null && level !== undefined) levels[skill.skillingSkill] = level;
  }
  return levels;
}
