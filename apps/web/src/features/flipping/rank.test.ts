import type { MerchStrategy, OsrsMarketHistoryPoint, OsrsMarketItem } from '@osrs-helper/core';
import {
  calculateGeTaxPerItem,
  calculateMerchOpportunity,
  calculateMerchVolatilityPercent,
  DEFAULT_GE_TAX_POLICY,
  rankMerchOpportunities,
} from '@osrs-helper/core';
import { expect, test } from 'vitest';

const nowMs = 1_800_000_000_000;
const nowSeconds = nowMs / 1_000;

function createHistory(
  basePrice: number,
  options: { readonly count?: number; readonly swing?: number; readonly volume?: number } = {},
): OsrsMarketHistoryPoint[] {
  const count = options.count ?? 16;
  const swing = options.swing ?? 0;
  const volume = options.volume ?? 100;
  return Array.from({ length: count }, (_, index) => {
    const fluctuation = index % 2 === 0 ? -swing : swing;
    return {
      timestamp: nowSeconds - (count - index - 1) * 300,
      avgHighPrice: basePrice * (1 + fluctuation) + 1,
      avgLowPrice: basePrice * (1 + fluctuation) - 1,
      highPriceVolume: volume,
      lowPriceVolume: volume,
    };
  });
}

function createItem({
  id = 561,
  name = 'Nature rune',
  buy = 100,
  sell = 112,
  limit = 100,
  volume = 100,
  swing = 0,
  ageSeconds = 60,
  history = true,
}: {
  readonly id?: number;
  readonly name?: string;
  readonly buy?: number;
  readonly sell?: number;
  readonly limit?: number | null;
  readonly volume?: number;
  readonly swing?: number;
  readonly ageSeconds?: number;
  readonly history?: boolean;
} = {}): OsrsMarketItem {
  return {
    item: { id, name, members: false, limit },
    latestPrice: {
      high: sell,
      highTime: nowSeconds - ageSeconds,
      low: buy,
      lowTime: nowSeconds - ageSeconds,
    },
    fiveMinutePrice: {
      avgHighPrice: sell,
      avgLowPrice: buy,
      highPriceVolume: volume,
      lowPriceVolume: volume,
    },
    history: history ? createHistory((buy + sell) / 2, { volume, swing }) : null,
  };
}

test('applique exemptions, arrondi inférieur et plafond de taxe GE', () => {
  expect(calculateGeTaxPerItem(315, 1_000)).toBe(0);
  expect(calculateGeTaxPerItem(561, 49)).toBe(0);
  expect(calculateGeTaxPerItem(561, 199)).toBe(3);
  expect(calculateGeTaxPerItem(561, 300_000_000)).toBe(5_000_000);
  expect(DEFAULT_GE_TAX_POLICY.rate).toBe(0.02);
});

test('calcule le profit net et le ROI après taxe', () => {
  const opportunity = calculateMerchOpportunity(
    createItem({ buy: 100, sell: 110 }),
    DEFAULT_GE_TAX_POLICY,
  );
  expect(opportunity).toMatchObject({
    geTaxPerItem: 2,
    netSellPrice: 108,
    profitPerItem: 8,
    roiPercent: 8,
  });
});

test('calcule quantité achetable, limite GE et profit total', () => {
  const ranked = rankMerchOpportunities([createItem({ buy: 100, sell: 110, limit: 6 })], {
    capitalGp: 1_000,
    strategy: 'Équilibrée',
    nowMs,
  });
  expect(ranked[0]).toMatchObject({
    quantity: 6,
    capitalRequired: 600,
    estimatedTotalProfit: 48,
  });

  const unrestricted = rankMerchOpportunities([createItem({ buy: 100, sell: 110, limit: 2_000 })], {
    capitalGp: 1_000,
    strategy: 'Équilibrée',
    nowMs,
  });
  expect(unrestricted[0]?.quantity).toBe(10);
});

test('mesure la volatilité seulement quand les points sont assez nombreux', () => {
  expect(calculateMerchVolatilityPercent(createHistory(100))).toBeCloseTo(0);
  expect(calculateMerchVolatilityPercent(createHistory(100, { count: 6 }))).toBeNull();
  expect(calculateMerchVolatilityPercent(createHistory(100, { swing: 0.05 }))).toBeGreaterThan(0);
});

test('rejette les cotations périmées et ne classe pas sans capital', () => {
  const stale = createItem({ ageSeconds: 16 * 60 });
  expect(
    rankMerchOpportunities([stale], { capitalGp: 1_000, strategy: 'Équilibrée', nowMs }),
  ).toHaveLength(0);
  expect(
    rankMerchOpportunities([createItem()], { capitalGp: 0, strategy: 'Équilibrée', nowMs }),
  ).toHaveLength(0);
  expect(
    rankMerchOpportunities([createItem({ history: false })], {
      capitalGp: 1_000,
      strategy: 'Équilibrée',
      nowMs,
    }),
  ).toHaveLength(0);
});

test('les stratégies pondèrent différemment la même opportunité', () => {
  const item = createItem({ buy: 1_000, sell: 1_500, limit: 100, volume: 10_000, swing: 0.08 });
  const scores = (['Prudente', 'Équilibrée', 'Agressive'] as const).map(
    (strategy: MerchStrategy) =>
      rankMerchOpportunities([item], { capitalGp: 100_000, strategy, nowMs })[0]?.score,
  );
  expect(new Set(scores).size).toBeGreaterThan(1);
});

test('les opportunités sont classées selon le profil de stratégie', () => {
  const stable = createItem({
    id: 101,
    name: 'Stable',
    buy: 100,
    sell: 112,
    limit: 1_000,
    volume: 50_000,
  });
  const volatile = createItem({
    id: 102,
    name: 'Volatile',
    buy: 1_000,
    sell: 1_600,
    limit: 1_000,
    volume: 1_000,
    swing: 0.15,
  });
  const prudent = rankMerchOpportunities([volatile, stable], {
    capitalGp: 100_000,
    strategy: 'Prudente',
    nowMs,
  });
  const aggressive = rankMerchOpportunities([stable, volatile], {
    capitalGp: 100_000,
    strategy: 'Agressive',
    nowMs,
  });
  expect(prudent[0]?.opportunity.item.name).toBe('Stable');
  expect(aggressive[0]?.opportunity.item.name).toBe('Volatile');
});
