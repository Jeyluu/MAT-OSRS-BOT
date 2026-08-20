import { Module } from '@nestjs/common';
import { OSRS_PRICES_FETCH } from './osrs-prices.constants';
import { OsrsPricesService } from './osrs-prices.service';
import type { OsrsPricesFetch } from './osrs-prices.types';

@Module({
  providers: [
    {
      provide: OSRS_PRICES_FETCH,
      useFactory: (): OsrsPricesFetch => (input, init) =>
        globalThis.fetch(input, init),
    },
    OsrsPricesService,
  ],
  exports: [OsrsPricesService],
})
export class OsrsPricesModule {}
