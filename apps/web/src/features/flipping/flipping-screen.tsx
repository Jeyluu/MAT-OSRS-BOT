import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Gem,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { OsrsMarketItem, OsrsMarketSnapshot } from '@/data/osrs-market-schema.mjs';
import { EmptyState, formatGp, PageHeading, StatCard } from '@/features/shared';
import { useOsrsMarketSnapshot } from './use-osrs-market';

type MembershipFilter = 'Tous' | 'Gratuits' | 'Membres';
const membershipFilters: readonly MembershipFilter[] = ['Tous', 'Gratuits', 'Membres'];
const visibleItemLimit = 30;

function lastTradeTimestamp(item: OsrsMarketItem) {
  return Math.max(item.highTime ?? 0, item.lowTime ?? 0) || null;
}

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) return 'Aucune transaction récente';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp * 1000);
}

function formatTimeAgo(timestamp: number | null) {
  if (!timestamp) return 'Aucune cotation';

  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds < 60) return 'à l’instant';
  if (ageSeconds < 3600) return `il y a ${Math.floor(ageSeconds / 60)} min`;
  if (ageSeconds < 86_400) return `il y a ${Math.floor(ageSeconds / 3600)} h`;
  return `il y a ${Math.floor(ageSeconds / 86_400)} j`;
}

function formatSnapshotAge(generatedAt: string | null) {
  if (!generatedAt) return 'En attente d’un premier instantané';

  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(generatedAt)) / 60_000));
  if (ageMinutes < 1) return 'Mis à jour à l’instant';
  if (ageMinutes < 60) return `Mis à jour il y a ${ageMinutes} min`;
  return `Mis à jour ${formatTimestamp(Date.parse(generatedAt) / 1000)}`;
}

function PriceValue({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="tabular-nums text-foreground">{formatGp(value)} GP</span>
  );
}

function MarketItemRow({
  item,
  selected,
  onSelect,
}: {
  item: OsrsMarketItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const latestTrade = lastTradeTimestamp(item);

  return (
    <tr
      className={`transition-colors ${selected ? 'bg-primary/[0.055]' : 'hover:bg-background/60'}`}
    >
      <td className="px-5 py-3.5">
        <button
          aria-pressed={selected}
          className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onSelect}
          type="button"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.08] text-primary">
            <Gem aria-hidden="true" size={16} />
          </span>
          <span>
            <span className="block text-xs font-semibold text-foreground">{item.name}</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {item.members ? 'Membres' : 'Gratuit'} <span className="px-1 text-border">·</span> ID{' '}
              {item.id}
            </span>
          </span>
        </button>
      </td>
      <td className="px-3 py-3.5 text-xs">
        <PriceValue value={item.low} />
      </td>
      <td className="px-3 py-3.5 text-xs">
        <PriceValue value={item.high} />
      </td>
      <td className="px-3 py-3.5 text-xs text-muted-foreground">{formatTimeAgo(latestTrade)}</td>
      <td className="px-5 py-3.5 text-xs tabular-nums text-muted-foreground">
        {item.buyLimit === null ? '—' : item.buyLimit.toLocaleString('fr-FR')}
      </td>
    </tr>
  );
}

function QuoteDetail({
  icon: Icon,
  title,
  value,
  timestamp,
}: {
  icon: typeof ArrowDownToLine;
  title: string;
  value: number | null | undefined;
  timestamp: number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
      <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="text-primary" size={13} />
        {title}
      </div>
      <p className="mt-2 text-base font-semibold tracking-tight">
        <PriceValue value={value} />
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{formatTimestamp(timestamp)}</p>
    </div>
  );
}

function SnapshotLoading() {
  return (
    <div aria-label="Chargement des données de marché" className="space-y-4" role="status">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-border/70 bg-card/60"
            key={key}
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl border border-border/70 bg-card/50" />
    </div>
  );
}

function MarketDataNotice({ snapshot }: { snapshot: OsrsMarketSnapshot }) {
  const isRecent = snapshot.generatedAt
    ? Date.now() - Date.parse(snapshot.generatedAt) < 20 * 60_000
    : false;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:mt-0">
          <Database aria-hidden="true" size={16} />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground">Données réelles · Grand Exchange</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Snapshot OSRS Wiki rafraîchi par GitHub Actions toutes les cinq minutes. Ce sont les
            dernières transactions connues, pas un carnet d’ordres.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
        <span className={`size-1.5 rounded-full ${isRecent ? 'bg-emerald-400' : 'bg-amber-300'}`} />
        <span className="text-[10px] font-medium text-muted-foreground">
          {formatSnapshotAge(snapshot.generatedAt)}
        </span>
      </div>
    </div>
  );
}

