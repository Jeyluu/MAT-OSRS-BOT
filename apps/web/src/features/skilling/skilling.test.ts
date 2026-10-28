import type { SkillingMarketQuote, SkillingMethodDefinition } from '@osrs-helper/core';
import { calculateSkillingMethod, recommendSkillingMethods } from '@osrs-helper/core';
import { expect, test } from 'vitest';
import { skillingMethods } from './skilling-catalog';

const nowMs = 1_800_000_000_000;
const nowSeconds = nowMs / 1_000;

const sampleMethod: SkillingMethodDefinition = {
  id: 'test-method',
  name: 'Test method',
  skill: 'Artisanat',
  requiredLevel: 20,
  style: 'Actif',
  description: 'Fixture for skilling calculations.',
  inputs: [{ itemId: 10, quantity: 2 }],
  outputs: [{ itemId: 11, quantity: 1 }],
  xpPerAction: 10,
  actionsPerHour: 100,
  batchActions: 3,
  requirements: [],
  steps: [],
  assumptions: [],
  sourceLabel: 'Test source',
  sourceUrl: 'https://example.com',
  isComplete: true,
};

const sampleMarket = new Map<number, SkillingMarketQuote>([
  [10, { id: 10, name: 'Input', high: 100, highTime: nowSeconds, low: 90, lowTime: nowSeconds }],
  [11, { id: 11, name: 'Output', high: 260, highTime: nowSeconds, low: 250, lowTime: nowSeconds }],
]);

test('calcule le GP/h net, XP/h et le capital d’un lot avec taxe GE', () => {
  const result = calculateSkillingMethod(sampleMethod, sampleMarket, { nowMs });

  expect(result).toMatchObject({
    status: 'complete',
    inputCostPerHour: 20_000,
    outputRevenuePerHour: 24_500,
    gpPerHour: 4_500,
    xpPerHour: 1_000,
    capitalRequired: 600,
  });
  expect(result.outputs[0]?.geTaxPerItem).toBe(5);
});

test('marque les prix périmés et les méthodes sans chiffres fiables comme incomplets', () => {
  const staleMarket = new Map(sampleMarket);
  const inputQuote = sampleMarket.get(10);
  if (!inputQuote) throw new Error('Missing input quote fixture.');
  staleMarket.set(10, { ...inputQuote, highTime: nowSeconds - 16 * 60 });
  expect(calculateSkillingMethod(sampleMethod, staleMarket, { nowMs }).gpPerHour).toBeNull();

  const runecraft = skillingMethods.find((method) => method.id === 'runecraft-double-astral');
  if (!runecraft) throw new Error('Missing incomplete Runecraft fixture.');
  expect(calculateSkillingMethod(runecraft, sampleMarket, { nowMs }).gpPerHour).toBeNull();
});

test('adapte la cadence de coupe de tecks au niveau et calcule la recette avec les prix', () => {
  const method = skillingMethods.find((entry) => entry.id === 'teak-woodcutting');
  if (!method) throw new Error('Missing woodcutting fixture.');
  const market = new Map<number, SkillingMarketQuote>([
    [
      6333,
      {
        id: 6333,
        name: 'Teak logs',
        high: 50,
        highTime: nowSeconds,
        low: 100,
        lowTime: nowSeconds,
      },
    ],
  ]);

  const level35 = calculateSkillingMethod(method, market, { nowMs, skillLevel: 35 });
  const level99 = calculateSkillingMethod(method, market, { nowMs, skillLevel: 99 });
  expect(level35.xpPerHour).toBe(34_000);
  expect(level99.xpPerHour).toBeCloseTo(93_000);
  expect(level99.gpPerHour).toBeGreaterThan(level35.gpPerHour ?? 0);
});

test('recommande uniquement les méthodes compatibles avec niveau, capital et style', () => {
  const result = calculateSkillingMethod(sampleMethod, sampleMarket, { nowMs });
  expect(
    recommendSkillingMethods([result], {
      capitalGp: 599,
      levels: { Artisanat: 99 },
      style: 'Actif',
    }),
  ).toHaveLength(0);
  expect(
    recommendSkillingMethods([result], {
      capitalGp: 600,
      levels: { Artisanat: 19 },
      style: 'Actif',
    }),
  ).toHaveLength(0);
  expect(
    recommendSkillingMethods([result], {
      capitalGp: 600,
      levels: { Artisanat: 99 },
      style: 'AFK',
    }),
  ).toHaveLength(0);
  expect(
    recommendSkillingMethods([result], {
      capitalGp: 600,
      levels: { Artisanat: 99 },
      style: 'Actif',
    }),
  ).toEqual([result]);
});
