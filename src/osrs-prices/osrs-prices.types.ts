export interface OsrsPricesFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type OsrsPricesFetch = (
  input: string,
  init?: RequestInit,
) => Promise<OsrsPricesFetchResponse>;

export interface OsrsLatestPrice {
  readonly high: number | null;
  readonly highTime: number | null;
  readonly low: number | null;
  readonly lowTime: number | null;
}

export interface OsrsItemMapping {
  readonly id: number;
  readonly limit: number | null;
  readonly members: boolean;
  readonly name: string;
}

export interface OsrsMarketItem {
  readonly item: OsrsItemMapping;
  readonly latestPrice: OsrsLatestPrice | null;
}
