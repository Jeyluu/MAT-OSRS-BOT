import type { MerchRiskLevel, MerchStrategy, RankedMerchOpportunity } from '@osrs-helper/core';
import { rankMerchOpportunities } from '@osrs-helper/core';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  Database,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { OsrsMarketSnapshot } from '@/data/osrs-market-schema.mjs';
import { OsrsItemIcon } from '@/features/osrs-item-icon';
import { loadProfilePreferences } from '@/features/profile/profile-storage';
import { EmptyState, formatGp, PageHeading, StatCard } from '@/features/shared';
import { useOsrsMarketSnapshot } from './use-osrs-market';

type MembershipFilter = 'Tous' | 'Gratuits' | 'Membres';
type RiskFilter = 'Tous' | MerchRiskLevel;
const membershipFilters: readonly MembershipFilter[] = ['Tous', 'Gratuits', 'Membres'];
const riskFilters: readonly RiskFilter[] = ['Tous', 'Faible', 'Modéré', 'Élevé'];
const strategyLabels: Record<MerchStrategy, string> = {
  Prudente: 'Prudente',
  Équilibrée: 'Équilibrée',
  Agressive: 'Agressive',
};

function formatGpValue(value: number) {
  return `${formatGp(value)} GP`;
}

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) return 'Aucune transaction récente';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp * 1_000);
}

function formatAge(timestamp: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1_000) - timestamp);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3_600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86_400) return `il y a ${Math.floor(seconds / 3_600)} h`;
  return `il y a ${Math.floor(seconds / 86_400)} j`;
}

function formatSnapshotAge(generatedAt: string | null) {
  if (!generatedAt) return 'En attente du premier instantané';
  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(generatedAt)) / 60_000));
  if (ageMinutes < 1) return "Mis à jour à l'instant";
  if (ageMinutes < 60) return `Mis à jour il y a ${ageMinutes} min`;
  return `Mis à jour ${formatTimestamp(Date.parse(generatedAt) / 1_000)}`;
}

function riskClass(level: MerchRiskLevel) {
  if (level === 'Faible') return 'bg-emerald-400/10 text-emerald-300';
  if (level === 'Modéré') return 'bg-amber-300/10 text-amber-200';
  return 'bg-rose-400/10 text-rose-300';
}

