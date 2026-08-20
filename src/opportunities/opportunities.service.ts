import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OsrsPricesService } from '../osrs-prices/osrs-prices.service';
import {
  DEFAULT_GE_TAX_EXEMPT_ITEM_IDS,
  DEFAULT_OPPORTUNITIES_GE_TAX_CAP,
  DEFAULT_OPPORTUNITIES_GE_TAX_RATE,
  DEFAULT_OPPORTUNITIES_INCLUDE_MEMBERS,
  DEFAULT_OPPORTUNITIES_MAX_PRICE_AGE_MS,
  DEFAULT_OPPORTUNITIES_MAX_RESULTS,
  DEFAULT_OPPORTUNITIES_MIN_BUY_LIMIT,
  DEFAULT_OPPORTUNITIES_MIN_BUY_PRICE,
  DEFAULT_OPPORTUNITIES_MIN_PROFIT_PER_ITEM,
  DEFAULT_OPPORTUNITIES_MIN_ROI_PERCENT,
} from './opportunities.constants';
import { calculateMerchOpportunity } from './opportunities.calculator';
import type {
  GeTaxPolicy,
  MerchOpportunity,
  OpportunityFilters,
} from './opportunities.types';

@Injectable()
export class OpportunitiesService {
  private readonly filters: OpportunityFilters;
  private readonly taxPolicy: GeTaxPolicy;

  constructor(
    private readonly osrsPricesService: OsrsPricesService,
    configService: ConfigService,
  ) {
    this.filters = {
      includeMembers: this.getBoolean(
        configService.get<string>('OPPORTUNITIES_INCLUDE_MEMBERS'),
        'OPPORTUNITIES_INCLUDE_MEMBERS',
        DEFAULT_OPPORTUNITIES_INCLUDE_MEMBERS,
      ),
      maximumPriceAgeMs: this.getNonNegativeInteger(
        configService.get<string>('OPPORTUNITIES_MAX_PRICE_AGE_MS'),
        'OPPORTUNITIES_MAX_PRICE_AGE_MS',
        DEFAULT_OPPORTUNITIES_MAX_PRICE_AGE_MS,
      ),
      maximumResults: this.getPositiveInteger(
        configService.get<string>('OPPORTUNITIES_MAX_RESULTS'),
        'OPPORTUNITIES_MAX_RESULTS',
        DEFAULT_OPPORTUNITIES_MAX_RESULTS,
      ),
      minimumBuyLimit: this.getNonNegativeInteger(
        configService.get<string>('OPPORTUNITIES_MIN_BUY_LIMIT'),
        'OPPORTUNITIES_MIN_BUY_LIMIT',
        DEFAULT_OPPORTUNITIES_MIN_BUY_LIMIT,
      ),
      minimumBuyPrice: this.getNonNegativeNumber(
        configService.get<string>('OPPORTUNITIES_MIN_BUY_PRICE'),
        'OPPORTUNITIES_MIN_BUY_PRICE',
        DEFAULT_OPPORTUNITIES_MIN_BUY_PRICE,
      ),
      minimumProfitPerItem: this.getNonNegativeNumber(
        configService.get<string>('OPPORTUNITIES_MIN_PROFIT_PER_ITEM'),
        'OPPORTUNITIES_MIN_PROFIT_PER_ITEM',
        DEFAULT_OPPORTUNITIES_MIN_PROFIT_PER_ITEM,
      ),
      minimumRoiPercent: this.getNonNegativeNumber(
        configService.get<string>('OPPORTUNITIES_MIN_ROI_PERCENT'),
        'OPPORTUNITIES_MIN_ROI_PERCENT',
        DEFAULT_OPPORTUNITIES_MIN_ROI_PERCENT,
      ),
    };
    this.taxPolicy = {
      maximumPerItem: this.getNonNegativeInteger(
        configService.get<string>('OPPORTUNITIES_GE_TAX_CAP'),
        'OPPORTUNITIES_GE_TAX_CAP',
        DEFAULT_OPPORTUNITIES_GE_TAX_CAP,
      ),
      rate: this.getTaxRate(
        configService.get<string>('OPPORTUNITIES_GE_TAX_RATE'),
      ),
      taxExemptItemIds: this.getTaxExemptItemIds(
        configService.get<string>('OPPORTUNITIES_GE_TAX_EXEMPT_ITEM_IDS'),
      ),
    };
  }

