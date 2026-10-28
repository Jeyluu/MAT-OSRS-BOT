import type { SkillingMethodResult, SkillingPlayStyle } from '@osrs-helper/core';
import { calculateSkillingMethod, recommendSkillingMethods } from '@osrs-helper/core';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Coins,
  ExternalLink,
  Leaf,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { OsrsMarketSnapshot } from '@/data/osrs-market-schema.mjs';
import { useOsrsMarketSnapshot } from '@/features/flipping/use-osrs-market';
import { loadProfilePreferences } from '@/features/profile/profile-storage';
import { EmptyState, formatGp, formatGpCompact, PageHeading, StatCard } from '@/features/shared';
import { skillingMethods, skillingSkills } from './skilling-catalog';
import { loadSkillingLevels, saveSkillingLevels } from './skilling-levels';

type StyleFilter = 'Toutes' | SkillingPlayStyle;
const styleFilters: readonly StyleFilter[] = ['Toutes', 'AFK', 'Actif'];

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value);
}

function formatSnapshotTime(snapshot: OsrsMarketSnapshot) {
  if (!snapshot.generatedAt) return 'En attente du premier snapshot';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(Date.parse(snapshot.generatedAt));
}

function MarketStatus({ snapshot }: { snapshot: OsrsMarketSnapshot }) {
  const fresh = snapshot.generatedAt
    ? Date.now() - Date.parse(snapshot.generatedAt) <= 20 * 60_000
    : false;
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity aria-hidden="true" size={16} />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground">
            Calculs avec les prix réels du Grand Exchange
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            Achat des ingrédients au dernier prix high, revente des produits au dernier prix low,
            taxe GE déduite.
          </p>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-2 pl-11 text-[10px] text-muted-foreground sm:pl-0">
        <span className={`size-1.5 rounded-full ${fresh ? 'bg-emerald-400' : 'bg-amber-300'}`} />
        Prix rafraîchis · {formatSnapshotTime(snapshot)}
      </span>
    </div>
  );
}

function MethodStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | undefined;
}) {
  return (
    <div className="rounded-lg bg-card/80 p-2.5">
      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`mt-1 block text-xs font-semibold tabular-nums ${tone === 'profit' ? 'text-emerald-300' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

function ResultCard({ result, index }: { result: SkillingMethodResult; index: number }) {
  const { method, inputs, outputs } = result;
  return (
    <details className="group rounded-xl border border-border/80 bg-background/45 open:border-primary/25 open:bg-background/70">
      <summary className="list-none cursor-pointer p-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${index === 0 ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
            >
              {method.style === 'AFK' ? (
                <Leaf aria-hidden="true" size={17} />
              ) : (
                <Zap aria-hidden="true" size={17} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{method.name}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {method.skill} · niveau {method.requiredLevel}+ · {method.style}
              </span>
            </span>
          </div>
          <span className="text-right text-[10px] text-muted-foreground">Détails</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{method.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MethodStat
            label="GP net / h"
            tone={result.gpPerHour !== null && result.gpPerHour >= 0 ? 'profit' : undefined}
            value={`${result.gpPerHour !== null && result.gpPerHour > 0 ? '+' : ''}${formatGpCompact(result.gpPerHour ?? 0)} GP`}
          />
          <MethodStat label="XP / h" value={`${formatGpCompact(result.xpPerHour ?? 0)} XP`} />
          <MethodStat
            label="Capital · 1 lot"
            value={`${formatGpCompact(result.capitalRequired ?? 0)} GP`}
          />
          <MethodStat
            label="Cadence source"
            value={`${formatNumber(result.actionsPerHour)} actions/h`}
          />
        </div>
      </summary>

      <div className="grid gap-5 border-t border-border/70 px-4 pb-4 pt-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ressources · achat au prix high
          </h3>
          {inputs.length ? (
            <ul className="mt-2 space-y-2 text-xs">
              {inputs.map((input) => (
                <li className="flex items-start justify-between gap-3" key={input.itemId}>
                  <span className="text-foreground">
                    {input.name}{' '}
                    <span className="text-muted-foreground">
                      · {formatNumber(input.totalPerHour)} / h
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                    {formatGp(input.unitPrice)} GP / unité
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Aucun consommable tarifé; l’équipement n’est pas compté.
            </p>
          )}
          <p className="mt-3 text-[10px] text-muted-foreground">
            Coût estimé : {formatGp(result.inputCostPerHour ?? 0)} GP/h
          </p>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Produits · vente au prix low
          </h3>
          <ul className="mt-2 space-y-2 text-xs">
            {outputs.map((output) => (
              <li className="flex items-start justify-between gap-3" key={output.itemId}>
                <span className="text-foreground">
                  {output.name}{' '}
                  <span className="text-muted-foreground">
                    · {formatNumber(output.totalPerHour)} / h
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                  {formatGp(output.netUnitPrice)} GP net / unité
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Revente nette estimée : {formatGp(result.outputRevenuePerHour ?? 0)} GP/h
          </p>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prérequis
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-foreground">
            {method.requirements.map((requirement) => (
              <li key={requirement}>· {requirement}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Étapes
          </h3>
          <ol className="mt-2 space-y-1.5 text-xs leading-5 text-foreground">
            {method.steps.map((step, stepIndex) => (
              <li key={step}>
                <span className="mr-2 text-primary">{stepIndex + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="sm:col-span-2 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
          <p className="text-[10px] leading-4 text-muted-foreground">
            Hypothèses : {method.assumptions.join(' ')}
          </p>
          <a
            className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-primary hover:underline"
            href={method.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Source de la cadence : {method.sourceLabel}{' '}
            <ExternalLink aria-hidden="true" size={11} />
          </a>
        </div>
      </div>
    </details>
  );
}

function IncompleteCard({ result }: { result: SkillingMethodResult }) {
  const { method } = result;
  return (
    <details className="rounded-xl border border-amber-300/15 bg-amber-300/[0.025] p-4">
      <summary className="cursor-pointer list-none text-xs font-semibold text-foreground">
        <span className="inline-flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="text-amber-200" size={14} />
          {method.name}
        </span>
        <span className="mt-1 block pl-6 text-[10px] font-normal text-muted-foreground">
          {method.skill} · niveau {method.requiredLevel}+ · GP/h non calculé
        </span>
      </summary>
      <div className="mt-3 space-y-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
        <p>{result.reasons.join(' ')}</p>
        {result.xpPerHour !== null && (
          <p>Référence XP/h documentée : {formatGpCompact(result.xpPerHour)} XP.</p>
        )}
        {method.referenceYieldPerPatch !== undefined && method.growthCycleMinutes !== undefined && (
          <p>
            Référence distincte : {method.referenceYieldPerPatch} produits par patch au niveau et
            avec l’équipement de la source; cycle de {method.growthCycleMinutes} minutes. Ce n’est
            pas un GP/h.
          </p>
        )}
        <ul className="space-y-1 text-foreground">
          {method.requirements.map((requirement) => (
            <li key={requirement}>· {requirement}</li>
          ))}
        </ul>
        <a
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
          href={method.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Source : {method.sourceLabel} <ExternalLink aria-hidden="true" size={11} />
        </a>
      </div>
    </details>
  );
}

function LoadingState() {
  return (
    <div aria-label="Chargement des prix de marché" className="space-y-4" role="status">
      <div className="h-16 animate-pulse rounded-xl border border-border/70 bg-card/60" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-border/70 bg-card/60"
            key={item}
          />
        ))}
      </div>
    </div>
  );
}

export function SkillingScreen() {
  const {
    data: snapshot,
    error,
    isError,
    isFetching,
    isPending,
    refetch,
  } = useOsrsMarketSnapshot();
  const profile = useMemo(() => loadProfilePreferences(), []);
  const [levels, setLevels] = useState(() => loadSkillingLevels(skillingSkills));
  const [levelSkill, setLevelSkill] = useState(skillingSkills[0] ?? 'Cuisine');
  const [skillFilter, setSkillFilter] = useState('Toutes');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>(profile.skillingStyle);
  const [search, setSearch] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const market = useMemo(() => {
    if (!snapshot) return new Map();
    return new Map(
      snapshot.items.map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          high: item.high ?? null,
          highTime: item.highTime ?? null,
          low: item.low ?? null,
          lowTime: item.lowTime ?? null,
        },
      ]),
    );
  }, [snapshot]);

  const calculatedMethods = useMemo(
    () =>
      skillingMethods.map((method) =>
        calculateSkillingMethod(method, market, {
          skillLevel: levels[method.skill] ?? 1,
        }),
      ),
    [levels, market],
  );

  const recommendations = useMemo(
    () =>
      recommendSkillingMethods(calculatedMethods, {
        capitalGp: profile.capitalGp,
        levels,
        style: styleFilter,
        skill: skillFilter,
      }).filter((result) => {
        const query = search.trim().toLocaleLowerCase('fr');
        return `${result.method.name} ${result.method.skill}`
          .toLocaleLowerCase('fr')
          .includes(query);
      }),
    [calculatedMethods, levels, profile.capitalGp, search, skillFilter, styleFilter],
  );

  const incompleteMethods = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return calculatedMethods.filter(
      (result) =>
        result.status === 'incomplete' &&
        result.method.requiredLevel <= (levels[result.method.skill] ?? 1) &&
        (skillFilter === 'Toutes' || result.method.skill === skillFilter) &&
        (styleFilter === 'Toutes' || result.method.style === styleFilter) &&
        `${result.method.name} ${result.method.skill}`.toLocaleLowerCase('fr').includes(query),
    );
  }, [calculatedMethods, levels, search, skillFilter, styleFilter]);

  const bestProfit = recommendations[0]?.gpPerHour ?? null;
  const bestXp = recommendations.reduce(
    (highest, result) => Math.max(highest, result.xpPerHour ?? 0),
    0,
  );

  const handleLevelChange = (value: string) => {
    const parsed = Number(value);
    const level = Math.min(
      99,
      Math.max(1, Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1),
    );
    const next = { ...levels, [levelSkill]: level };
    setLevels(next);
    setSaveMessage(
      saveSkillingLevels(next)
        ? 'Niveau sauvegardé localement.'
        : 'Impossible d’enregistrer ce niveau dans le navigateur.',
    );
  };

  if (isPending) return <LoadingState />;
  if (isError) {
    return (
      <Card className="border-rose-400/20 bg-rose-400/[0.035] p-6">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <AlertTriangle aria-hidden="true" className="text-rose-300" size={22} />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            Les prix ne sont pas disponibles
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur réseau est survenue.'}
          </p>
          <Button
            className="mt-4 gap-2"
            onClick={() => void refetch()}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={14} /> Réessayer
          </Button>
        </div>
      </Card>
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
        description="Compare les méthodes de récolte et de production avec des cadences sourcées, tes niveaux et ton capital."
        eyebrow="PROGRESSION / SKILLING"
        title="Des méthodes, des prix réels."
      />

      <MarketStatus snapshot={snapshot} />

      <section aria-label="Résumé de progression" className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          detail="renseigné dans Profil"
          label="Capital disponible"
          value={`${formatGp(profile.capitalGp)} GP`}
        />
        <StatCard
          detail="taxe GE déduite des ventes"
          label="Meilleur GP net / h"
          value={
            bestProfit === null
              ? '—'
              : `${bestProfit > 0 ? '+' : ''}${formatGpCompact(bestProfit)} GP`
          }
          {...(bestProfit !== null && bestProfit > 0 ? { trend: 'up' as const } : {})}
        />
        <StatCard
          detail="selon les niveaux et filtres actuels"
          label="Meilleur XP / h"
          value={bestXp ? `${formatGpCompact(bestXp)} XP` : '—'}
        />
      </section>

      <Card className="mb-5 border-border/80 bg-card/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="block space-y-2" htmlFor="skill-level-skill">
              <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <Sparkles aria-hidden="true" className="text-primary" size={14} /> Niveau à modifier
              </span>
              <select
                id="skill-level-skill"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                onChange={(event) => setLevelSkill(event.target.value)}
                value={levelSkill}
              >
                {skillingSkills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2" htmlFor="skill-current-level">
              <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <Activity aria-hidden="true" className="text-primary" size={14} /> Niveau actuel ·
                saisie locale
              </span>
              <span className="flex h-10 items-center rounded-lg border border-border bg-background pr-3 focus-within:border-primary">
                <input
                  className="h-full min-w-0 flex-1 rounded-lg border-0 bg-transparent px-3 text-sm tabular-nums outline-none"
                  id="skill-current-level"
                  max="99"
                  min="1"
                  onChange={(event) => handleLevelChange(event.target.value)}
                  type="number"
                  value={levels[levelSkill] ?? 1}
                />
                <span className="text-xs text-muted-foreground">/ 99</span>
              </span>
            </label>
          </div>
          <div aria-live="polite" className="min-h-4 text-[10px] text-muted-foreground">
            {saveMessage ||
              'Niveaux importés depuis le profil ou ajustés ici; conservés dans ce navigateur.'}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/80 bg-card/60">
        <div className="flex flex-col gap-4 border-b border-border/80 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Méthodes disponibles</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {recommendations.length} recommandation{recommendations.length > 1 ? 's' : ''}{' '}
              complète{recommendations.length > 1 ? 's' : ''} · tri GP/h décroissant
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 flex-1 sm:w-48">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={14}
              />
              <input
                aria-label="Rechercher une méthode ou un skill"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Méthode ou compétence"
                type="search"
                value={search}
              />
            </label>
            <select
              aria-label="Filtrer par compétence"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
              onChange={(event) => setSkillFilter(event.target.value)}
              value={skillFilter}
            >
              <option value="Toutes">Toutes compétences</option>
              {skillingSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par rythme"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
              onChange={(event) => setStyleFilter(event.target.value as StyleFilter)}
              value={styleFilter}
            >
              {styleFilters.map((style) => (
                <option key={style} value={style}>
                  {style === 'Toutes' ? `Profil · ${profile.skillingStyle}` : style}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {recommendations.length ? (
            recommendations.map((result, index) => (
              <ResultCard index={index} key={result.method.id} result={result} />
            ))
          ) : (
            <div className="sm:col-span-2">
              <EmptyState message="Aucune méthode complète ne correspond. Vérifie le niveau local, le capital de ton profil, les prix récents ou les filtres." />
            </div>
          )}
        </div>

        {incompleteMethods.length > 0 && (
          <div className="border-t border-border/70 bg-background/20 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen aria-hidden="true" className="text-amber-200" size={15} />
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Données encore insuffisantes
                </h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Les valeurs manquantes ne sont pas remplacées par des estimations inventées.
                </p>
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {incompleteMethods.map((result) => (
                <IncompleteCard key={result.method.id} result={result} />
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-5 flex flex-col gap-2 text-[10px] leading-4 text-muted-foreground sm:flex-row sm:justify-between">
        <span className="flex items-start gap-2">
          <Coins aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={13} />
          Prix d’achat des ingrédients au high, prix de revente au low; la taxe GE est appliquée par
          unité vendue. Les ventes réelles peuvent différer.
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Wallet aria-hidden="true" className="text-primary" size={13} />
          Capital requis : coût des intrants nécessaires à un lot de la méthode.
        </span>
      </div>
    </>
  );
}
