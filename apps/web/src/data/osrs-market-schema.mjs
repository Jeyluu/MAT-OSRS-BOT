import { z } from 'zod';

const nullablePrice = z.number().nonnegative().nullish();
const nullableTimestamp = z.number().int().nonnegative().nullish();
const nullableVolume = z.number().int().nonnegative().nullish();
const snapshotPrice = z.number().nonnegative().nullable();
const snapshotTimestamp = z.number().int().nonnegative().nullable();
const snapshotVolume = z.number().int().nonnegative().nullable();

export const latestPricesResponseSchema = z.object({
  data: z.record(
    z.string(),
    z.object({
      high: nullablePrice,
      highTime: nullableTimestamp,
      low: nullablePrice,
      lowTime: nullableTimestamp,
    }),
  ),
});

export const itemMappingResponseSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    icon: z.string(),
    members: z.boolean(),
    limit: z.number().int().nonnegative().nullish(),
  }),
);

export const fiveMinutePricesResponseSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  data: z.record(
    z.string(),
    z.object({
      avgHighPrice: nullablePrice,
      avgLowPrice: nullablePrice,
      highPriceVolume: nullableVolume,
      lowPriceVolume: nullableVolume,
    }),
  ),
});

export const timeseriesResponseSchema = z.object({
  itemId: z.number().int().positive(),
  startTimestamp: z.number().int().nonnegative(),
  endTimestamp: z.number().int().nonnegative(),
  timestep: z.number().int().positive(),
  data: z.array(
    z.object({
      timestamp: z.number().int().nonnegative(),
      avgHighPrice: nullablePrice,
      avgLowPrice: nullablePrice,
      highPriceVolume: nullableVolume,
      lowPriceVolume: nullableVolume,
    }),
  ),
});

export const osrsMarketSnapshotSchema = z.object({
  schemaVersion: z.literal(2),
  source: z.literal('OSRS Wiki Real-time Prices API'),
  sourceUrl: z.literal('https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices'),
  generatedAt: z
    .string()
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      'generatedAt doit être une date ISO valide.',
    )
    .nullable(),
  latestAsOf: snapshotTimestamp,
  fiveMinuteTimestamp: snapshotTimestamp,
  mappingItemCount: z.number().int().nonnegative(),
  quotedItemCount: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1),
      icon: z.string(),
      members: z.boolean(),
      buyLimit: z.number().int().nonnegative().nullable(),
      high: snapshotPrice,
      highTime: snapshotTimestamp,
      low: snapshotPrice,
      lowTime: snapshotTimestamp,
      avgHighPrice: snapshotPrice,
      avgLowPrice: snapshotPrice,
      highPriceVolume: snapshotVolume,
      lowPriceVolume: snapshotVolume,
      history: z
        .array(
          z.object({
            timestamp: z.number().int().nonnegative(),
            avgHighPrice: snapshotPrice,
            avgLowPrice: snapshotPrice,
            highPriceVolume: snapshotVolume,
            lowPriceVolume: snapshotVolume,
          }),
        )
        .nullable(),
    }),
  ),
});
