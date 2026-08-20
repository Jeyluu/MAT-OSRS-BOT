import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  EmbedBuilder,
  Events,
  Interaction,
  MessageFlags,
  MessageCreateOptions,
  SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import type { MerchOpportunity } from '../opportunities/opportunities.types';
import { DISCORD_CLIENT } from './discord.constants';

const DEFAULT_MERCH_COMMAND_RESULTS = 5;
const MAXIMUM_MERCH_COMMAND_RESULTS = 10;
const MERCH_COMMAND_NAME = 'merch';
const PING_COMMAND_NAME = 'ping';

@Injectable()
export class DiscordService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(DISCORD_CLIENT) private readonly client: Client,
    private readonly opportunitiesService: OpportunitiesService,
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
      void this.registerCommands(readyClient, clientId, guildId).catch(
        (error) =>
          this.logError(
            'Impossible de synchroniser les commandes Discord.',
            error,
          ),
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

  isReady(): boolean {
    return this.client.isReady();
  }

  async sendMessage(
    channelId: string,
    message: MessageCreateOptions,
  ): Promise<boolean> {
    if (!this.client.isReady()) {
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isSendable()) {
        this.logger.error(
          `Le salon Discord configure pour les alertes est introuvable ou non textuel : ${channelId}.`,
        );
        return false;
      }

      await channel.send({
        ...message,
        allowedMentions: { parse: [] },
      });
      return true;
    } catch (error) {
      this.logError(
        `Impossible d'envoyer un message dans le salon Discord ${channelId}.`,
        error,
      );
      return false;
    }
  }

  private createCommands() {
    const pingCommand = new SlashCommandBuilder()
      .setName(PING_COMMAND_NAME)
      .setDescription('Repond avec Pong!');
    const merchCommand = new SlashCommandBuilder()
      .setName(MERCH_COMMAND_NAME)
      .setDescription('Affiche les meilleures opportunites de merch OSRS.')
      .addIntegerOption((option) =>
        option
          .setName('nombre')
          .setDescription('Nombre de resultats, entre 1 et 10.')
          .setMinValue(1)
          .setMaxValue(MAXIMUM_MERCH_COMMAND_RESULTS),
      );

    return [pingCommand, merchCommand];
  }

  private createMerchEmbed(
    opportunities: readonly MerchOpportunity[],
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x3ba55c)
      .setTitle('Opportunites de merch')
      .setFooter({
        text: 'Estimations basees sur les dernieres transactions, taxe GE incluse.',
      })
      .setTimestamp();

    if (opportunities.length === 0) {
      return embed.setDescription(
        'Aucune opportunite ne correspond aux filtres actuels.',
      );
    }

    return embed.addFields(
      opportunities.map((opportunity) => ({
        name: opportunity.item.name.slice(0, 256),
        value: this.formatMerchOpportunity(opportunity),
      })),
    );
  }

  private formatGp(value: number): string {
    return `${value.toLocaleString('fr-FR')} GP`;
  }

  private formatMerchOpportunity(opportunity: MerchOpportunity): string {
    const estimatedProfit =
      opportunity.estimatedProfitAtBuyLimit === null
        ? 'inconnue'
        : this.formatGp(opportunity.estimatedProfitAtBuyLimit);
    const buyLimit =
      opportunity.buyLimit === null
        ? 'inconnue'
        : opportunity.buyLimit.toLocaleString('fr-FR');

    return [
      `Achat : ${this.formatGp(opportunity.buyPrice)}`,
      `Vente : ${this.formatGp(opportunity.sellPrice)}`,
      `Profit : ${this.formatGp(opportunity.profitPerItem)} / unite (${opportunity.roiPercent.toFixed(2)}%)`,
      `Limite : ${buyLimit} | Estimation : ${estimatedProfit}`,
      `Ancienne cotation : <t:${Math.floor(opportunity.oldestQuoteTime / 1_000)}:R>`,
    ].join('\n');
  }

  private async registerCommands(
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

    const commands = this.createCommands();

    if (guildId) {
      await client.application.commands.set(commands, guildId);
    } else {
      await client.application.commands.set(commands);
    }

    const commandScope = guildId ? 'sur le serveur configure' : 'globalement';
    this.logger.log(
      `Bot connecte a Discord : ${client.user.tag}. Commandes /ping et /merch synchronisees ${commandScope}.`,
    );
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === PING_COMMAND_NAME) {
      await interaction.reply('Pong!');
      return;
    }

    if (interaction.commandName === MERCH_COMMAND_NAME) {
      await this.replyWithMerch(interaction);
    }
  }

  private async replyWithMerch(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const requestedResults =
      interaction.options.getInteger('nombre') ?? DEFAULT_MERCH_COMMAND_RESULTS;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const opportunities = await this.opportunitiesService.getOpportunities();

      await interaction.editReply({
        embeds: [
          this.createMerchEmbed(opportunities.slice(0, requestedResults)),
        ],
      });
    } catch (error) {
      this.logError(
        'Impossible de recuperer les opportunites de merch.',
        error,
      );
      await interaction.editReply(
        'Impossible de recuperer les opportunites pour le moment. Reessaie dans quelques instants.',
      );
    }
  }

  private logError(message: string, error: unknown): void {
    const details = error instanceof Error ? error.stack : String(error);

    this.logger.error(message, details);
  }
}