function LoadingState() {
  return (
    <div aria-label="Chargement des opportunités" className="space-y-4" role="status">
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

function SnapshotNotice({ snapshot }: { snapshot: OsrsMarketSnapshot }) {
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
          <p className="text-xs font-semibold text-foreground">Prix réels · Grand Exchange</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            OSRS Wiki met à jour les transactions et les volumes. Les prix sont indicatifs : aucune
            offre n’est garantie.
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

function OpportunityRow({
  ranked,
  icon,
  selected,
  onSelect,
}: {
  ranked: RankedMerchOpportunity;
  icon: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const { opportunity } = ranked;
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
          <OsrsItemIcon
            className="size-9 shrink-0 rounded-lg border border-primary/15 bg-primary/[0.08] text-primary"
            icon={icon}
            name={opportunity.item.name}
          />
          <span>
            <span className="block text-xs font-semibold text-foreground">
              {opportunity.item.name}
            </span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {opportunity.item.members ? 'Membres' : 'Gratuit'} · ID {opportunity.item.id}
            </span>
          </span>
        </button>
      </td>
      <td className="px-3 py-3.5 text-xs tabular-nums text-foreground">
        {formatGpValue(opportunity.buyPrice)}
      </td>
      <td className="px-3 py-3.5 text-xs tabular-nums text-foreground">
        {formatGpValue(opportunity.netSellPrice)}
      </td>
      <td className="px-3 py-3.5 text-xs font-semibold tabular-nums text-emerald-300">
        +{formatGpValue(opportunity.profitPerItem)}
        <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
          {opportunity.roiPercent.toFixed(1)} % · {ranked.quantity.toLocaleString('fr-FR')} unités
        </span>
      </td>
      <td className="px-3 py-3.5 text-xs font-semibold tabular-nums text-foreground">
        {formatGpValue(ranked.estimatedTotalProfit)}
      </td>
      <td className="px-3 py-3.5">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-medium ${riskClass(ranked.riskLevel)}`}
        >
          {ranked.riskLevel}
        </span>
        <span className="mt-1 block text-[10px] tabular-nums text-muted-foreground">
          Score {ranked.score}
        </span>
      </td>
    </tr>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function HistorySparkline({ history }: { history: RankedMerchOpportunity['history'] }) {
  const values = history
    .map((point) =>
      point.avgHighPrice !== null && point.avgLowPrice !== null
        ? (point.avgHighPrice + point.avgLowPrice) / 2
        : null,
    )
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg bg-background/60 text-[10px] text-muted-foreground">
        Historique insuffisant pour tracer une tendance.
      </div>
    );
  }

  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 300;
      const y = 58 - ((value - minimum) / range) * 48;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      aria-label="Tendance moyenne des prix sur six heures"
      className="h-20 w-full"
      role="img"
      viewBox="0 0 300 64"
    >
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        className="text-primary"
      />
    </svg>
  );
}

function OpportunityDetail({
  ranked,
  strategy,
  icon,
}: {
  ranked: RankedMerchOpportunity;
  strategy: MerchStrategy;
  icon: string | undefined;
}) {
  const { opportunity } = ranked;
  const oldestQuote = Math.floor(opportunity.oldestQuoteTime / 1_000);

  return (
    <Card className="border-border/80 bg-card/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-primary">
            Opportunité calculée
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">{opportunity.item.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {opportunity.item.members ? 'Objet membres' : 'Objet gratuit'} · ID{' '}
            {opportunity.item.id}
          </p>
        </div>
        <OsrsItemIcon
          className="size-11 shrink-0 rounded-xl border border-primary/15 bg-primary/[0.08] text-primary"
          icon={icon}
          name={opportunity.item.name}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 p-3.5">
        <div>
          <p className="text-[10px] text-muted-foreground">
            Score · stratégie {strategy.toLocaleLowerCase('fr')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {ranked.score}
            <span className="ml-1 text-xs text-muted-foreground">/ 100</span>
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1.5 text-[10px] font-medium ${riskClass(ranked.riskLevel)}`}
        >
          Risque {ranked.riskLevel.toLocaleLowerCase('fr')}
        </span>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ArrowDownToLine aria-hidden="true" className="text-primary" size={14} /> Achat estimé ·
          prix low
          <span className="ml-auto tabular-nums">{formatGpValue(opportunity.buyPrice)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ArrowUpFromLine aria-hidden="true" className="text-primary" size={14} /> Vente après taxe
          · prix high
          <span className="ml-auto tabular-nums">{formatGpValue(opportunity.netSellPrice)}</span>
        </div>
        <div className="border-t border-border/70 pt-3">
          <DetailMetric
            label="Prix de vente avant taxe"
            value={formatGpValue(opportunity.sellPrice)}
          />
          <div className="mt-2">
            <DetailMetric
              label="Taxe GE (exemptions et plafond inclus)"
              value={`−${formatGpValue(opportunity.geTaxPerItem)}`}
            />
          </div>
          <div className="mt-2">
            <DetailMetric
              label="Profit net unitaire"
              value={`+${formatGpValue(opportunity.profitPerItem)}`}
            />
          </div>
          <div className="mt-2">
            <DetailMetric label="ROI net estimé" value={`${opportunity.roiPercent.toFixed(2)} %`} />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Wallet aria-hidden="true" className="text-primary" size={14} /> Budget du profil
          <span className="ml-auto tabular-nums">{formatGpValue(ranked.capitalRequired)}</span>
        </div>
        <DetailMetric
          label="Quantité estimée"
          value={`${ranked.quantity.toLocaleString('fr-FR')} unités`}
        />
        <DetailMetric
          label="Limite d’achat GE"
          value={
            opportunity.buyLimit === null
              ? 'Non fournie'
              : `${opportunity.buyLimit.toLocaleString('fr-FR')} unités`
          }
        />
        <DetailMetric
          label="Profit total estimé"
          value={`+${formatGpValue(ranked.estimatedTotalProfit)}`}
        />
        <DetailMetric
          label="Utilisation du capital"
          value={`${ranked.capitalUsePercent.toFixed(1)} %`}
        />
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-background/45 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Historique · 6 heures</p>
          <Activity aria-hidden="true" className="text-primary" size={14} />
        </div>
        <div className="mt-2">
          <HistorySparkline history={ranked.history} />
        </div>
        <div className="mt-2 space-y-2">
          <DetailMetric
            label="Volatilité (écart-type des variations 5 min)"
            value={
              ranked.volatilityPercent === null
                ? 'Données insuffisantes'
                : `${ranked.volatilityPercent.toFixed(2)} %`
            }
          />
          <DetailMetric
            label="Volume agrégé observé"
            value={`${ranked.volume6h.toLocaleString('fr-FR')} transactions côté prix`}
          />
          <DetailMetric label="Liquidité calculée" value={`${ranked.liquidityScore} / 100`} />
          <DetailMetric
            label="Dernière cotation"
            value={`${formatAge(oldestQuote)} · ${ranked.freshnessScore} / 100`}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-background/60 p-3 text-[10px] leading-4 text-muted-foreground">
        Le score pondère profit, ROI, liquidité, stabilité, fraîcheur et utilisation du capital. Les
        volumes additionnent les deux types d’agrégats OSRS Wiki ; ils ne représentent pas un carnet
        d’ordres. Les prix high/low sont des transactions passées, la taxe peut varier selon
        l’objet.
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
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('Tous');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const profile = useMemo(() => loadProfilePreferences(), []);
  const iconsById = useMemo(
    () => new Map(snapshot?.items.map((item) => [item.id, item.icon] as const) ?? []),
    [snapshot],
  );

  const rankedItems = useMemo(() => {
    if (!snapshot || profile.capitalGp <= 0) return [];
    return rankMerchOpportunities(
      snapshot.items.map((item) => ({
        item: {
          id: item.id,
          name: item.name,
          members: item.members,
          limit: item.buyLimit,
        },
        latestPrice: {
          high: item.high ?? null,
          highTime: item.highTime ?? null,
          low: item.low ?? null,
          lowTime: item.lowTime ?? null,
        },
        fiveMinutePrice: {
          avgHighPrice: item.avgHighPrice ?? null,
          avgLowPrice: item.avgLowPrice ?? null,
          highPriceVolume: item.highPriceVolume ?? null,
          lowPriceVolume: item.lowPriceVolume ?? null,
        },
        history: item.history,
      })),
      { capitalGp: profile.capitalGp, strategy: profile.strategy },
    );
  }, [profile, snapshot]);

  const matchingItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('fr');
    return rankedItems.filter(({ opportunity, riskLevel }) => {
      const matchesSearch = opportunity.item.name
        .toLocaleLowerCase('fr')
        .includes(normalizedSearch);
      const matchesMembership =
        membership === 'Tous' ||
        (membership === 'Membres' ? opportunity.item.members : !opportunity.item.members);
      const matchesRisk = riskFilter === 'Tous' || riskLevel === riskFilter;
      return matchesSearch && matchesMembership && matchesRisk;
    });
  }, [membership, riskFilter, rankedItems, search]);

  const selectedItem =
    matchingItems.find(({ opportunity }) => opportunity.item.id === selectedId) ?? matchingItems[0];

  if (isPending) return <LoadingState />;
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
        description="Classe les marges potentielles avec la taxe GE, ton capital, la limite d’achat, les volumes et la volatilité récente."
        eyebrow="GRAND EXCHANGE / OPPORTUNITÉS"
        title="Des marges, avec leur risque."
      />

      <SnapshotNotice snapshot={snapshot} />

      <section aria-label="Résumé du calcul" className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          detail={`stratégie ${strategyLabels[profile.strategy]}`}
          label="Capital disponible"
          value={profile.capitalGp ? `${formatGp(profile.capitalGp)} GP` : 'À renseigner'}
        />
        <StatCard
          detail="profit après taxe GE"
          label="Opportunités classées"
          value={rankedItems.length.toLocaleString('fr-FR')}
        />
        <StatCard
          detail="séries OSRS Wiki · fenêtre 6 h"
          label="Séries collectées"
          value={snapshot.items
            .filter((item) => item.history !== null)
            .length.toLocaleString('fr-FR')}
        />
      </section>

      {profile.capitalGp <= 0 && (
        <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">
          Renseigne ton capital dans Profil pour calculer une quantité achetable et classer les
          opportunités.
        </div>
      )}
      {profile.capitalGp > 0 && rankedItems.length === 0 && (
        <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">
          Aucune opportunité ne passe les contrôles de prix frais, profit positif, capital et volume
          et d'historique suffisant (au moins 12 variations). Le snapshot est rafraîchi
          automatiquement toutes les cinq minutes.
        </div>
      )}

      <section
        aria-label="Classement des opportunités"
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]"
      >
        <Card className="overflow-hidden border-border/80 bg-card/60">
          <div className="flex flex-col gap-4 border-b border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Meilleures marges estimées</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {matchingItems.length.toLocaleString('fr-FR')} résultats · score{' '}
                {strategyLabels[profile.strategy].toLocaleLowerCase('fr')}
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap">
              <label className="relative block min-w-0 flex-1 min-[420px]:w-40">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={14}
                />
                <input
                  aria-label="Rechercher un item OSRS"
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher"
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
              <select
                aria-label="Filtrer par risque"
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
                value={riskFilter}
              >
                {riskFilters.map((filter) => (
                  <option key={filter} value={filter}>
                    {filter === 'Tous'
                      ? 'Tous risques'
                      : `Risque ${filter.toLocaleLowerCase('fr')}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {matchingItems.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-background/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-3 py-3 font-medium">Achat estimé</th>
                    <th className="px-3 py-3 font-medium">Vente nette</th>
                    <th className="px-3 py-3 font-medium">Marge · ROI · quantité</th>
                    <th className="px-3 py-3 font-medium">Profit total</th>
                    <th className="px-3 py-3 font-medium">Risque · score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {matchingItems.map((ranked) => (
                    <OpportunityRow
                      icon={iconsById.get(ranked.opportunity.item.id)}
                      key={ranked.opportunity.item.id}
                      onSelect={() => setSelectedId(ranked.opportunity.item.id)}
                      ranked={ranked}
                      selected={selectedItem?.opportunity.item.id === ranked.opportunity.item.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                message={
                  rankedItems.length
                    ? 'Aucune opportunité ne correspond à ces filtres.'
                    : 'Aucun retournement rentable et suffisamment liquide dans les données actuelles.'
                }
              />
            </div>
          )}
          <div className="flex flex-col gap-1 border-t border-border/70 px-5 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Classement indicatif · données toutes les 5 min</span>
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
          <OpportunityDetail
            icon={iconsById.get(selectedItem.opportunity.item.id)}
            ranked={selectedItem}
            strategy={profile.strategy}
          />
        ) : (
          <Card className="border-border/80 bg-card/60 p-5">
            <EmptyState
              message={
                profile.capitalGp <= 0
                  ? 'Renseigne ton capital dans Profil pour voir les quantités achetables.'
                  : 'Aucune opportunité à détailler pour le moment.'
              }
            />
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
              <Clock3 aria-hidden="true" className="text-primary" size={13} /> Les cotations doivent
              dater de moins de 15 minutes.
            </div>
          </Card>
        )}
      </section>
    </>
  );
}
