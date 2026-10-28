export type SkillingPlayStyle = 'AFK' | 'Actif';

export interface SkillingRecipeItem {
  readonly itemId: number;
  readonly quantity: number;
}

export interface SkillingRateByLevel {
  readonly minimumLevel: number;
  readonly actionsPerHour: number;
  readonly xpPerAction?: number;
}

export interface SkillingMethodDefinition {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly requiredLevel: number;
  readonly style: SkillingPlayStyle;
  readonly description: string;
  readonly inputs: readonly SkillingRecipeItem[];
  readonly outputs: readonly SkillingRecipeItem[];
  readonly xpPerAction: number;
  readonly actionsPerHour: number;
  readonly ratesByLevel?: readonly SkillingRateByLevel[];
  readonly batchActions: number;
  readonly requirements: readonly string[];
  readonly steps: readonly string[];
  readonly assumptions: readonly string[];
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly isComplete: boolean;
  readonly incompleteReason?: string;
  readonly referenceXpPerHour?: number;
  readonly referenceYieldPerPatch?: number;
  readonly growthCycleMinutes?: number;
}

export interface SkillingMarketQuote {
  readonly id: number;
  readonly name: string;
  readonly high: number | null;
  readonly highTime: number | null;
  readonly low: number | null;
  readonly lowTime: number | null;
}

export interface SkillingPricedIngredient extends SkillingRecipeItem {
  readonly name: string;
  readonly unitPrice: number;
  readonly priceTimestamp: number;
  readonly totalPerHour: number;
}

export interface SkillingPricedOutput extends SkillingRecipeItem {
  readonly name: string;
  readonly unitPrice: number;
  readonly geTaxPerItem: number;
  readonly netUnitPrice: number;
  readonly priceTimestamp: number;
  readonly totalPerHour: number;
}

export interface SkillingMethodResult {
  readonly method: SkillingMethodDefinition;
  readonly status: 'complete' | 'incomplete';
  readonly reasons: readonly string[];
  readonly actionsPerHour: number;
  readonly inputs: readonly SkillingPricedIngredient[];
  readonly outputs: readonly SkillingPricedOutput[];
  readonly inputCostPerHour: number | null;
  readonly outputRevenuePerHour: number | null;
  readonly gpPerHour: number | null;
  readonly xpPerHour: number | null;
  readonly capitalRequired: number | null;
}
