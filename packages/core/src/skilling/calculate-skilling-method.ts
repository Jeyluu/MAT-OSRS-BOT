import { calculateGeTaxPerItem, DEFAULT_GE_TAX_POLICY } from '../market/tax-policy';
import type { GeTaxPolicy } from '../market/types';
import type {
  SkillingMarketQuote,
  SkillingMethodDefinition,
  SkillingMethodResult,
  SkillingPricedIngredient,
  SkillingPricedOutput,
} from './types';

const isPositiveSafeNumber = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

export interface CalculateSkillingOptions {
  readonly nowMs?: number;
  readonly maximumQuoteAgeMs?: number;
  readonly taxPolicy?: GeTaxPolicy;
  readonly skillLevel?: number;
}

export function calculateSkillingMethod(
  method: SkillingMethodDefinition,
  market: ReadonlyMap<number, SkillingMarketQuote>,
  options: CalculateSkillingOptions = {},
): SkillingMethodResult {
  const nowMs = options.nowMs ?? Date.now();
  const maximumQuoteAgeMs = options.maximumQuoteAgeMs ?? 15 * 60_000;
  const taxPolicy = options.taxPolicy ?? DEFAULT_GE_TAX_POLICY;
  const nowSeconds = Math.floor(nowMs / 1_000);
  const rate = options.skillLevel
    ? method.ratesByLevel
        ?.filter((entry) => entry.minimumLevel <= options.skillLevel!)
        .at(-1)
    : undefined;
  const actionsPerHour = rate?.actionsPerHour ?? method.actionsPerHour;
  const xpPerAction = rate?.xpPerAction ?? method.xpPerAction;
  const reasons = method.isComplete ? [] : [method.incompleteReason ?? 'Données de méthode incomplètes.'];
  const inputs: SkillingPricedIngredient[] = [];
  const outputs: SkillingPricedOutput[] = [];

  for (const ingredient of method.inputs) {
    const quote = market.get(ingredient.itemId);
    if (!quote || !isPositiveSafeNumber(quote.high) || !quote.highTime) {
      reasons.push(`Prix d'achat absent pour ${quote?.name ?? `l'item ${ingredient.itemId}`}.`);
      continue;
    }
    const ageMs = nowMs - quote.highTime * 1_000;
    if (ageMs < -60_000 || ageMs > maximumQuoteAgeMs) {
      reasons.push(`Prix d'achat trop ancien pour ${quote.name}.`);
      continue;
    }
    inputs.push({
      ...ingredient,
      name: quote.name,
      unitPrice: quote.high,
      priceTimestamp: quote.highTime,
      totalPerHour: ingredient.quantity * actionsPerHour,
    });
  }

  for (const product of method.outputs) {
    const quote = market.get(product.itemId);
    if (!quote || !isPositiveSafeNumber(quote.low) || !quote.lowTime) {
      reasons.push(`Prix de vente absent pour ${quote?.name ?? `l'item ${product.itemId}`}.`);
      continue;
    }
    const ageMs = nowMs - quote.lowTime * 1_000;
    if (ageMs < -60_000 || ageMs > maximumQuoteAgeMs) {
      reasons.push(`Prix de vente trop ancien pour ${quote.name}.`);
      continue;
    }
    const geTaxPerItem = calculateGeTaxPerItem(product.itemId, quote.low, taxPolicy);
    outputs.push({
      ...product,
      name: quote.name,
      unitPrice: quote.low,
      geTaxPerItem,
      netUnitPrice: quote.low - geTaxPerItem,
      priceTimestamp: quote.lowTime,
      totalPerHour: product.quantity * actionsPerHour,
    });
  }

  const status = reasons.length === 0 ? 'complete' : 'incomplete';
  if (status === 'incomplete') {
    return {
      method,
      status,
      reasons,
      actionsPerHour,
      inputs,
      outputs,
      inputCostPerHour: null,
      outputRevenuePerHour: null,
      gpPerHour: null,
      xpPerHour: method.referenceXpPerHour ?? null,
      capitalRequired: null,
    };
  }

  const inputCostPerAction = inputs.reduce(
    (total, ingredient) => total + ingredient.quantity * ingredient.unitPrice,
    0,
  );
  const outputRevenuePerAction = outputs.reduce(
    (total, product) => total + product.quantity * product.netUnitPrice,
    0,
  );
  const inputCostPerHour = inputCostPerAction * actionsPerHour;
  const outputRevenuePerHour = outputRevenuePerAction * actionsPerHour;
  const gpPerHour = outputRevenuePerHour - inputCostPerHour;
  const xpPerHour = xpPerAction * actionsPerHour;
  const capitalRequired = inputCostPerAction * method.batchActions;

  if (
    ![inputCostPerHour, outputRevenuePerHour, gpPerHour, xpPerHour, capitalRequired].every(
      Number.isFinite,
    )
  ) {
    return {
      method,
      status: 'incomplete',
      reasons: ['Les prix ou le rendement dépassent les limites numériques du calculateur.'],
      actionsPerHour,
      inputs,
      outputs,
      inputCostPerHour: null,
      outputRevenuePerHour: null,
      gpPerHour: null,
      xpPerHour: null,
      capitalRequired: null,
    };
  }

  return {
    method,
    status,
    reasons,
    actionsPerHour,
    inputs,
    outputs,
    inputCostPerHour,
    outputRevenuePerHour,
    gpPerHour,
    xpPerHour,
    capitalRequired,
  };
}

export function recommendSkillingMethods(
  results: readonly SkillingMethodResult[],
  options: {
    readonly capitalGp: number;
    readonly levels: Readonly<Record<string, number>>;
    readonly style: 'Toutes' | 'AFK' | 'Actif';
    readonly skill?: string | 'Toutes';
  },
): SkillingMethodResult[] {
  if (!Number.isSafeInteger(options.capitalGp) || options.capitalGp < 0) return [];

  return results
    .filter((result) => {
      const level = options.levels[result.method.skill] ?? 1;
      return (
        result.status === 'complete' &&
        result.method.requiredLevel <= level &&
        result.capitalRequired !== null &&
        result.capitalRequired <= options.capitalGp &&
        (options.style === 'Toutes' || result.method.style === options.style) &&
        (!options.skill || options.skill === 'Toutes' || result.method.skill === options.skill)
      );
    })
    .sort(
      (first, second) =>
        (second.gpPerHour ?? Number.NEGATIVE_INFINITY) -
          (first.gpPerHour ?? Number.NEGATIVE_INFINITY) ||
        (second.xpPerHour ?? 0) - (first.xpPerHour ?? 0),
    );
}
