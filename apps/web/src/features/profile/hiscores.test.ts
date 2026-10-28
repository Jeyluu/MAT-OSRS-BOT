import { expect, test } from 'vitest';
import {
  createHiscoresSnapshot,
  hiscoresLevelsForSkilling,
  osrsHiscoresSkills,
  parseOsrsHiscoresLite,
} from './hiscores';

function makeHiscoresCsv() {
  return osrsHiscoresSkills
    .map((skill, index) => {
      if (skill.id === 'overall') return '1,2278,4600000000';
      if (skill.id === 'cooking') return '-1,-1,-1';
      return `${index + 1},${skill.maximumLevel},${index * 10_000}`;
    })
    .join('\r\n');
}

test('parse les lignes de compétences HiScores et ignore les données d’activités', () => {
  const result = parseOsrsHiscoresLite(`\uFEFF${makeHiscoresCsv()}\r\n1,42`);

  expect(result.success).toBe(true);
  if (!result.success) return;
  expect(result.scores.overall).toEqual({ rank: 1, level: 2_278, experience: 4_600_000_000 });
  expect(result.scores.cooking).toEqual({ rank: null, level: null, experience: null });
  expect(result.scores.runecraft.level).toBe(99);
  expect(result.scores.sailing).toEqual({ rank: 25, level: 99, experience: 240_000 });
});

test('rejette les réponses tronquées et les niveaux hors limites', () => {
  expect(parseOsrsHiscoresLite('1,99,100').success).toBe(false);

  const invalid = makeHiscoresCsv().split('\r\n');
  invalid[8] = '1,100,1000';
  const result = parseOsrsHiscoresLite(invalid.join('\n'));
  expect(result).toMatchObject({ success: false, error: expect.stringContaining('Cuisine') });
});

test('applique les niveaux classés au Skilling et préserve les niveaux non classés', () => {
  const parsed = parseOsrsHiscoresLite(makeHiscoresCsv());
  if (!parsed.success) throw new Error(parsed.error);
  const snapshot = createHiscoresSnapshot('Test joueur', parsed.scores, 1_800_000_000_000);
  if (!snapshot) throw new Error('Could not create a HiScores fixture.');

  const levels = hiscoresLevelsForSkilling(snapshot, {
    Cuisine: 67,
    'Coupe de bois': 1,
    Artisanat: 42,
  });

  expect(levels.Cuisine).toBe(67);
  expect(levels['Coupe de bois']).toBe(99);
  expect(levels.Artisanat).toBe(99);
  expect(levels.Runecraft).toBe(99);
});
