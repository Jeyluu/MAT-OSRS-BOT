import type { GeTaxPolicy, MerchOpportunity, OsrsMarketItem } from './types';

const isPositiveSafeInteger = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value > 0;

export const calculateMerchOpportunity = (
  marketItem: OsrsMarketItem,
  taxPolicy: GeTaxPolicy,
): MerchOpportunity | null => {
  const { item, latestPrice } = marketItem;

  if (
    !latestPrice ||
    !isPositiveSafeInteger(latestPrice.high) ||
    !isPositiveSafeInteger(latestPrice.highTime) ||
    !isPositiveSafeInteger(latestPrice.low) ||
    !isPositiveSafeInteger(latestPrice.lowTime)
  ) {
    return null;
  }

  const buyPrice = latestPrice.low;
  const sellPrice = latestPrice.high;
  const geTaxPerItem = taxPolicy.taxExemptItemIds.has(item.id)
    ? 0
    : Math.min(
        Math.floor(sellPrice * taxPolicy.rate),
        taxPolicy.maximumPerItem,
      );
  const netSellPrice = sellPrice - geTaxPerItem;
  const profitPerItem = netSellPrice - buyPrice;

  return {
    buyLimit: item.limit,
    buyPrice,
    estimatedProfitAtBuyLimit:
      item.limit === null ? null : profitPerItem * item.limit,
    geTaxPerItem,
    item,
    netSellPrice,
    oldestQuoteTime:
      Math.min(latestPrice.highTime, latestPrice.lowTime) * 1_000,
    profitPerItem,
    roiPercent: (profitPerItem / buyPrice) * 100,
    sellPrice,
  };
};
