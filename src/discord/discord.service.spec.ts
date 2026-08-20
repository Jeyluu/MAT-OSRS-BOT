import { ConfigService } from '@nestjs/config';
import { Client, Events, Interaction, SlashCommandBuilder } from 'discord.js';
import { DiscordService } from './discord.service';

type DiscordConfiguration = Partial<
  Record<'DISCORD_TOKEN' | 'DISCORD_CLIENT_ID' | 'DISCORD_GUILD_ID', string>
>;
type ClientReadyHandler = (client: Client<true>) => void;
type InteractionHandler = (interaction: Interaction) => void;

type DiscordClientMock = {
  destroy: jest.Mock<Promise<void>, []>;
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
      destroy: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
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

    return {
      client,
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
      service: new DiscordService(configService, client as unknown as Client),
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

  it('synchronizes /ping in the configured Discord server after connecting', async () => {
    const { client, getReadyHandler, service } = createService({
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_GUILD_ID: 'test-guild-id',
      DISCORD_TOKEN: 'test-token',
    });
    const createCommand = jest
      .fn<Promise<void>, [SlashCommandBuilder, string?]>()
      .mockResolvedValue(undefined);
    const readyClient = {
      application: {
        commands: { create: createCommand },
        id: 'test-client-id',
      },
      user: { tag: 'MerchBot#0001' },
    } as unknown as Client<true>;

    await service.onModuleInit();
    getReadyHandler()(readyClient);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(client.login).toHaveBeenCalledWith('test-token');
    expect(createCommand).toHaveBeenCalledWith(
      expect.any(SlashCommandBuilder),
      'test-guild-id',
    );
    expect(createCommand.mock.calls[0][0].toJSON()).toMatchObject({
      description: 'Répond avec Pong!',
      name: 'ping',
    });
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

  it('destroys the Discord client during application shutdown', async () => {
    const { client, service } = createService();

    await service.onApplicationShutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
