import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_OSRS_WIKI_MAPPING_CACHE_TTL_MS,
  DEFAULT_OSRS_WIKI_PRICES_BASE_URL,
  DEFAULT_OSRS_WIKI_PRICES_CACHE_TTL_MS,
  DEFAULT_OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS,
  DEFAULT_OSRS_WIKI_PRICES_USER_AGENT,
  OSRS_PRICES_FETCH,
} from './osrs-prices.constants';
import type {
  OsrsItemMapping,
  OsrsLatestPrice,
  OsrsMarketItem,
  OsrsPricesFetch,
} from './osrs-prices.types';

type CacheEntry<T> = {
  readonly expiresAt: number;
  readonly value: T;
};

type LatestPricesResponse = {
  readonly data: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isNullableNonNegativeSafeInteger = (
  value: unknown,
): value is number | null => value === null || isNonNegativeSafeInteger(value);

const isNullablePositiveSafeInteger = (
  value: unknown,
): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);

const isLatestPrice = (value: unknown): value is OsrsLatestPrice =>
  isRecord(value) &&
  isNullableNonNegativeSafeInteger(value.high) &&
  isNullablePositiveSafeInteger(value.highTime) &&
  isNullableNonNegativeSafeInteger(value.low) &&
  isNullablePositiveSafeInteger(value.lowTime);

const isItemMapping = (value: unknown): value is OsrsItemMapping =>
  isRecord(value) &&
  typeof value.id === 'number' &&
  Number.isSafeInteger(value.id) &&
  value.id > 0 &&
  isNullableNonNegativeSafeInteger(value.limit) &&
  typeof value.members === 'boolean' &&
  typeof value.name === 'string' &&
  value.name.trim().length > 0;

@Injectable()
export class OsrsPricesService {
  private readonly baseUrl: string;
  private readonly mappingCacheTtlMs: number;
  private mappingCache: CacheEntry<readonly OsrsItemMapping[]> | undefined;
  private mappingRequest: Promise<readonly OsrsItemMapping[]> | undefined;
  private readonly pricesCacheTtlMs: number;
  private readonly requestTimeoutMs: number;
  private latestPricesCache:
    CacheEntry<ReadonlyMap<number, OsrsLatestPrice>> | undefined;
  private latestPricesRequest:
    Promise<ReadonlyMap<number, OsrsLatestPrice>> | undefined;
  private readonly userAgent: string;

  constructor(
    configService: ConfigService,
    @Inject(OSRS_PRICES_FETCH) private readonly fetch: OsrsPricesFetch,
  ) {
    this.baseUrl = this.getBaseUrl(
      configService.get<string>('OSRS_WIKI_PRICES_BASE_URL'),
    );
    this.userAgent = this.getUserAgent(
      configService.get<string>('OSRS_WIKI_PRICES_USER_AGENT'),
    );
    this.pricesCacheTtlMs = this.getCacheTtlMs(
      configService.get<string>('OSRS_WIKI_PRICES_CACHE_TTL_MS'),
      'OSRS_WIKI_PRICES_CACHE_TTL_MS',
      DEFAULT_OSRS_WIKI_PRICES_CACHE_TTL_MS,
    );
    this.mappingCacheTtlMs = this.getCacheTtlMs(
      configService.get<string>('OSRS_WIKI_MAPPING_CACHE_TTL_MS'),
      'OSRS_WIKI_MAPPING_CACHE_TTL_MS',
      DEFAULT_OSRS_WIKI_MAPPING_CACHE_TTL_MS,
    );
    this.requestTimeoutMs = this.getPositiveInteger(
      configService.get<string>('OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS'),
      'OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS',
      DEFAULT_OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS,
    );
  }

  async getLatestPrice(itemId: number): Promise<OsrsLatestPrice | null> {
    return (await this.getCachedLatestPrices()).get(itemId) ?? null;
  }

  async getLatestPrices(): Promise<ReadonlyMap<number, OsrsLatestPrice>> {
    return new Map(await this.getCachedLatestPrices());
  }

  private async getCachedLatestPrices(): Promise<
    ReadonlyMap<number, OsrsLatestPrice>
  > {
    if (this.isFresh(this.latestPricesCache)) {
      return this.latestPricesCache.value;
    }

    if (!this.latestPricesRequest) {
      this.latestPricesRequest = this.loadLatestPrices().finally(() => {
        this.latestPricesRequest = undefined;
      });
    }

    return this.latestPricesRequest;
  }

  async getMarketItem(itemId: number): Promise<OsrsMarketItem | null> {
    const item = (await this.getItemMappings()).find(
      (candidate) => candidate.id === itemId,
    );

    if (!item) {
      return null;
    }

    return {
      item,
      latestPrice: await this.getLatestPrice(itemId),
    };
  }

  async getMarketItems(): Promise<readonly OsrsMarketItem[]> {
    const [items, prices] = await Promise.all([
      this.getItemMappings(),
      this.getCachedLatestPrices(),
    ]);

    return items.map((item) => ({
      item,
      latestPrice: prices.get(item.id) ?? null,
    }));
  }

  async findItemsByName(
    query: string,
    maximumResults = 25,
  ): Promise<readonly OsrsItemMapping[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery || maximumResults <= 0) {
      return [];
    }

