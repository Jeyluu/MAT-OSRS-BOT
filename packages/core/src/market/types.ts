export interface OsrsLatestPrice {
  readonly high: number | null;
  readonly highTime: number | null;
  readonly low: number | null;
  readonly lowTime: number | null;
}

export interface OsrsMarketHistoryPoint {
  readonly timestamp: number;
  readonly avgHighPrice: number | null;
  readonly avgLowPrice: number | null;
  readonly highPriceVolume: number | null;
  readonly lowPriceVolume: number | null;
}

export interface OsrsFiveMinutePrice {
  readonly avgHighPrice: number | null;
  readonly avgLowPrice: number | null;
  readonly highPriceVolume: number | null;
  readonly lowPriceVolume: number | null;
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
  readonly fiveMinutePrice?: OsrsFiveMinutePrice | null;
  readonly history?: readonly OsrsMarketHistoryPoint[] | null;
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

export type MerchStrategy = 'Prudente' | 'Équilibrée' | 'Agressive';
export type MerchRiskLevel = 'Faible' | 'Modéré' | 'Élevé';

export interface MerchScoreComponents {
  readonly profit: number;
  readonly roi: number;
  readonly liquidity: number;
  readonly stability: number;
  readonly freshness: number;
  readonly capitalUse: number;
}

export interface RankedMerchOpportunity {
  readonly opportunity: MerchOpportunity;
  readonly quantity: number;
  readonly estimatedTotalProfit: number;
  readonly capitalRequired: number;
  readonly capitalUsePercent: number;
  readonly volume6h: number;
  readonly liquidityScore: number;
  readonly volatilityPercent: number | null;
  readonly riskScore: number;
  readonly riskLevel: MerchRiskLevel;
  readonly freshnessScore: number;
  readonly score: number;
  readonly scoreComponents: MerchScoreComponents;
  readonly history: readonly OsrsMarketHistoryPoint[];
}
