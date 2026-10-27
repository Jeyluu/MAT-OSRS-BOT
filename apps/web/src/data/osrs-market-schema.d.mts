import type { z } from 'zod';

export interface LatestPrice {
  high?: number | null;
  highTime?: number | null;
  low?: number | null;
  lowTime?: number | null;
}

export interface ItemMapping {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  limit?: number | null;
}

export interface FiveMinutePrice {
  avgHighPrice?: number | null;
  avgLowPrice?: number | null;
  highPriceVolume?: number | null;
  lowPriceVolume?: number | null;
}

export interface OsrsMarketItem {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  buyLimit: number | null;
  high: number | null | undefined;
  highTime: number | null | undefined;
  low: number | null | undefined;
  lowTime: number | null | undefined;
  avgHighPrice: number | null | undefined;
  avgLowPrice: number | null | undefined;
  highPriceVolume: number | null | undefined;
  lowPriceVolume: number | null | undefined;
}

export interface OsrsMarketSnapshot {
  schemaVersion: 1;
  source: 'OSRS Wiki Real-time Prices API';
  sourceUrl: 'https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices';
  generatedAt: string | null;
  latestAsOf: number | null;
  fiveMinuteTimestamp: number | null;
  mappingItemCount: number;
  quotedItemCount: number;
  items: OsrsMarketItem[];
}

export declare const latestPricesResponseSchema: z.ZodType<{
  data: Record<string, LatestPrice>;
}>;
export declare const itemMappingResponseSchema: z.ZodType<ItemMapping[]>;
export declare const fiveMinutePricesResponseSchema: z.ZodType<{
  timestamp: number;
  data: Record<string, FiveMinutePrice>;
}>;
export declare const osrsMarketSnapshotSchema: z.ZodType<OsrsMarketSnapshot>;