  async getOpportunities(): Promise<readonly MerchOpportunity[]> {
    const now = Date.now();
    const marketItems = await this.osrsPricesService.getMarketItems();

    return marketItems
      .map((marketItem) =>
        calculateMerchOpportunity(marketItem, this.taxPolicy),
      )
      .filter(
        (opportunity): opportunity is MerchOpportunity => opportunity !== null,
      )
      .filter((opportunity) => this.matchesFilters(opportunity, now))
      .sort(this.compareOpportunities)
      .slice(0, this.filters.maximumResults);
  }

  private compareOpportunities(
    this: void,
    left: MerchOpportunity,
    right: MerchOpportunity,
  ): number {
    const estimatedProfitDifference =
      (right.estimatedProfitAtBuyLimit ?? Number.NEGATIVE_INFINITY) -
      (left.estimatedProfitAtBuyLimit ?? Number.NEGATIVE_INFINITY);

    if (estimatedProfitDifference !== 0) {
      return estimatedProfitDifference;
    }

    const profitDifference = right.profitPerItem - left.profitPerItem;

    if (profitDifference !== 0) {
      return profitDifference;
    }

    return left.item.name.localeCompare(right.item.name);
  }

  private getBoolean(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: boolean,
  ): boolean {
    if (!configuredValue?.trim()) {
      return defaultValue;
    }

    const value = configuredValue.trim().toLocaleLowerCase();

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new InternalServerErrorException(
      `${configurationKey} doit etre true ou false.`,
    );
  }

  private getNonNegativeInteger(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: number,
  ): number {
    const value = this.getNonNegativeNumber(
      configuredValue,
      configurationKey,
      defaultValue,
    );

    if (!Number.isSafeInteger(value)) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre un nombre entier positif ou nul.`,
      );
    }

    return value;
  }

  private getNonNegativeNumber(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: number,
  ): number {
    if (!configuredValue?.trim()) {
      return defaultValue;
    }

    const value = Number(configuredValue);

    if (!Number.isFinite(value) || value < 0) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre un nombre positif ou nul.`,
      );
    }

    return value;
  }

  private getPositiveInteger(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: number,
  ): number {
    const value = this.getNonNegativeInteger(
      configuredValue,
      configurationKey,
      defaultValue,
    );

    if (value === 0) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre strictement positif.`,
      );
    }

    return value;
  }

  private getTaxExemptItemIds(
    configuredValue: string | undefined,
  ): ReadonlySet<number> {
    const itemIds = new Set(DEFAULT_GE_TAX_EXEMPT_ITEM_IDS);

    if (!configuredValue?.trim()) {
      return itemIds;
    }

    for (const value of configuredValue.split(',')) {
      const itemId = Number(value.trim());

      if (!Number.isSafeInteger(itemId) || itemId <= 0) {
        throw new InternalServerErrorException(
          'OPPORTUNITIES_GE_TAX_EXEMPT_ITEM_IDS doit contenir des IDs positifs separes par des virgules.',
        );
      }

      itemIds.add(itemId);
    }

    return itemIds;
  }

  private getTaxRate(configuredValue: string | undefined): number {
    const taxRate = this.getNonNegativeNumber(
      configuredValue,
      'OPPORTUNITIES_GE_TAX_RATE',
      DEFAULT_OPPORTUNITIES_GE_TAX_RATE,
    );

    if (taxRate > 1) {
      throw new InternalServerErrorException(
        'OPPORTUNITIES_GE_TAX_RATE doit etre inferieur ou egal a 1.',
      );
    }

    return taxRate;
  }

  private matchesFilters(opportunity: MerchOpportunity, now: number): boolean {
    const priceAgeMs = now - opportunity.oldestQuoteTime;

    return (
      (this.filters.includeMembers || !opportunity.item.members) &&
      priceAgeMs >= 0 &&
      priceAgeMs <= this.filters.maximumPriceAgeMs &&
      opportunity.buyPrice >= this.filters.minimumBuyPrice &&
      opportunity.profitPerItem >= this.filters.minimumProfitPerItem &&
      opportunity.roiPercent >= this.filters.minimumRoiPercent &&
      (opportunity.buyLimit === null ||
        opportunity.buyLimit >= this.filters.minimumBuyLimit)
    );
  }
}
