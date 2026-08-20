import { ConfigService } from '@nestjs/config';
import { DiscordService } from '../discord/discord.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import type { MerchOpportunity } from '../opportunities/opportunities.types';
import { AlertsService } from './alerts.service';

type AlertsConfiguration = Partial<
  Record<
    | 'ALERTS_DEDUP_TTL_MS'
    | 'ALERTS_DISCORD_CHANNEL_ID'
    | 'ALERTS_ENABLED'
    | 'ALERTS_INTERVAL_MS'
    | 'ALERTS_MAX_PER_RUN'
    | 'DISCORD_CLIENT_ID'
    | 'DISCORD_TOKEN',
    string
  >
>;

const now = 1_700_000_000_000;

const createOpportunity = (id: number): MerchOpportunity => ({
  buyLimit: 100,
  buyPrice: 10_000,
  estimatedProfitAtBuyLimit: 176_000,
  geTaxPerItem: 240,
  item: { id, limit: 100, members: false, name: `Item ${id}` },
  netSellPrice: 11_760,
  oldestQuoteTime: now,
  profitPerItem: 1_760,
  roiPercent: 17.6,
  sellPrice: 12_000,
});

describe('AlertsService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createService = (configuration: AlertsConfiguration = {}) => {
    const values: AlertsConfiguration = {
      ALERTS_DEDUP_TTL_MS: '3600000',
      ALERTS_DISCORD_CHANNEL_ID: '123456789012345678',
      ALERTS_ENABLED: 'true',
      ALERTS_INTERVAL_MS: '60000',
      ALERTS_MAX_PER_RUN: '3',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_TOKEN: 'test-token',
      ...configuration,
    };
    const configService = {
      get: jest.fn<string | undefined, [string]>(
        (key) => values[key as keyof AlertsConfiguration],
      ),
    } as unknown as ConfigService;
    const getOpportunities = jest.fn<
      Promise<readonly MerchOpportunity[]>,
      []
    >();
    const opportunitiesService = {
      getOpportunities,
    } as unknown as OpportunitiesService;
    const discordService = {
      isReady: jest.fn<boolean, []>().mockReturnValue(true),
      sendMessage: jest
        .fn<Promise<boolean>, [string, { content: string }]>()
        .mockResolvedValue(true),
    };

    return {
      discordService,
      getOpportunities,
      service: new AlertsService(
        opportunitiesService,
        discordService as unknown as DiscordService,
        configService,
      ),
    };
  };

  it('sends a digest once and deduplicates the same items during the cooldown', async () => {
    const { discordService, getOpportunities, service } = createService();
    getOpportunities.mockResolvedValue([
      createOpportunity(1),
      createOpportunity(2),
    ]);

    await service.runOnce();
    await service.runOnce();

    expect(discordService.sendMessage).toHaveBeenCalledTimes(1);
    expect(discordService.sendMessage.mock.calls[0]?.[0]).toBe(
      '123456789012345678',
    );
    expect(discordService.sendMessage.mock.calls[0]?.[1].content).toContain(
      'Item 1',
    );
  });

  it('does not deduplicate alerts that failed to send', async () => {
    const { discordService, getOpportunities, service } = createService();
    getOpportunities.mockResolvedValue([createOpportunity(1)]);
    discordService.sendMessage
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await service.runOnce();
    await service.runOnce();

    expect(discordService.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not request opportunities while Discord is unavailable', async () => {
    const { discordService, getOpportunities, service } = createService();
    discordService.isReady.mockReturnValue(false);

    await service.runOnce();

    expect(getOpportunities).not.toHaveBeenCalled();
    expect(discordService.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send alerts when disabled', async () => {
    const { discordService, getOpportunities, service } = createService({
      ALERTS_ENABLED: 'false',
    });

    await service.runOnce();

    expect(getOpportunities).not.toHaveBeenCalled();
    expect(discordService.sendMessage).not.toHaveBeenCalled();
  });

  it('requires Discord credentials when alerts are enabled', () => {
    expect(() => createService({ DISCORD_TOKEN: '' })).toThrow(
      'DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis',
    );
  });
});
