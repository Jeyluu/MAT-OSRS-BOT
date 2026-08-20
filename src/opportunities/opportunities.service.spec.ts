import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OsrsPricesService } from '../osrs-prices/osrs-prices.service';
import type { OsrsMarketItem } from '../osrs-prices/osrs-prices.types';
import { OpportunitiesService } from './opportunities.service';

type OpportunitiesConfiguration = Partial<
  Record<
    | 'OPPORTUNITIES_GE_TAX_CAP'
    | 'OPPORTUNITIES_GE_TAX_EXEMPT_ITEM_IDS'
    | 'OPPORTUNITIES_GE_TAX_RATE'
    | 'OPPORTUNITIES_INCLUDE_MEMBERS'
    | 'OPPORTUNITIES_MAX_PRICE_AGE_MS'
    | 'OPPORTUNITIES_MAX_RESULTS'
    | 'OPPORTUNITIES_MIN_BUY_LIMIT'
    | 'OPPORTUNITIES_MIN_BUY_PRICE'
    | 'OPPORTUNITIES_MIN_PROFIT_PER_ITEM'
    | 'OPPORTUNITIES_MIN_ROI_PERCENT',
    string
  >
>;

const now = 1_700_000_000_000;

const createMarketItem = (
  id: number,
  overrides: Partial<OsrsMarketItem> = {},
): OsrsMarketItem => ({
  item: {
    id,
    limit: 100,
    members: false,
    name: `Item ${id}`,
  },
  latestPrice: {
    high: 12_000,
    highTime: now / 1_000,
    low: 10_000,
    lowTime: now / 1_000,
  },
  ...overrides,
});

describe('OpportunitiesService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createService = (configuration: OpportunitiesConfiguration = {}) => {
    const values: OpportunitiesConfiguration = {
      OPPORTUNITIES_GE_TAX_CAP: '5000000',
      OPPORTUNITIES_GE_TAX_RATE: '0.02',
      OPPORTUNITIES_INCLUDE_MEMBERS: 'false',
      OPPORTUNITIES_MAX_PRICE_AGE_MS: '60000',
      OPPORTUNITIES_MAX_RESULTS: '2',
      OPPORTUNITIES_MIN_BUY_LIMIT: '1',
      OPPORTUNITIES_MIN_BUY_PRICE: '1000',
      OPPORTUNITIES_MIN_PROFIT_PER_ITEM: '1000',
      OPPORTUNITIES_MIN_ROI_PERCENT: '2',
      ...configuration,
    };
    const configService = {
      get: jest.fn<string | undefined, [string]>(
        (key) => values[key as keyof OpportunitiesConfiguration],
      ),
    } as unknown as ConfigService;
    const getMarketItems = jest.fn<Promise<readonly OsrsMarketItem[]>, []>();
    const osrsPricesService = {
      getMarketItems,
    } as unknown as OsrsPricesService;

    return {
      getMarketItems,
      service: new OpportunitiesService(osrsPricesService, configService),
    };
  };

  it('filters stale, member-only, and weak opportunities then sorts by buy-limit profit', async () => {
    const { getMarketItems, service } = createService();
    getMarketItems.mockResolvedValue([
      createMarketItem(1),
      createMarketItem(2, {
        item: { id: 2, limit: 10, members: false, name: 'Higher unit profit' },
        latestPrice: {
          high: 60_000,
          highTime: now / 1_000,
          low: 50_000,
          lowTime: now / 1_000,
        },
      }),
      createMarketItem(3, {
        latestPrice: {
          high: 12_000,
          highTime: now / 1_000 - 61,
          low: 10_000,
          lowTime: now / 1_000 - 61,
        },
      }),
      createMarketItem(4, {
        item: { id: 4, limit: 100, members: true, name: 'Members item' },
      }),
      createMarketItem(5, {
        latestPrice: {
          high: 700,
          highTime: now / 1_000,
          low: 500,
          lowTime: now / 1_000,
        },
      }),
    ]);

    const opportunities = await service.getOpportunities();

    expect(opportunities.map((opportunity) => opportunity.item.id)).toEqual([
      1, 2,
    ]);
    expect(opportunities[0]).toMatchObject({
      estimatedProfitAtBuyLimit: 176_000,
      profitPerItem: 1_760,
    });
  });

  it('uses configured tax exemptions by item ID', async () => {
    const { getMarketItems, service } = createService({
      OPPORTUNITIES_GE_TAX_EXEMPT_ITEM_IDS: '5000',
    });
    getMarketItems.mockResolvedValue([createMarketItem(5000)]);

    await expect(service.getOpportunities()).resolves.toMatchObject([
      { geTaxPerItem: 0, profitPerItem: 2_000 },
    ]);
  });

  it('rejects opportunities with quote timestamps in the future', async () => {
    const { getMarketItems, service } = createService();
    getMarketItems.mockResolvedValue([
      createMarketItem(1, {
        latestPrice: {
          high: 12_000,
          highTime: now / 1_000 + 1,
          low: 10_000,
          lowTime: now / 1_000 + 1,
        },
      }),
    ]);

    await expect(service.getOpportunities()).resolves.toEqual([]);
  });

  it('rejects invalid opportunity configuration', () => {
    expect(() => createService({ OPPORTUNITIES_MAX_RESULTS: '1.5' })).toThrow(
      InternalServerErrorException,
    );
  });
});
