import type { OsrsMarketItem } from '../osrs-prices/osrs-prices.types';
import { calculateMerchOpportunity } from './opportunities.calculator';
import type { GeTaxPolicy } from './opportunities.types';

const taxPolicy: GeTaxPolicy = {
  maximumPerItem: 5_000_000,
  rate: 0.02,
  taxExemptItemIds: new Set(),
};

const createMarketItem = (
  overrides: Partial<OsrsMarketItem> = {},
): OsrsMarketItem => ({
  item: {
    id: 4151,
    limit: 70,
    members: true,
    name: 'Abyssal whip',
  },
  latestPrice: {
    high: 1_600_000,
    highTime: 1_700_000_000,
    low: 1_480_000,
    lowTime: 1_700_000_100,
  },
  ...overrides,
});

describe('calculateMerchOpportunity', () => {
  it('calculates a net profit after the per-item GE tax', () => {
    const opportunity = calculateMerchOpportunity(
      createMarketItem(),
      taxPolicy,
    );

    expect(opportunity).toMatchObject({
      buyLimit: 70,
      buyPrice: 1_480_000,
      estimatedProfitAtBuyLimit: 6_160_000,
      geTaxPerItem: 32_000,
      netSellPrice: 1_568_000,
      oldestQuoteTime: 1_700_000_000_000,
      profitPerItem: 88_000,
      sellPrice: 1_600_000,
    });
    expect(opportunity?.roiPercent).toBeCloseTo(5.9459, 4);
  });

  it('caps the GE tax for very expensive items', () => {
    const opportunity = calculateMerchOpportunity(
      createMarketItem({
        item: {
          id: 2,
          limit: 8,
          members: true,
          name: 'Twisted bow',
        },
        latestPrice: {
          high: 500_000_000,
          highTime: 1_700_000_000,
          low: 450_000_000,
          lowTime: 1_700_000_100,
        },
      }),
      taxPolicy,
    );

    expect(opportunity).toMatchObject({
      geTaxPerItem: 5_000_000,
      profitPerItem: 45_000_000,
    });
  });

  it('does not apply tax to configured tax-exempt items', () => {
    const opportunity = calculateMerchOpportunity(createMarketItem(), {
      ...taxPolicy,
      taxExemptItemIds: new Set([4151]),
    });

    expect(opportunity).toMatchObject({
      geTaxPerItem: 0,
      profitPerItem: 120_000,
    });
  });

  it('rejects incomplete or invalid quotes', () => {
    expect(
      calculateMerchOpportunity(
        createMarketItem({
          latestPrice: {
            high: null,
            highTime: null,
            low: 1_480_000,
            lowTime: 1_700_000_100,
          },
        }),
        taxPolicy,
      ),
    ).toBeNull();
  });
});
