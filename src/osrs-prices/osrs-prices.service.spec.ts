import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OsrsPricesService } from './osrs-prices.service';
import type {
  OsrsPricesFetch,
  OsrsPricesFetchResponse,
} from './osrs-prices.types';

type OsrsPricesConfiguration = Partial<
  Record<
    | 'OSRS_WIKI_MAPPING_CACHE_TTL_MS'
    | 'OSRS_WIKI_PRICES_BASE_URL'
    | 'OSRS_WIKI_PRICES_CACHE_TTL_MS'
    | 'OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS'
    | 'OSRS_WIKI_PRICES_USER_AGENT',
    string
  >
>;

const baseUrl = 'https://prices.example.test/api/v1/osrs';
const userAgent = 'MAT-OSRS-BOT test suite';

const itemMappings = [
  { id: 4151, limit: 70, members: true, name: 'Abyssal whip' },
  { id: 556, limit: 18_000, members: false, name: 'Air rune' },
];
const latestPrices = {
  data: {
    '4151': {
      high: 1_500_000,
      highTime: 1_700_000_000,
      low: 1_480_000,
      lowTime: 1_700_000_100,
    },
    '556': {
      high: 5,
      highTime: 1_700_000_000,
      low: 4,
      lowTime: 1_700_000_100,
    },
  },
};

const createResponse = (
  payload: unknown,
  options: { ok?: boolean; status?: number } = {},
): OsrsPricesFetchResponse => ({
  json: jest.fn<Promise<unknown>, []>().mockResolvedValue(payload),
  ok: options.ok ?? true,
  status: options.status ?? 200,
});

describe('OsrsPricesService', () => {
  const createService = (configuration: OsrsPricesConfiguration = {}) => {
    const configService = {
      get: jest.fn<string | undefined, [string]>((key) => {
        const values: OsrsPricesConfiguration = {
          OSRS_WIKI_PRICES_BASE_URL: baseUrl,
          OSRS_WIKI_PRICES_USER_AGENT: userAgent,
          ...configuration,
        };

        return values[key as keyof OsrsPricesConfiguration];
      }),
    } as unknown as ConfigService;
    const fetch = jest.fn<
      Promise<OsrsPricesFetchResponse>,
      [string, RequestInit?]
    >();

    return {
      fetch,
      service: new OsrsPricesService(configService, fetch as OsrsPricesFetch),
    };
  };

  it('returns a mapped item with its latest price', async () => {
    const { fetch, service } = createService();
    fetch
      .mockResolvedValueOnce(createResponse(itemMappings))
      .mockResolvedValueOnce(createResponse(latestPrices));

    await expect(service.getMarketItem(4151)).resolves.toEqual({
      item: itemMappings[0],
      latestPrice: latestPrices.data['4151'],
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/mapping`,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/latest`,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
      }),
    );
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeDefined();
    expect(fetch.mock.calls[1]?.[1]?.signal).toBeDefined();
  });

  it('returns null when an item is not known by the mapping', async () => {
    const { fetch, service } = createService();
    fetch.mockResolvedValueOnce(createResponse(itemMappings));

    await expect(service.getMarketItem(999_999)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('caches bulk mapping and price requests', async () => {
    const { fetch, service } = createService();
    fetch
      .mockResolvedValueOnce(createResponse(itemMappings))
      .mockResolvedValueOnce(createResponse(latestPrices));

    await service.getMarketItems();
    await service.getMarketItems();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares simultaneous bulk price requests', async () => {
    const { fetch, service } = createService();
    fetch.mockResolvedValue(createResponse(latestPrices));

    await Promise.all([service.getLatestPrices(), service.getLatestPrices()]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the prices API is unavailable', async () => {
    const { fetch, service } = createService();
    fetch
      .mockResolvedValueOnce(createResponse(itemMappings))
      .mockResolvedValueOnce(createResponse({}, { ok: false, status: 503 }));

    await expect(service.getMarketItem(4151)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects a malformed latest-price payload', async () => {
    const { fetch, service } = createService();
    fetch.mockResolvedValueOnce(createResponse({ items: {} }));

    await expect(service.getLatestPrices()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects a non-empty latest-price payload with no usable quote', async () => {
    const { fetch, service } = createService();
    fetch.mockResolvedValueOnce(
      createResponse({ data: { '4151': 'invalid' } }),
    );

    await expect(service.getLatestPrices()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('times out a pending request and releases the shared request', async () => {
    jest.useFakeTimers();

    try {
      const { fetch, service } = createService({
        OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS: '100',
      });
      fetch.mockImplementation(
        (_url, init) =>
          new Promise<OsrsPricesFetchResponse>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('request aborted')),
            );
          }),
      );

      const pendingRequest = service.getLatestPrices();
      jest.advanceTimersByTime(100);

      await expect(pendingRequest).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      fetch.mockResolvedValueOnce(createResponse(latestPrices));

      await expect(service.getLatestPrices()).resolves.toEqual(
        new Map(
          Object.entries(latestPrices.data).map(([id, price]) => [
            Number(id),
            price,
          ]),
        ),
      );
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
