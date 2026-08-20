import { Module } from '@nestjs/common';
import { DiscordModule } from '../discord/discord.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { AlertsService } from './alerts.service';

@Module({
  imports: [DiscordModule, OpportunitiesModule],
  providers: [AlertsService],
})
export class AlertsModule {}
