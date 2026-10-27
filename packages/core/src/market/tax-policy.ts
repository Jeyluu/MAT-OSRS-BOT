import type { GeTaxPolicy } from './types';

export const DEFAULT_GE_TAX_RATE = 0.02;
export const DEFAULT_GE_TAX_CAP = 5_000_000;

export const DEFAULT_GE_TAX_EXEMPT_ITEM_IDS: readonly number[] = [
  233, 315, 329, 347, 351, 355, 361, 365, 379, 558, 806, 807, 808, 882, 884,
  886, 952, 1733, 1735, 1755, 1785, 1891, 2140, 2142, 2309, 2327, 2347, 2552,
  3008, 3010, 3012, 3014, 3853, 5325, 5329, 5331, 5341, 5343, 8007, 8008, 8009,
  8010, 8011, 8013, 8794, 13190, 28790, 28824,
];

export const DEFAULT_GE_TAX_POLICY: GeTaxPolicy = {
  maximumPerItem: DEFAULT_GE_TAX_CAP,
  rate: DEFAULT_GE_TAX_RATE,
  taxExemptItemIds: new Set(DEFAULT_GE_TAX_EXEMPT_ITEM_IDS),
};

export function calculateGeTaxPerItem(
  itemId: number,
  sellPrice: number,
  taxPolicy: GeTaxPolicy = DEFAULT_GE_TAX_POLICY,
) {
  if (!Number.isSafeInteger(sellPrice) || sellPrice <= 0) return 0;
  if (taxPolicy.taxExemptItemIds.has(itemId)) return 0;

  return Math.min(Math.floor(sellPrice * taxPolicy.rate), taxPolicy.maximumPerItem);
}