    return (await this.getItemMappings())
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftExact = left.name.toLocaleLowerCase() === normalizedQuery;
        const rightExact = right.name.toLocaleLowerCase() === normalizedQuery;

        if (leftExact !== rightExact) {
          return leftExact ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, maximumResults);
  }

  private async getItemMappings(): Promise<readonly OsrsItemMapping[]> {
    if (this.isFresh(this.mappingCache)) {
      return this.mappingCache.value;
    }

    if (!this.mappingRequest) {
      this.mappingRequest = this.loadItemMappings().finally(() => {
        this.mappingRequest = undefined;
      });
    }

    return this.mappingRequest;
  }

  private getBaseUrl(configuredBaseUrl: string | undefined): string {
    const baseUrl =
      configuredBaseUrl?.trim() || DEFAULT_OSRS_WIKI_PRICES_BASE_URL;

    try {
      const parsedUrl = new URL(baseUrl);

      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTPS endpoints are supported.');
      }
    } catch {
      throw new InternalServerErrorException(
        'OSRS_WIKI_PRICES_BASE_URL doit etre une URL HTTPS valide.',
      );
    }

    return baseUrl.replace(/\/+$/, '');
  }

  private getCacheTtlMs(
    configuredTtl: string | undefined,
    configurationKey: string,
    defaultTtl: number,
  ): number {
    if (!configuredTtl?.trim()) {
      return defaultTtl;
    }

    const ttl = Number(configuredTtl);

    if (!Number.isSafeInteger(ttl) || ttl < 0) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre un nombre entier positif ou nul.`,
      );
    }

    return ttl;
  }

  private getUserAgent(configuredUserAgent: string | undefined): string {
    return configuredUserAgent?.trim() || DEFAULT_OSRS_WIKI_PRICES_USER_AGENT;
  }

  private getPositiveInteger(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: number,
  ): number {
    const value = this.getCacheTtlMs(
      configuredValue,
      configurationKey,
      defaultValue,
    );

    if (value === 0) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre strictement positif.`,
      );
    }

    return value;
  }

  private isFresh<T>(cache: CacheEntry<T> | undefined): cache is CacheEntry<T> {
    return cache !== undefined && cache.expiresAt > Date.now();
  }

  private async loadItemMappings(): Promise<readonly OsrsItemMapping[]> {
    const payload = await this.getJson('mapping');

    if (!Array.isArray(payload)) {
      throw new BadGatewayException(
        "L'API de prix OSRS a renvoye une liste d'objets invalide.",
      );
    }

    const items = Object.freeze(
      payload.filter(isItemMapping).map((item) => Object.freeze({ ...item })),
    );

    if (items.length === 0) {
      throw new BadGatewayException(
        "L'API de prix OSRS n'a renvoye aucun objet exploitable.",
      );
    }

    this.mappingCache = {
      expiresAt: Date.now() + this.mappingCacheTtlMs,
      value: items,
    };

    return items;
  }

  private async loadLatestPrices(): Promise<
    ReadonlyMap<number, OsrsLatestPrice>
  > {
    const payload = await this.getJson('latest');

    if (!this.isLatestPricesResponse(payload)) {
      throw new BadGatewayException(
        "L'API de prix OSRS a renvoye des prix invalides.",
      );
    }

    const prices = new Map<number, OsrsLatestPrice>();

    for (const [rawItemId, rawPrice] of Object.entries(payload.data)) {
      const itemId = Number(rawItemId);

      if (Number.isInteger(itemId) && itemId > 0 && isLatestPrice(rawPrice)) {
        prices.set(itemId, Object.freeze({ ...rawPrice }));
      }
    }

    if (Object.keys(payload.data).length > 0 && prices.size === 0) {
      throw new BadGatewayException(
        "L'API de prix OSRS n'a renvoye aucune cotation exploitable.",
      );
    }

    this.latestPricesCache = {
      expiresAt: Date.now() + this.pricesCacheTtlMs,
      value: prices,
    };

    return prices;
  }

  private async getJson(path: 'latest' | 'mapping'): Promise<unknown> {
    const controller = new AbortController();
    const timeoutError = new Error('OSRS price request timed out.');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(timeoutError);
        controller.abort();
      }, this.requestTimeoutMs);
    });

    try {
      const response = await Promise.race([
        this.fetch(`${this.baseUrl}/${path}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `L'API de prix OSRS a repondu avec le statut ${response.status}.`,
        );
      }

      try {
        return await Promise.race([response.json(), timeoutPromise]);
      } catch (error) {
        if (error === timeoutError) {
          throw error;
        }

        throw new BadGatewayException(
          "L'API de prix OSRS a renvoye une reponse JSON invalide.",
        );
      }
    } catch (error) {
      if (error === timeoutError) {
        throw new ServiceUnavailableException(
          "L'API de prix OSRS n'a pas repondu dans le delai imparti.",
        );
      }

      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        "Impossible de joindre l'API de prix OSRS.",
      );
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private isLatestPricesResponse(
    payload: unknown,
  ): payload is LatestPricesResponse {
    return isRecord(payload) && isRecord(payload.data);
  }
}
