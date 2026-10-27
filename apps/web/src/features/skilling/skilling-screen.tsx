import {
  ChevronDown,
  Clock3,
  Coins,
  Flame,
  Leaf,
  Pickaxe,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { DemoNotice, EmptyState, formatGpCompact, PageHeading, StatCard } from '@/features/shared';

type PlayStyle = 'AFK' | 'Actif';
type StyleFilter = 'Toutes' | PlayStyle;

interface SkillMethod {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly level: number;
  readonly style: PlayStyle;
  readonly gpPerHour: number;
  readonly xpPerHour: number;
  readonly startingCapital: number;
  readonly description: string;
  readonly materials: readonly string[];
  readonly steps: readonly string[];
  readonly assumptions: string;
}

const demoMethods: readonly SkillMethod[] = [
  {
    id: 'magic-logs',
    name: 'Couper des ifs',
    skill: 'Coupe de bois',
    level: 60,
    style: 'AFK',
    gpPerHour: 128_000,
    xpPerHour: 55_000,
    startingCapital: 5_000,
    description: 'Récolter des bûches d’if dans une zone boisée proche d’une banque.',
    materials: ['Hache adaptée au niveau', 'Quelques emplacements libres'],
    steps: [
      'Équiper la meilleure hache disponible.',
      'Couper les ifs et déposer les bûches à la banque.',
      'Vendre les ressources dans le Grand Exchange.',
    ],
    assumptions: 'Cadence, prix de vente et déplacement sont inventés pour la maquette.',
  },
  {
    id: 'anglerfish',
    name: 'Cuire des poissons-lunes',
    skill: 'Cuisine',
    level: 84,
    style: 'AFK',
    gpPerHour: 92_000,
    xpPerHour: 260_000,
    startingCapital: 1_400_000,
    description: 'Cuire des poissons en lots pour une session régulière avec peu de clics.',
    materials: ['Poissons crus', 'Accès à une cuisinière'],
    steps: [
      'Acheter les ingrédients au prix de l’exemple.',
      'Cuire les poissons par lots.',
      'Vendre le résultat et comptabiliser les pertes brûlées.',
    ],
    assumptions:
      'Taux de brûlure, expérience et marges sont fictifs et ne constituent pas un guide de jeu.',
  },
  {
    id: 'magic-longbow',
    name: 'Empennes des arcs longs en if',
    skill: 'Empennage',
    level: 70,
    style: 'AFK',
    gpPerHour: 245_000,
    xpPerHour: 150_000,
    startingCapital: 820_000,
    description: 'Transformer des ressources en arcs longs et revendre les objets fabriqués.',
    materials: ['Bûches d’if', 'Corde d’arc', 'Couteau'],
    steps: [
      'Acheter les bûches et les cordes.',
      'Tailler les arcs avec le couteau.',
      'Ajouter les cordes puis vendre les arcs.',
    ],
    assumptions:
      'Le rendement par heure et les prix des intrants sont des valeurs de démonstration.',
  },
  {
    id: 'battlestaves',
    name: 'Assembler des bâtons de combat',
    skill: 'Artisanat',
    level: 54,
    style: 'Actif',
    gpPerHour: 185_000,
    xpPerHour: 102_000,
    startingCapital: 3_200_000,
    description: 'Assembler des orbes et des bâtons pour obtenir un produit transformé.',
    materials: ['Bâtons de combat', 'Orbes chargés', 'Accès à un atelier'],
    steps: [
      'Acheter les bâtons et les orbes.',
      'Assembler les composants dans l’inventaire.',
      'Vérifier la valeur du lot avant la revente.',
    ],
    assumptions: 'Prix, coûts et rythme d’assemblage sont fictifs pour le prototype.',
  },
  {
    id: 'super-combat',
    name: 'Préparer des potions de combat',
    skill: 'Herboristerie',
    level: 90,
    style: 'Actif',
    gpPerHour: 415_000,
    xpPerHour: 148_000,
    startingCapital: 1_750_000,
    description: 'Fabriquer une potion avancée à partir de ses ingrédients de base.',
    materials: ['Herbe nettoyée', 'Fiole d’eau', 'Composant secondaire'],
    steps: [
      'Comparer les coûts des ingrédients.',
      'Mélanger les ingrédients par lots.',
      'Revendre les potions terminées.',
    ],
    assumptions: 'Recette, cadence et valeur de vente servent uniquement d’exemple visuel.',
  },
];

const styleFilters: readonly StyleFilter[] = ['Toutes', 'AFK', 'Actif'];

export function SkillingScreen() {
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('Toutes');
  const [search, setSearch] = useState('');
  const [capital, setCapital] = useState(2_500_000);
  const [level, setLevel] = useState(99);
  const [sortByProfit, setSortByProfit] = useState(true);

  const methods = useMemo(() => {
    const result = demoMethods.filter((method) => {
      const matchesSearch = `${method.name} ${method.skill}`
        .toLocaleLowerCase('fr')
        .includes(search.toLocaleLowerCase('fr'));
      const matchesStyle = styleFilter === 'Toutes' || method.style === styleFilter;
      const matchesLevel = method.level <= level;
      const matchesCapital = method.startingCapital <= capital;
      return matchesSearch && matchesStyle && matchesLevel && matchesCapital;
    });

    return [...result].sort((first, second) =>
      sortByProfit ? second.gpPerHour - first.gpPerHour : second.xpPerHour - first.xpPerHour,
    );
  }, [capital, level, search, sortByProfit, styleFilter]);
  const topProfit = methods[0]?.gpPerHour ?? 0;
  const topExperience = methods.reduce((highest, method) => Math.max(highest, method.xpPerHour), 0);

  return (
    <>
      <PageHeading
        description="Compare des activités de récolte et de transformation selon ton niveau, ton budget et ton rythme de jeu."
        eyebrow="PROGRESSION / SKILLING"
        title="Choisis une méthode à ton rythme."
      />

      <DemoNotice>
        Toutes les méthodes, prérequis, valeurs GP/h et XP/h sont fictifs. Elles montrent le futur
        format du catalogue et ne doivent pas guider une session réelle.
      </DemoNotice>

      <section
        aria-label="Filtres des méthodes"
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-xl border border-border/80 bg-card/70 p-4">
          <label
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            htmlFor="skill-level"
          >
            <Sparkles aria-hidden="true" className="text-primary" size={15} /> Niveau simulé
          </label>
          <div className="mt-3 flex items-baseline gap-2">
            <input
              className="w-24 border-0 border-b border-border bg-transparent pb-1 text-xl font-semibold tabular-nums outline-none focus:border-primary"
              id="skill-level"
              max="99"
              min="1"
              onChange={(event) => setLevel(Number(event.target.value))}
              type="number"
              value={level}
            />
            <span className="text-xs text-muted-foreground">/ 99 · manuel</span>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-card/70 p-4">
          <label
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            htmlFor="skill-capital"
          >
            <Coins aria-hidden="true" className="text-primary" size={15} /> Capital simulé
          </label>
          <div className="mt-3 flex items-center gap-2">
            <input
              className="min-w-0 flex-1 border-0 border-b border-border bg-transparent pb-1 text-xl font-semibold tabular-nums outline-none focus:border-primary"
              id="skill-capital"
              min="0"
              onChange={(event) => setCapital(Number(event.target.value) || 0)}
              step="100000"
              type="number"
              value={capital}
            />
            <span className="text-xs font-semibold text-primary">GP</span>
          </div>
        </div>
        <StatCard
          detail="dans les exemples visibles"
          label="Meilleur GP/h affiché"
          value={topProfit ? `${formatGpCompact(topProfit)} GP` : '—'}
          trend="up"
        />
        <StatCard
          detail="dans les exemples visibles"
          label="Meilleur XP/h affiché"
          value={topExperience ? `${formatGpCompact(topExperience)} XP` : '—'}
        />
      </section>

      <Card className="overflow-hidden border-border/80 bg-card/60">
        <div className="flex flex-col gap-4 border-b border-border/80 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Méthodes disponibles</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {methods.length} résultat{methods.length > 1 ? 's' : ''} · triées par{' '}
              {sortByProfit ? 'rentabilité' : 'expérience'}
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
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Méthode ou compétence"
                type="search"
                value={search}
              />
            </label>
            <select
              aria-label="Trier les méthodes"
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              onChange={(event) => setSortByProfit(event.target.value === 'gp')}
              value={sortByProfit ? 'gp' : 'xp'}
            >
              <option value="gp">Trier par GP/h</option>
              <option value="xp">Trier par XP/h</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border/70 bg-background/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <fieldset className="flex w-fit gap-1 rounded-lg bg-background/70 p-1">
            <legend className="sr-only">Filtrer par rythme</legend>
            {styleFilters.map((filter) => (
              <button
                aria-pressed={styleFilter === filter}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${styleFilter === filter ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                key={filter}
                onClick={() => setStyleFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </fieldset>
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Pickaxe aria-hidden="true" size={12} /> Récolte & production{' '}
            <span className="px-1 text-border">·</span> hors PvM
          </p>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {methods.length ? (
            methods.map((method, index) => (
              <details
                className="group rounded-xl border border-border/80 bg-background/45 open:border-primary/25 open:bg-background/70"
                key={method.id}
              >
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
                        <span className="block text-sm font-semibold text-foreground">
                          {method.name}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {method.skill} <span className="px-1 text-border">·</span> niveau{' '}
                          {method.level}+
                        </span>
                      </span>
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      size={16}
                    />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    {method.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-card/80 p-2.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
                        Profit / h
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-emerald-300">
                        {formatGpCompact(method.gpPerHour)} GP
                      </span>
                    </div>
                    <div className="rounded-lg bg-card/80 p-2.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
                        XP / h
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-foreground">
                        {formatGpCompact(method.xpPerHour)} XP
                      </span>
                    </div>
                    <div className="rounded-lg bg-card/80 p-2.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
                        Capital départ
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-foreground">
                        {formatGpCompact(method.startingCapital)} GP
                      </span>
                    </div>
                    <div className="rounded-lg bg-card/80 p-2.5">
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
                        Rythme
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-foreground">
                        {method.style === 'AFK' ? (
                          <Clock3 aria-hidden="true" size={12} />
                        ) : (
                          <Flame aria-hidden="true" size={12} />
                        )}
                        {method.style}
                      </span>
                    </div>
                  </div>
                  <span className="sr-only">Ouvrir les détails de {method.name}</span>
                </summary>
                <div className="grid gap-4 border-t border-border/70 px-4 pb-4 pt-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Matériel nécessaire
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-foreground">
                      {method.materials.map((material) => (
                        <li className="flex gap-2" key={material}>
                          <span className="text-primary">·</span>
                          {material}
                        </li>
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
                  <p className="sm:col-span-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] px-3 py-2.5 text-[10px] leading-4 text-muted-foreground">
                    {method.assumptions}
                  </p>
                </div>
              </details>
            ))
          ) : (
            <div className="sm:col-span-2">
              <EmptyState message="Aucune méthode de démonstration ne correspond à ces filtres. Ajuste le niveau, le capital ou la recherche." />
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
        <Coins aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={13} />
        Les recommandations réelles demanderont un catalogue sourcé avec des rendements documentés
        et des prix de marché à jour.
      </div>
    </>
  );
}
