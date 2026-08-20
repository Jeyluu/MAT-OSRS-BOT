import { ConfigService } from '@nestjs/config';
import {
  Client,
  Events,
  Interaction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import type { MessageCreateOptions } from 'discord.js';
import { DiscordService } from './discord.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import type { MerchOpportunity } from '../opportunities/opportunities.types';

type DiscordConfiguration = Partial<
  Record<'DISCORD_TOKEN' | 'DISCORD_CLIENT_ID' | 'DISCORD_GUILD_ID', string>
>;
type ClientReadyHandler = (client: Client<true>) => void;
type InteractionHandler = (interaction: Interaction) => void;

type DiscordClientMock = {
  channels: {
    fetch: jest.Mock<Promise<unknown>, [string]>;
  };
  destroy: jest.Mock<Promise<void>, []>;
  isReady: jest.Mock<boolean, []>;
  login: jest.Mock<Promise<string>, [string]>;
  on: jest.Mock<void, [Events, InteractionHandler]>;
  once: jest.Mock<void, [Events, ClientReadyHandler]>;
};

describe('DiscordService', () => {
  const createService = (values: DiscordConfiguration = {}) => {
    const configService = {
      get: jest.fn<string | undefined, [string]>(
        (key) => values[key as keyof DiscordConfiguration],
      ),
    } as unknown as ConfigService;
    let readyHandler: ClientReadyHandler | undefined;
    let interactionHandler: InteractionHandler | undefined;
    const client: DiscordClientMock = {
      channels: {
        fetch: jest.fn<Promise<unknown>, [string]>(),
      },
      destroy: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      isReady: jest.fn<boolean, []>().mockReturnValue(false),
      login: jest
        .fn<Promise<string>, [string]>()
        .mockResolvedValue('discord-token'),
      on: jest.fn<void, [Events, InteractionHandler]>((event, handler) => {
        if (event === Events.InteractionCreate) {
          interactionHandler = handler;
        }
      }),
      once: jest.fn<void, [Events, ClientReadyHandler]>((event, handler) => {
        if (event === Events.ClientReady) {
          readyHandler = handler;
        }
      }),
    };
    const getOpportunities = jest.fn<
      Promise<readonly MerchOpportunity[]>,
      []
    >();
    const opportunitiesService = {
      getOpportunities,
    } as unknown as OpportunitiesService;

    return {
      client,
      getOpportunities,
      getInteractionHandler: (): InteractionHandler => {
        if (!interactionHandler) {
          throw new Error('Interaction handler was not registered.');
        }

        return interactionHandler;
      },
      getReadyHandler: (): ClientReadyHandler => {
        if (!readyHandler) {
          throw new Error('Client ready handler was not registered.');
        }

        return readyHandler;
      },
      service: new DiscordService(
        configService,
        client as unknown as Client,
        opportunitiesService,
      ),
    };
  };

  it('does not connect when Discord credentials are incomplete', async () => {
    const { client, service } = createService({
      DISCORD_TOKEN: 'test-token',
    });

    await service.onModuleInit();

    expect(client.login).not.toHaveBeenCalled();
    expect(client.on).not.toHaveBeenCalled();
    expect(client.once).not.toHaveBeenCalled();
  });

  it('synchronizes /ping and /merch in the configured Discord server after connecting', async () => {
    const { client, getReadyHandler, service } = createService({
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_GUILD_ID: 'test-guild-id',
      DISCORD_TOKEN: 'test-token',
    });
    const setCommands = jest
      .fn<Promise<void>, [readonly SlashCommandBuilder[], string?]>()
      .mockResolvedValue(undefined);
    const readyClient = {
      application: {
        commands: { set: setCommands },
        id: 'test-client-id',
      },
      user: { tag: 'MerchBot#0001' },
    } as unknown as Client<true>;

    await service.onModuleInit();
    getReadyHandler()(readyClient);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(client.login).toHaveBeenCalledWith('test-token');
    expect(setCommands).toHaveBeenCalledWith(
      expect.any(Array),
      'test-guild-id',
    );
    expect(
      setCommands.mock.calls[0]?.[0].map((command) => command.toJSON().name),
    ).toEqual(['ping', 'merch']);
  });

  it('replies to the /ping interaction', async () => {
    const { getInteractionHandler, service } = createService({
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_TOKEN: 'test-token',
    });
    const reply = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    getInteractionHandler()({
      commandName: 'ping',
      isChatInputCommand: () => true,
      reply,
    } as unknown as Interaction);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(reply).toHaveBeenCalledWith('Pong!');
  });

  it('replies privately to /merch with the requested opportunities', async () => {
    const { getInteractionHandler, getOpportunities, service } = createService({
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_TOKEN: 'test-token',
    });
    const deferReply = jest
      .fn<Promise<void>, [unknown]>()
      .mockResolvedValue(undefined);
    const editReply = jest
      .fn<Promise<void>, [unknown]>()
      .mockResolvedValue(undefined);
    getOpportunities.mockResolvedValue([
      {
        buyLimit: 70,
        buyPrice: 1_480_000,
        estimatedProfitAtBuyLimit: 6_160_000,
        geTaxPerItem: 32_000,
        item: { id: 4151, limit: 70, members: true, name: 'Abyssal whip' },
        netSellPrice: 1_568_000,
        oldestQuoteTime: 1_700_000_000_000,
        profitPerItem: 88_000,
        roiPercent: 5.9459,
        sellPrice: 1_600_000,
      },
    ]);

    await service.onModuleInit();
    getInteractionHandler()({
      commandName: 'merch',
      deferReply,
      editReply,
      isChatInputCommand: () => true,
      options: { getInteger: () => 1 },
    } as unknown as Interaction);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(getOpportunities).toHaveBeenCalledTimes(1);
    expect(editReply).toHaveBeenCalledTimes(1);
  });

  it('destroys the Discord client during application shutdown', async () => {
    const { client, service } = createService();

    await service.onApplicationShutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it('sends alert messages through a ready sendable channel without mentions', async () => {
    const { client, service } = createService();
    const send = jest
      .fn<Promise<void>, [MessageCreateOptions]>()
      .mockResolvedValue(undefined);
    client.isReady.mockReturnValue(true);
    client.channels.fetch.mockResolvedValue({
      isSendable: () => true,
      send,
    });

    await expect(
      service.sendMessage('123456789012345678', { content: '@everyone' }),
    ).resolves.toBe(true);

    expect(send.mock.calls[0]?.[0]).toMatchObject({
      allowedMentions: { parse: [] },
      content: '@everyone',
    });
  });

  it('does not try to send an alert before Discord is ready', async () => {
    const { client, service } = createService();

    await expect(
      service.sendMessage('123456789012345678', { content: 'alert' }),
    ).resolves.toBe(false);

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });
});
