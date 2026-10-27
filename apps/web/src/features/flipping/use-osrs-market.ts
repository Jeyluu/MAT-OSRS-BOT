import { useQuery } from '@tanstack/react-query';
import type { OsrsMarketSnapshot } from '@/data/osrs-market-schema.mjs';
import { osrsMarketSnapshotSchema } from '@/data/osrs-market-schema.mjs';

const marketSnapshotQueryKey = ['osrs-market', 'snapshot'] as const;

async function fetchSnapshotFile(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Impossible de lire le fichier de marché (${response.status}).`);
  }

  const body: unknown = await response.json();
  const result = osrsMarketSnapshotSchema.safeParse(body);
  if (!result.success) {
    throw new Error('Le fichier de marché reçu ne respecte pas le format attendu.');
  }

  return result.data;
}

async function fetchOsrsMarketSnapshot(): Promise<OsrsMarketSnapshot> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/osrs-market.json`, {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return fetchSnapshotFile('osrs-market.template.json');
  }

  if (!response.ok) {
    throw new Error(`Le snapshot du marché est indisponible (${response.status}).`);
  }

  const body: unknown = await response.json();
  const result = osrsMarketSnapshotSchema.safeParse(body);
  if (!result.success) {
    throw new Error('Le snapshot reçu ne respecte pas le format attendu.');
  }

  return result.data;
}

export function useOsrsMarketSnapshot() {
  return useQuery({
    queryKey: marketSnapshotQueryKey,
    queryFn: fetchOsrsMarketSnapshot,
    staleTime: 4 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
