import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Events, Interaction, SlashCommandBuilder } from 'discord.js';
import { DISCORD_CLIENT } from './discord.constants';

const PING_COMMAND_NAME = 'ping';

@Injectable()
export class DiscordService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(DISCORD_CLIENT) private readonly client: Client,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('DISCORD_TOKEN');
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const guildId = this.configService.get<string>('DISCORD_GUILD_ID');

    if (!token || !clientId) {
      this.logger.warn(
        'Connexion Discord ignorée : DISCORD_TOKEN et DISCORD_CLIENT_ID doivent être configurés.',
      );
      return;
    }

    this.client.once(Events.ClientReady, (readyClient) => {
      void this.registerPingCommand(readyClient, clientId, guildId).catch(
        (error) =>
          this.logError('Impossible de synchroniser la commande /ping.', error),
      );
    });
    this.client.on(Events.InteractionCreate, (interaction) => {
      void this.handleInteraction(interaction).catch((error) =>
        this.logError(
          'Impossible de répondre à une interaction Discord.',
          error,
        ),
      );
    });

    await this.client.login(token);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.destroy();
  }

  private async registerPingCommand(
    client: Client<true>,
    expectedClientId: string,
    guildId?: string,
  ): Promise<void> {
    if (client.application.id !== expectedClientId) {
      this.logger.error(
        'DISCORD_CLIENT_ID ne correspond pas à l’application Discord connectée.',
      );
      return;
    }

    const pingCommand = new SlashCommandBuilder()
      .setName(PING_COMMAND_NAME)
      .setDescription('Répond avec Pong!');

    await client.application.commands.create(pingCommand, guildId);

    const commandScope = guildId ? 'sur le serveur configuré' : 'globalement';
    this.logger.log(
      `Bot connecté à Discord : ${client.user.tag}. Commande /ping synchronisée ${commandScope}.`,
    );
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (
      !interaction.isChatInputCommand() ||
      interaction.commandName !== PING_COMMAND_NAME
    ) {
      return;
    }

    await interaction.reply('Pong!');
  }

  private logError(message: string, error: unknown): void {
    const details = error instanceof Error ? error.stack : String(error);

    this.logger.error(message, details);
  }
}
