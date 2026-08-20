import { Module } from '@nestjs/common';
import { Client, GatewayIntentBits } from 'discord.js';
import { DISCORD_CLIENT } from './discord.constants';
import { DiscordService } from './discord.service';

@Module({
  providers: [
    {
      provide: DISCORD_CLIENT,
      useFactory: (): Client =>
        new Client({ intents: [GatewayIntentBits.Guilds] }),
    },
    DiscordService,
  ],
})
export class DiscordModule {}