function MarketError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-rose-400/20 bg-rose-400/[0.035] p-6">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300">
          <ShieldAlert aria-hidden="true" size={19} />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          Les prix ne sont pas disponibles
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <Button className="mt-5 gap-2" onClick={onRetry} type="button" variant="secondary">
          <RefreshCw aria-hidden="true" size={14} /> Réessayer
        </Button>
      </div>
    </Card>
  );
}

export function FlippingScreen() {
  const {
    data: snapshot,
    error,
    isError,
    isFetching,
    isPending,
    refetch,
  } = useOsrsMarketSnapshot();
  const [search, setSearch] = useState('');
  const [membership, setMembership] = useState<MembershipFilter>('Tous');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const matchingItems = useMemo(() => {
    if (!snapshot) return [];

    const normalizedSearch = search.trim().toLocaleLowerCase('fr');
    const results = snapshot.items.filter((item) => {
      const isQuoted =
        item.high !== null ||
        item.low !== null ||
        item.avgHighPrice !== null ||
        item.avgLowPrice !== null;
      const matchesSearch = item.name.toLocaleLowerCase('fr').includes(normalizedSearch);
      const matchesMembership =
        membership === 'Tous' || (membership === 'Membres' ? item.members : !item.members);
      return matchesSearch && matchesMembership && (normalizedSearch.length > 0 || isQuoted);
    });

    return results.sort((first, second) => {
      const secondTime = lastTradeTimestamp(second) ?? 0;
      const firstTime = lastTradeTimestamp(first) ?? 0;
      return secondTime - firstTime || first.name.localeCompare(second.name, 'fr');
    });
  }, [membership, search, snapshot]);

  const visibleItems = matchingItems.slice(0, visibleItemLimit);
  const selectedItem = matchingItems.find((item) => item.id === selectedId) ?? matchingItems[0];
  const hasMarketData = Boolean(snapshot && snapshot.mappingItemCount > 0 && snapshot.generatedAt);

  if (isPending) return <SnapshotLoading />;
  if (isError) {
    return (
      <MarketError
        message={error instanceof Error ? error.message : 'Une erreur réseau est survenue.'}
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <>
      <PageHeading
        action={
          <Button
            className="w-fit gap-2"
            disabled={isFetching}
            onClick={() => void refetch()}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className={isFetching ? 'animate-spin' : ''} size={14} />
            {isFetching ? 'Actualisation…' : 'Actualiser'}
          </Button>
        }
        description="Parcours les dernières cotations connues, les moyennes et les volumes du Grand Exchange. Les recommandations de profit seront ajoutées à l’étape flipping."
        eyebrow="GRAND EXCHANGE / DONNÉES DE MARCHÉ"
        title="Les prix, à la source."
      />

      <MarketDataNotice snapshot={snapshot} />

      <section aria-label="État des données de marché" className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          detail="d’après le mapping officiel"
          label="Items référencés"
          value={snapshot.mappingItemCount.toLocaleString('fr-FR')}
        />
        <StatCard
          detail="avec au moins une cotation récente"
          label="Items cotés"
          value={snapshot.quotedItemCount.toLocaleString('fr-FR')}
        />
        <StatCard
          detail={
            snapshot.fiveMinuteTimestamp
              ? 'agrégat OSRS Wiki 5 min'
              : 'en attente du premier agrégat'
          }
          label="Fenêtre de volume"
          value={snapshot.fiveMinuteTimestamp ? formatTimestamp(snapshot.fiveMinuteTimestamp) : '—'}
        />
      </section>

      {!hasMarketData && (
        <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">
          Aucun instantané de prix n’a encore été généré. En local, lance{' '}
          <code className="rounded bg-background/70 px-1.5 py-0.5 text-amber-100">
            npm run refresh:market
          </code>{' '}
          ; sur GitHub Pages, le workflow le prépare avant publication.
        </div>
      )}

      <section
        aria-label="Explorateur du marché"
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]"
      >
        <Card className="overflow-hidden border-border/80 bg-card/60">
          <div className="flex flex-col gap-4 border-b border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Cotations récentes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {matchingItems.length.toLocaleString('fr-FR')} résultats · triés par dernière
                transaction
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <label className="relative block min-w-0 flex-1 min-[420px]:w-48">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <input
                  aria-label="Rechercher un item OSRS"
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un item"
                  type="search"
                  value={search}
                />
              </label>
              <select
                aria-label="Filtrer par type de compte"
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                onChange={(event) => setMembership(event.target.value as MembershipFilter)}
                value={membership}
              >
                {membershipFilters.map((filter) => (
                  <option key={filter} value={filter}>
                    {filter}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visibleItems.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-3 py-3 font-medium">Low · vente rapide</th>
                    <th className="px-3 py-3 font-medium">High · achat rapide</th>
                    <th className="px-3 py-3 font-medium">Dernier trade</th>
                    <th className="px-5 py-3 font-medium">Limite GE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {visibleItems.map((item) => (
                    <MarketItemRow
                      item={item}
                      key={item.id}
                      onSelect={() => setSelectedId(item.id)}
                      selected={selectedItem?.id === item.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState message="Aucun item ne correspond à cette recherche. Vérifie l’orthographe ou change le filtre d’accès." />
            </div>
          )}
          <div className="flex flex-col gap-1 border-t border-border/70 px-5 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Affichage de {visibleItems.length} sur {matchingItems.length.toLocaleString('fr-FR')}
            </span>
            <a
              className="inline-flex w-fit items-center gap-1.5 rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={snapshot.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source : OSRS Wiki <ExternalLink aria-hidden="true" size={11} />
            </a>
          </div>
        </Card>

        {selectedItem ? (
          <Card className="border-border/80 bg-card/60 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-primary">
                  Cotation du marché
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{selectedItem.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedItem.members ? 'Objet membres' : 'Objet gratuit'}{' '}
                  <span className="px-1 text-border">·</span> ID {selectedItem.id}
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
                <Gem aria-hidden="true" size={19} />
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <QuoteDetail
                icon={ArrowDownToLine}
                title="Low · dernière vente rapide"
                timestamp={selectedItem.lowTime}
                value={selectedItem.low}
              />
              <QuoteDetail
                icon={ArrowUpFromLine}
                title="High · dernier achat rapide"
                timestamp={selectedItem.highTime}
                value={selectedItem.high}
              />
            </div>

            <div className="mt-5 rounded-xl border border-border/70 bg-background/45 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                  Moyenne des 5 dernières minutes
                </p>
                <Clock3 aria-hidden="true" className="text-primary" size={14} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Moy. high</p>
                  <p className="mt-1 text-sm font-semibold">
                    <PriceValue value={selectedItem.avgHighPrice} />
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Volume {selectedItem.highPriceVolume?.toLocaleString('fr-FR') ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Moy. low</p>
                  <p className="mt-1 text-sm font-semibold">
                    <PriceValue value={selectedItem.avgLowPrice} />
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Volume {selectedItem.lowPriceVolume?.toLocaleString('fr-FR') ?? '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Limite d’achat indiquée</span>
                <span className="font-medium tabular-nums text-foreground">
                  {selectedItem.buyLimit === null
                    ? 'Non fournie'
                    : `${selectedItem.buyLimit.toLocaleString('fr-FR')} unités`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Trade le plus récent</span>
                <span className="font-medium text-foreground">
                  {formatTimeAgo(lastTradeTimestamp(selectedItem))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Instantané généré</span>
                <span className="font-medium text-foreground">
                  {formatTimestamp(
                    snapshot.generatedAt ? Date.parse(snapshot.generatedAt) / 1000 : null,
                  )}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2 rounded-lg bg-background/60 p-3 text-[10px] leading-4 text-muted-foreground">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={14} />
              Ce sont des transactions récentes agrégées, pas des ordres garantis au même prix.
              Profit et risque seront calculés dans la phase flipping.
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <EmptyState message="Aucune cotation à détailler pour le moment." />
          </Card>
        )}
      </section>

      {snapshot.latestAsOf && (
        <p className="mt-6 flex items-center gap-2 text-[11px] leading-5 text-muted-foreground">
          <Clock3 aria-hidden="true" className="shrink-0 text-primary" size={13} />
          Dernière transaction incluse dans le snapshot : {formatTimestamp(snapshot.latestAsOf)}.
        </p>
      )}
    </>
  );
}
