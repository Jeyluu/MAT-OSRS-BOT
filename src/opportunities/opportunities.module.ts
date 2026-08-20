import { Module } from '@nestjs/common';
import { OsrsPricesModule } from '../osrs-prices/osrs-prices.module';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [OsrsPricesModule],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
