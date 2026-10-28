import type { LucideIcon } from 'lucide-react';
import { ChartNoAxesCombined, CircleUserRound, Pickaxe, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FlippingScreen } from '@/features/flipping/flipping-screen';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { SkillingScreen } from '@/features/skilling/skilling-screen';

type SectionId = 'flipping' | 'skilling' | 'profile';

interface SectionDefinition {
  readonly id: SectionId;
  readonly label: string;
  readonly icon: LucideIcon;
}

const sections: readonly SectionDefinition[] = [
  { id: 'flipping', label: 'Flipping', icon: ChartNoAxesCombined },
  { id: 'skilling', label: 'Skilling', icon: Pickaxe },
  { id: 'profile', label: 'Profil', icon: CircleUserRound },
];

export function App() {
  const [activeSectionId, setActiveSectionId] = useState<SectionId>('flipping');

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:h-[76px] md:flex-row md:items-center md:justify-between md:gap-6 md:py-0 lg:px-8">
          <a
            className="flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={import.meta.env.BASE_URL}
            aria-label="OSRS Helper, accueil"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_-10px_var(--primary)]">
              <Sparkles aria-hidden="true" size={19} />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide text-foreground">
                OSRS Helper
              </span>
              <span className="block text-[11px] tracking-wide text-muted-foreground">
                MARCHÉ & PROGRESSION
              </span>
            </span>
          </a>

          <nav
            aria-label="Navigation principale"
            className="flex gap-1 overflow-x-auto md:justify-center"
          >
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSectionId;

              return (
                <Button
                  key={section.id}
                  aria-current={isActive ? 'page' : undefined}
                  className="h-10 shrink-0 gap-2 px-3 sm:px-4"
                  onClick={() => setActiveSectionId(section.id)}
                  type="button"
                  variant={isActive ? 'secondary' : 'ghost'}
                >
                  <Icon aria-hidden="true" size={16} />
                  {section.label}
                </Button>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary md:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            V1 EN CONSTRUCTION
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-7 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-5 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-primary md:hidden">
          <span className="size-1.5 rounded-full bg-primary" />
          V1 EN CONSTRUCTION
        </div>
        {activeSectionId === 'flipping' && <FlippingScreen />}
        {activeSectionId === 'skilling' && <SkillingScreen />}
        {activeSectionId === 'profile' && <ProfileScreen />}
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            OSRS Helper <span className="text-border">/</span> aperçu de l’interface
          </span>
          <span>Prix GE et calculs de skilling issus de sources OSRS Wiki.</span>
        </div>
      </footer>
    </div>
  );
}
