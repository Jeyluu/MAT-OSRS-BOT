export interface OsrsPricesFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type OsrsPricesFetch = (
  input: string,
  init?: RequestInit,
) => Promise<OsrsPricesFetchResponse>;

export type {
  OsrsItemMapping,
  OsrsLatestPrice,
  OsrsMarketItem,
} from '@osrs-helper/core';
