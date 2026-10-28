import { ClipboardPaste, ExternalLink, ShieldCheck, Trophy } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  createHiscoresSnapshot,
  type OsrsHiscoresSnapshot,
  osrsHiscoresSkills,
  parseOsrsHiscoresLite,
} from '@/features/profile/hiscores';

interface HiscoresPanelProps {
  readonly username: string;
  readonly snapshot: OsrsHiscoresSnapshot | null;
  readonly onImport: (snapshot: OsrsHiscoresSnapshot) => boolean;
}

function getHiscoresUrl(username: string) {
  const url = new URL('https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws');
  url.searchParams.set('player', username.trim());
  return url.toString();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function HiscoresPanel({ username, snapshot, onImport }: HiscoresPanelProps) {
  const [rawData, setRawData] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const playerName = username.trim();

  const handleImport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!playerName) {
      setError('Renseigne et enregistre ton pseudo OSRS avant l’import.');
      return;
    }

    const parsed = parseOsrsHiscoresLite(rawData);
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }

    const imported = createHiscoresSnapshot(playerName, parsed.scores);
    if (!imported || !onImport(imported)) {
      setError('Le navigateur n’a pas pu enregistrer les niveaux importés.');
      return;
    }

    setRawData('');
    setMessage('Niveaux HiScores importés et enregistrés sur cet appareil.');
  };

  return (
    <Card className="border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Trophy aria-hidden="true" className="text-amber-200" size={16} /> Niveaux HiScores
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        L’API officielle ne permet pas la lecture directe depuis cette SPA. Ouvre sa réponse dans un
        onglet, copie le texte CSV, puis colle-le ici. Aucune donnée ne passe par un proxy.
      </p>

      {playerName ? (
        <a
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={getHiscoresUrl(playerName)}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" size={14} /> Ouvrir la réponse HiScores officielle
        </a>
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
          Enregistre d’abord ton pseudo pour préparer le lien HiScores.
        </p>
      )}

      <form className="mt-4 space-y-3" onSubmit={handleImport}>
        <label className="block space-y-2" htmlFor="hiscores-csv">
          <span className="text-xs font-medium text-foreground">Réponse CSV HiScores</span>
          <textarea
            autoCapitalize="off"
            autoComplete="off"
            className="min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            id="hiscores-csv"
            onChange={(event) => {
              setRawData(event.target.value);
              setError('');
              setMessage('');
            }}
            placeholder="rank,level,XP — une ligne par compétence"
            spellCheck={false}
            value={rawData}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-4 text-muted-foreground">
            Les lignes non classées ne remplacent pas tes niveaux manuels.
          </p>
          <Button className="gap-2" disabled={!playerName || !rawData.trim()} type="submit">
            <ClipboardPaste aria-hidden="true" size={14} /> Importer les niveaux
          </Button>
        </div>
      </form>

      {error && (
        <p aria-live="polite" className="mt-3 text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p aria-live="polite" className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
          <ShieldCheck aria-hidden="true" size={14} /> {message}
        </p>
      )}

      {snapshot && (
        <div className="mt-5 border-t border-border/70 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              {snapshot.username} · total niveau {snapshot.scores.overall.level ?? 'Non classé'}
            </p>
            <time
              className="text-[10px] text-muted-foreground"
              dateTime={new Date(snapshot.importedAt).toISOString()}
            >
              Importé le{' '}
              {new Intl.DateTimeFormat('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(snapshot.importedAt)}
            </time>
          </div>

          {snapshot.username.toLocaleLowerCase() !== playerName.toLocaleLowerCase() && (
            <p className="mt-2 text-[10px] text-amber-200">
              Le dernier import concerne un autre pseudo que celui du profil.
            </p>
          )}

          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {osrsHiscoresSkills
              .filter((skill) => 'skillingSkill' in skill)
              .map((skill) => {
                const score = snapshot.scores[skill.id];
                return (
                  <li
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 text-[10px]"
                    key={skill.id}
                  >
                    <span className="text-muted-foreground">{skill.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {score?.level ?? 'Non classé'}
                      {score?.experience !== null && score?.experience !== undefined && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          · {formatNumber(score.experience)} XP
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </Card>
  );
}
