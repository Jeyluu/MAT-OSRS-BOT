import { AlertTriangle, ArrowDownRight, ArrowUpRight, Database } from 'lucide-react';
import type { ReactNode } from 'react';
import { loadProfilePreferences } from '@/features/profile/profile-storage';

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[34px]">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3.5 sm:items-center">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:mt-0">
        <Database aria-hidden="true" size={16} />
      </span>
      <div>
        <p className="text-xs font-semibold text-foreground">Mode démonstration</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: 'up' | 'down';
}) {
  const TrendIcon = trend === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="rounded-xl border border-border/80 bg-card/70 p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {trend && (
          <TrendIcon
            aria-hidden="true"
            className={trend === 'up' ? 'text-emerald-400' : 'text-amber-400'}
            size={15}
          />
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/50 px-5 text-center">
      <AlertTriangle aria-hidden="true" className="mb-3 text-muted-foreground" size={20} />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function formatGp(value: number): string {
  if (loadProfilePreferences().compactNumbers) return formatGpCompact(value);
  return formatGpFull(value);
}

export function formatGpCompact(value: number): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M`;
  }

  if (magnitude >= 1_000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value / 1_000)} k`;
  }

  return formatGpFull(value);
}

function formatGpFull(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);
}
