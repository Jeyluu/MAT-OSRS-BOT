import { expect, test } from 'vitest';
import {
  fiveMinutePricesResponseSchema,
  itemMappingResponseSchema,
  latestPricesResponseSchema,
  osrsMarketSnapshotSchema,
  timeseriesResponseSchema,
} from './osrs-market-schema.mjs';

test('valide les dernières transactions et accepte les cotations absentes', () => {
  const result = latestPricesResponseSchema.parse({
    data: {
      '561': { high: 115, highTime: 1_793_125_200, low: 108, lowTime: 1_793_125_140 },
      '562': { high: null, highTime: null, low: 2, lowTime: 1_793_125_100 },
    },
  });

  expect(result.data['562']?.high).toBeNull();
});

test('rejette une cotation latest dont le prix n’est pas numérique', () => {
  const result = latestPricesResponseSchema.safeParse({
    data: { '561': { high: '115', highTime: 1_793_125_200, low: 108, lowTime: 1_793_125_140 } },
  });

  expect(result.success).toBe(false);
});

test('valide les métadonnées des items et les agrégats 5 minutes', () => {
  const mapping = itemMappingResponseSchema.parse([
    { id: 561, name: 'Nature rune', icon: 'Nature rune.png', members: false, limit: 18_000 },
  ]);
  const aggregate = fiveMinutePricesResponseSchema.parse({
    timestamp: 1_793_125_200,
    data: {
      '561': {
        avgHighPrice: 113.5,
        avgLowPrice: 109,
        highPriceVolume: 12,
        lowPriceVolume: 9,
      },
    },
  });

  expect(mapping[0]?.name).toBe('Nature rune');
  expect(aggregate.data['561']?.avgHighPrice).toBe(113.5);
});

test('valide l’historique OSRS Wiki avec ses volumes et son intervalle', () => {
  const result = timeseriesResponseSchema.parse({
    itemId: 561,
    startTimestamp: 1_793_123_400,
    endTimestamp: 1_793_125_200,
    timestep: 300,
    data: [
      {
        timestamp: 1_793_125_200,
        avgHighPrice: 113.5,
        avgLowPrice: 109,
        highPriceVolume: 12,
        lowPriceVolume: 9,
      },
    ],
  });
  expect(result.data).toHaveLength(1);
});

test('valide le format publié de l’instantané statique', () => {
  const result = osrsMarketSnapshotSchema.parse({
    schemaVersion: 2,
    source: 'OSRS Wiki Real-time Prices API',
    sourceUrl: 'https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices',
    generatedAt: '2026-10-27T18:00:00.000Z',
    latestAsOf: 1_793_125_200,
    fiveMinuteTimestamp: 1_793_125_200,
    mappingItemCount: 0,
    quotedItemCount: 0,
    items: [],
  });

  expect(result.schemaVersion).toBe(2);
});
