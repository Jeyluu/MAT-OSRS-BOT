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

export interface GeTaxPolicy {
  readonly maximumPerItem: number;
  readonly rate: number;
  readonly taxExemptItemIds: ReadonlySet<number>;
}

export interface OpportunityFilters {
  readonly includeMembers: boolean;
  readonly maximumPriceAgeMs: number;
  readonly maximumResults: number;
  readonly minimumBuyLimit: number;
  readonly minimumBuyPrice: number;
  readonly minimumProfitPerItem: number;
  readonly minimumRoiPercent: number;
}

export interface MerchOpportunity {
  readonly buyLimit: number | null;
  readonly buyPrice: number;
  readonly estimatedProfitAtBuyLimit: number | null;
  readonly geTaxPerItem: number;
  readonly item: OsrsItemMapping;
  readonly netSellPrice: number;
  readonly oldestQuoteTime: number;
  readonly profitPerItem: number;
  readonly roiPercent: number;
  readonly sellPrice: number;
}
