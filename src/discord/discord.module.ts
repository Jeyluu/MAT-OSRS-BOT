import { Module } from '@nestjs/common';
import { Client, GatewayIntentBits } from 'discord.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { DISCORD_CLIENT } from './discord.constants';
import { DiscordService } from './discord.service';

@Module({
  imports: [OpportunitiesModule],
  providers: [
    {
      provide: DISCORD_CLIENT,
      useFactory: (): Client =>
        new Client({ intents: [GatewayIntentBits.Guilds] }),
    },
    DiscordService,
  ],
  exports: [DiscordService],
})
export class DiscordModule {}
