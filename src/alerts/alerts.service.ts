import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordService } from '../discord/discord.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import type { MerchOpportunity } from '../opportunities/opportunities.types';
import {
  DEFAULT_ALERTS_DEDUP_TTL_MS,
  DEFAULT_ALERTS_INTERVAL_MS,
  DEFAULT_ALERTS_MAX_PER_RUN,
  MAXIMUM_ALERTS_PER_RUN,
  MINIMUM_ALERTS_INTERVAL_MS,
} from './alerts.constants';

@Injectable()
export class AlertsService implements OnModuleInit, OnApplicationShutdown {
  private readonly channelId: string | undefined;
  private readonly dedupTtlMs: number;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly lastSentAtByItemId = new Map<number, number>();
  private readonly logger = new Logger(AlertsService.name);
  private readonly maximumPerRun: number;
  private checkInProgress = false;
  private alertInterval: NodeJS.Timeout | undefined;

  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly discordService: DiscordService,
    configService: ConfigService,
  ) {
    this.enabled = this.getBoolean(
      configService.get<string>('ALERTS_ENABLED'),
      'ALERTS_ENABLED',
      false,
    );

    if (!this.enabled) {
      this.channelId = undefined;
      this.dedupTtlMs = DEFAULT_ALERTS_DEDUP_TTL_MS;
      this.intervalMs = DEFAULT_ALERTS_INTERVAL_MS;
      this.maximumPerRun = DEFAULT_ALERTS_MAX_PER_RUN;
      return;
    }

    this.requireDiscordCredentials(
      configService.get<string>('DISCORD_TOKEN'),
      configService.get<string>('DISCORD_CLIENT_ID'),
    );

    this.channelId = this.getChannelId(
      configService.get<string>('ALERTS_DISCORD_CHANNEL_ID'),
    );
    this.dedupTtlMs = this.getNonNegativeInteger(
      configService.get<string>('ALERTS_DEDUP_TTL_MS'),
      'ALERTS_DEDUP_TTL_MS',
      DEFAULT_ALERTS_DEDUP_TTL_MS,
    );
    this.intervalMs = this.getIntervalMs(
      configService.get<string>('ALERTS_INTERVAL_MS'),
    );
    this.maximumPerRun = this.getMaximumPerRun(
      configService.get<string>('ALERTS_MAX_PER_RUN'),
    );
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Alertes Discord desactivees.');
      return;
    }

    this.alertInterval = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    void this.runOnce();
  }

  onApplicationShutdown(): void {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = undefined;
    }
  }

  async runOnce(): Promise<void> {
    if (
      !this.enabled ||
      !this.channelId ||
      this.checkInProgress ||
      !this.discordService.isReady()
    ) {
      return;
    }

    this.checkInProgress = true;

    try {
      const now = Date.now();
      const candidates = (await this.opportunitiesService.getOpportunities())
        .filter((opportunity) => this.shouldSend(opportunity, now))
        .slice(0, this.maximumPerRun);

      if (candidates.length === 0) {
        return;
      }

      const sent = await this.discordService.sendMessage(this.channelId, {
        content: this.formatDigest(candidates),
      });

      if (!sent) {
        return;
      }

      for (const candidate of candidates) {
        this.lastSentAtByItemId.set(candidate.item.id, now);
      }
    } catch (error) {
      const details = error instanceof Error ? error.stack : String(error);

      this.logger.error(
        'Impossible de verifier les alertes de merch.',
        details,
      );
    } finally {
      this.checkInProgress = false;
    }
  }

  private formatDigest(opportunities: readonly MerchOpportunity[]): string {
    return [
      '**Opportunites de merch**',
      ...opportunities.map((opportunity) =>
        this.formatOpportunity(opportunity),
      ),
      '_Estimations basees sur les dernieres transactions, taxe GE incluse._',
    ].join('\n\n');
  }

  private formatGp(value: number): string {
    return `${value.toLocaleString('fr-FR')} GP`;
  }

  private formatOpportunity(opportunity: MerchOpportunity): string {
    const estimatedProfit =
      opportunity.estimatedProfitAtBuyLimit === null
        ? 'inconnue'
        : this.formatGp(opportunity.estimatedProfitAtBuyLimit);
    const buyLimit =
      opportunity.buyLimit === null
        ? 'inconnue'
        : opportunity.buyLimit.toLocaleString('fr-FR');

    return [
      `**${opportunity.item.name}**`,
      `Achat ${this.formatGp(opportunity.buyPrice)} | Vente ${this.formatGp(opportunity.sellPrice)}`,
      `Profit ${this.formatGp(opportunity.profitPerItem)} / unite (${opportunity.roiPercent.toFixed(2)}%)`,
      `Limite ${buyLimit} | Estimation ${estimatedProfit}`,
    ].join('\n');
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

  private getChannelId(configuredValue: string | undefined): string {
    const channelId = configuredValue?.trim();

    if (!channelId || !/^\d{17,20}$/.test(channelId)) {
      throw new InternalServerErrorException(
        'ALERTS_DISCORD_CHANNEL_ID doit etre un ID de salon Discord valide.',
      );
    }

    return channelId;
  }

  private getIntervalMs(configuredValue: string | undefined): number {
    const intervalMs = this.getPositiveInteger(
      configuredValue,
      'ALERTS_INTERVAL_MS',
      DEFAULT_ALERTS_INTERVAL_MS,
    );

    if (intervalMs < MINIMUM_ALERTS_INTERVAL_MS) {
      throw new InternalServerErrorException(
        `ALERTS_INTERVAL_MS doit etre superieur ou egal a ${MINIMUM_ALERTS_INTERVAL_MS}.`,
      );
    }

    return intervalMs;
  }

  private requireDiscordCredentials(
    token: string | undefined,
    clientId: string | undefined,
  ): void {
    if (!token?.trim() || !clientId?.trim()) {
      throw new InternalServerErrorException(
        'DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis lorsque ALERTS_ENABLED=true.',
      );
    }
  }

  private getMaximumPerRun(configuredValue: string | undefined): number {
    const maximumPerRun = this.getPositiveInteger(
      configuredValue,
      'ALERTS_MAX_PER_RUN',
      DEFAULT_ALERTS_MAX_PER_RUN,
    );

    if (maximumPerRun > MAXIMUM_ALERTS_PER_RUN) {
      throw new InternalServerErrorException(
        `ALERTS_MAX_PER_RUN ne peut pas depasser ${MAXIMUM_ALERTS_PER_RUN}.`,
      );
    }

    return maximumPerRun;
  }

  private getNonNegativeInteger(
    configuredValue: string | undefined,
    configurationKey: string,
    defaultValue: number,
  ): number {
    if (!configuredValue?.trim()) {
      return defaultValue;
    }

    const value = Number(configuredValue);

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InternalServerErrorException(
        `${configurationKey} doit etre un nombre entier positif ou nul.`,
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

  private shouldSend(opportunity: MerchOpportunity, now: number): boolean {
    const lastSentAt = this.lastSentAtByItemId.get(opportunity.item.id);

    return lastSentAt === undefined || now - lastSentAt >= this.dedupTtlMs;
  }
}
