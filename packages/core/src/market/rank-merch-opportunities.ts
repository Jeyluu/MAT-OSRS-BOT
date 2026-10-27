import { calculateMerchOpportunity } from './calculate-merch-opportunity';
import { DEFAULT_GE_TAX_POLICY } from './tax-policy';
import type {
  GeTaxPolicy,
  MerchRiskLevel,
  MerchScoreComponents,
  MerchStrategy,
  OsrsMarketHistoryPoint,
  OsrsMarketItem,
  RankedMerchOpportunity,
} from './types';

const FIVE_MINUTES_MS = 5 * 60_000;
const SIX_HOURS_SECONDS = 6 * 60 * 60;
const MINIMUM_VOLATILITY_RETURNS = 12;
const VOLATILITY_LIMIT_PERCENT = 10;
const PROFIT_SCORE_REFERENCE_GP = 10_000_000;
const ROI_SCORE_REFERENCE_PERCENT = 20;

const strategyWeights: Record<MerchStrategy, MerchScoreComponents> = {
  Prudente: {
    profit: 0.1,
    roi: 0.05,
    liquidity: 0.25,
    stability: 0.3,
    freshness: 0.2,
    capitalUse: 0.1,
  },
  Équilibrée: {
    profit: 0.2,
    roi: 0.15,
    liquidity: 0.2,
    stability: 0.15,
    freshness: 0.15,
    capitalUse: 0.15,
  },
  Agressive: {
    profit: 0.3,
    roi: 0.25,
    liquidity: 0.1,
    stability: 0.05,
    freshness: 0.15,
    capitalUse: 0.15,
  },
};

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

function getMidpoint(point: OsrsMarketHistoryPoint): number | null {
  const { avgHighPrice, avgLowPrice } = point;
  if (
    avgHighPrice === null ||
    avgLowPrice === null ||
    !Number.isFinite(avgHighPrice) ||
    !Number.isFinite(avgLowPrice) ||
    avgHighPrice <= 0 ||
    avgLowPrice <= 0
  ) {
    return null;
  }
  return (avgHighPrice + avgLowPrice) / 2;
}

export function calculateMerchVolatilityPercent(
  history: readonly OsrsMarketHistoryPoint[] | null | undefined,
): number | null {
  if (!history || history.length < MINIMUM_VOLATILITY_RETURNS + 1) return null;

  const observations = history
    .filter((point) => Number.isSafeInteger(point.timestamp) && point.timestamp > 0)
    .map((point) => ({ timestamp: point.timestamp, midpoint: getMidpoint(point) }))
    .filter((point): point is { timestamp: number; midpoint: number } => point.midpoint !== null)
    .sort((first, second) => first.timestamp - second.timestamp);

  const returns: number[] = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    if (!previous || !current) continue;

    const gapSeconds = current.timestamp - previous.timestamp;
    if (gapSeconds <= 0 || gapSeconds > FIVE_MINUTES_MS / 1_000 * 3) continue;
    returns.push(((current.midpoint - previous.midpoint) / previous.midpoint) * 100);
  }

  if (returns.length < MINIMUM_VOLATILITY_RETURNS) return null;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

function calculateSixHourVolume(
  item: OsrsMarketItem,
  nowMs: number,
): number {
  const nowSeconds = Math.floor(nowMs / 1_000);
  const history = item.history ?? [];
  const volume = history.reduce((sum, point) => {
    if (
      !Number.isSafeInteger(point.timestamp) ||
      point.timestamp > nowSeconds ||
      nowSeconds - point.timestamp > SIX_HOURS_SECONDS
    ) {
      return sum;
    }
    return sum + (point.highPriceVolume ?? 0) + (point.lowPriceVolume ?? 0);
  }, 0);

  if (volume > 0) return volume;
  const current = item.fiveMinutePrice;
  return (current?.highPriceVolume ?? 0) + (current?.lowPriceVolume ?? 0);
}

function strategyScore(
  components: MerchScoreComponents,
  strategy: MerchStrategy,
): number {
  const weights = strategyWeights[strategy];
  return Math.round(
    clamp(
      components.profit * weights.profit +
        components.roi * weights.roi +
        components.liquidity * weights.liquidity +
        components.stability * weights.stability +
        components.freshness * weights.freshness +
        components.capitalUse * weights.capitalUse,
    ) * 10,
  ) / 10;
}

export function calculateMerchRisk(
  volatilityPercent: number | null,
  liquidityScore: number,
  freshnessScore: number,
): { score: number; level: MerchRiskLevel } {
  const volatilityRisk =
    volatilityPercent === null ? 50 : clamp((volatilityPercent / VOLATILITY_LIMIT_PERCENT) * 100);
  const score = Math.round(
    clamp(volatilityRisk * 0.5 + (100 - liquidityScore) * 0.3 + (100 - freshnessScore) * 0.2),
  );
  const level: MerchRiskLevel = score <= 33 ? 'Faible' : score <= 66 ? 'Modéré' : 'Élevé';
  return { score, level };
}

export interface RankMerchOptions {
  readonly capitalGp: number;
  readonly strategy: MerchStrategy;
  readonly nowMs?: number;
  readonly maximumPriceAgeMs?: number;
  readonly taxPolicy?: GeTaxPolicy;
  readonly minimumVolume6h?: number;
}

