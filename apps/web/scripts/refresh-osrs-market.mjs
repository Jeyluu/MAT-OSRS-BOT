import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fiveMinutePricesResponseSchema,
  itemMappingResponseSchema,
  latestPricesResponseSchema,
  osrsMarketSnapshotSchema,
  timeseriesResponseSchema,
} from '../src/data/osrs-market-schema.mjs';

const require = createRequire(import.meta.url);
const { DEFAULT_GE_TAX_POLICY, selectMerchHistoryCandidates } = require('@osrs-helper/core');

const apiBaseUrl = 'https://prices.runescape.wiki/api/v2/osrs';
const sourceUrl = 'https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices';
const repository = process.env.GITHUB_REPOSITORY ?? 'Jeyluu/MAT-OSRS-BOT';
const userAgent =
  process.env.OSRS_WIKI_USER_AGENT ??
  `OSRS Helper market snapshot/1.0 (+https://github.com/${repository})`;
const required = process.argv.includes('--required');
const destination = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data/osrs-market.json',
);

async function requestJson(endpoint) {
  const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`L’API OSRS Wiki a répondu ${response.status} pour /${endpoint}.`);
  }

  return response.json();
}

function parseResponse(schema, value, endpoint) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Réponse /${endpoint} invalide : ${details}`);
  }

  return result.data;
}

async function refreshMarketSnapshot() {
  const mapping = parseResponse(itemMappingResponseSchema, await requestJson('mapping'), 'mapping');
  const latest = parseResponse(latestPricesResponseSchema, await requestJson('latest'), 'latest');
  const fiveMinute = parseResponse(fiveMinutePricesResponseSchema, await requestJson('5m'), '5m');

  const marketItems = mapping.map((item) => {
    const key = String(item.id);
    const latestPrice = latest.data[key];
    const fiveMinutePrice = fiveMinute.data[key];

    return {
      item: {
        id: item.id,
        name: item.name,
        icon: item.icon,
        members: item.members,
        limit: item.limit ?? null,
      },
      latestPrice: latestPrice ?? null,
      fiveMinutePrice: fiveMinutePrice ?? null,
    };
  });

  const historyCandidates = selectMerchHistoryCandidates(marketItems, {
    taxPolicy: DEFAULT_GE_TAX_POLICY,
    maximumCandidates: 40,
  });
  const historyByItemId = new Map();

  for (const [index, candidate] of historyCandidates.entries()) {
    if (index > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    const response = parseResponse(
      timeseriesResponseSchema,
      await requestJson(`timeseries?id=${candidate.item.id}&lookback=6h`),
      `timeseries?id=${candidate.item.id}`,
    );
    historyByItemId.set(
      candidate.item.id,
      response.data.map((point) => ({
        timestamp: point.timestamp,
        avgHighPrice: point.avgHighPrice ?? null,
        avgLowPrice: point.avgLowPrice ?? null,
        highPriceVolume: point.highPriceVolume ?? null,
        lowPriceVolume: point.lowPriceVolume ?? null,
      })),
    );
  }

  const items = marketItems.map(({ item, latestPrice, fiveMinutePrice }) => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    members: item.members,
    buyLimit: item.limit ?? null,
    high: latestPrice?.high ?? null,
    highTime: latestPrice?.highTime ?? null,
    low: latestPrice?.low ?? null,
    lowTime: latestPrice?.lowTime ?? null,
    avgHighPrice: fiveMinutePrice?.avgHighPrice ?? null,
    avgLowPrice: fiveMinutePrice?.avgLowPrice ?? null,
    highPriceVolume: fiveMinutePrice?.highPriceVolume ?? null,
    lowPriceVolume: fiveMinutePrice?.lowPriceVolume ?? null,
    history: historyByItemId.get(item.id) ?? null,
  }));

  const latestAsOf = items.reduce((latestTime, item) => {
    const itemTime = Math.max(item.highTime ?? 0, item.lowTime ?? 0);
    return Math.max(latestTime, itemTime);
  }, 0);

  const snapshot = parseResponse(
    osrsMarketSnapshotSchema,
    {
      schemaVersion: 2,
      source: 'OSRS Wiki Real-time Prices API',
      sourceUrl,
      generatedAt: new Date().toISOString(),
      latestAsOf: latestAsOf || null,
      fiveMinuteTimestamp: fiveMinute.timestamp,
      mappingItemCount: mapping.length,
      quotedItemCount: items.filter((item) => item.high !== null || item.low !== null).length,
      items,
    },
    'instantané local',
  );

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(snapshot)}\n`, 'utf8');

  console.info(
    `Instantané OSRS écrit : ${snapshot.mappingItemCount} items, ${snapshot.quotedItemCount} avec une cotation, généré à ${snapshot.generatedAt}.`,
  );
}

try {
  await refreshMarketSnapshot();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (required) {
    console.error(`Échec du rafraîchissement des prix : ${message}`);
    process.exitCode = 1;
  } else {
    console.warn(`Rafraîchissement ignoré : ${message}`);
    console.warn('L’application utilisera l’instantané existant ou son fichier vide.');
  }
}