export function rankMerchOpportunities(
  items: readonly OsrsMarketItem[],
  options: RankMerchOptions,
): RankedMerchOpportunity[] {
  const nowMs = options.nowMs ?? Date.now();
  const maximumPriceAgeMs = options.maximumPriceAgeMs ?? 15 * 60_000;
  const minimumVolume6h = options.minimumVolume6h ?? 1;
  const taxPolicy = options.taxPolicy ?? DEFAULT_GE_TAX_POLICY;
  const capitalGp = options.capitalGp;

  if (!Number.isSafeInteger(capitalGp) || capitalGp <= 0) return [];

  return items
    .flatMap((item): RankedMerchOpportunity[] => {
      const opportunity = calculateMerchOpportunity(item, taxPolicy);
      if (!opportunity || opportunity.profitPerItem <= 0) return [];

      const quoteAgeMs = nowMs - opportunity.oldestQuoteTime;
      if (quoteAgeMs < -60_000 || quoteAgeMs > maximumPriceAgeMs) return [];

      const quantityFromCapital = Math.floor(capitalGp / opportunity.buyPrice);
      const quantity = Math.min(quantityFromCapital, opportunity.buyLimit ?? quantityFromCapital);
      if (!Number.isSafeInteger(quantity) || quantity < 1) return [];

      const capitalRequired = quantity * opportunity.buyPrice;
      const estimatedTotalProfit = quantity * opportunity.profitPerItem;
      if (!Number.isSafeInteger(capitalRequired) || !Number.isSafeInteger(estimatedTotalProfit)) {
        return [];
      }

      const volume6h = calculateSixHourVolume(item, nowMs);
      if (!Number.isFinite(volume6h) || volume6h < minimumVolume6h) return [];

      const volatilityPercent = calculateMerchVolatilityPercent(item.history);
      if (volatilityPercent === null) return [];
      const liquidityScore = clamp((Math.log1p(volume6h) / Math.log1p(10_000)) * 100);
      const freshnessScore = clamp(100 * (1 - quoteAgeMs / maximumPriceAgeMs));
      const capitalUsePercent = clamp((capitalRequired / capitalGp) * 100);
      const risk = calculateMerchRisk(volatilityPercent, liquidityScore, freshnessScore);
      const scoreComponents: MerchScoreComponents = {
        profit: clamp(
          (Math.log1p(estimatedTotalProfit) / Math.log1p(PROFIT_SCORE_REFERENCE_GP)) * 100,
        ),
        roi: clamp((opportunity.roiPercent / ROI_SCORE_REFERENCE_PERCENT) * 100),
        liquidity: liquidityScore,
        stability: clamp(100 * (1 - volatilityPercent / VOLATILITY_LIMIT_PERCENT)),
        freshness: freshnessScore,
        capitalUse: capitalUsePercent,
      };

      return [
        {
          opportunity,
          quantity,
          estimatedTotalProfit,
          capitalRequired,
          capitalUsePercent,
          volume6h,
          liquidityScore: Math.round(liquidityScore),
          volatilityPercent,
          riskScore: risk.score,
          riskLevel: risk.level,
          freshnessScore: Math.round(freshnessScore),
          score: strategyScore(scoreComponents, options.strategy),
          scoreComponents,
          history: item.history ?? [],
        },
      ];
    })
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.estimatedTotalProfit - first.estimatedTotalProfit ||
        first.opportunity.item.name.localeCompare(second.opportunity.item.name),
    );
}

const priceBand = (buyPrice: number) =>
  buyPrice < 10_000 ? 0 : buyPrice < 1_000_000 ? 1 : buyPrice < 100_000_000 ? 2 : 3;

export function selectMerchHistoryCandidates(
  items: readonly OsrsMarketItem[],
  options: {
    readonly nowMs?: number;
    readonly maximumPriceAgeMs?: number;
    readonly maximumCandidates?: number;
    readonly taxPolicy?: GeTaxPolicy;
  } = {},
): OsrsMarketItem[] {
  const nowMs = options.nowMs ?? Date.now();
  const maximumPriceAgeMs = options.maximumPriceAgeMs ?? 15 * 60_000;
  const maximumCandidates = options.maximumCandidates ?? 20;
  const taxPolicy = options.taxPolicy ?? DEFAULT_GE_TAX_POLICY;
  const eligible = items.flatMap((item) => {
    const opportunity = calculateMerchOpportunity(item, taxPolicy);
    if (!opportunity || opportunity.profitPerItem <= 0) return [];
    const age = nowMs - opportunity.oldestQuoteTime;
    const volume = calculateSixHourVolume(item, nowMs);
    if (age < -60_000 || age > maximumPriceAgeMs || volume <= 0) return [];
    const preScore = Math.min(opportunity.roiPercent, 100) + Math.log1p(volume) * 3;
    return [{ item, buyPrice: opportunity.buyPrice, preScore }];
  });

  const byBand = new Map<number, typeof eligible>();
  for (const candidate of eligible) {
    const band = priceBand(candidate.buyPrice);
    const group = byBand.get(band) ?? [];
    group.push(candidate);
    byBand.set(band, group);
  }

  const selected = new Map<number, OsrsMarketItem>();
  const perBandLimit = Math.max(1, Math.ceil(maximumCandidates / 4));
  for (const group of byBand.values()) {
    group.sort((first, second) => second.preScore - first.preScore);
    for (const candidate of group.slice(0, perBandLimit)) {
      selected.set(candidate.item.item.id, candidate.item);
    }
  }

  if (selected.size < maximumCandidates) {
    eligible.sort((first, second) => second.preScore - first.preScore);
    for (const candidate of eligible) {
      selected.set(candidate.item.item.id, candidate.item);
      if (selected.size >= maximumCandidates) break;
    }
  }

  return [...selected.values()].slice(0, maximumCandidates);
}
