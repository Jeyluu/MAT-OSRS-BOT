import {
  Check,
  CircleHelp,
  CloudOff,
  Fingerprint,
  HardDrive,
  Save,
  Shield,
  UserRound,
  Wallet,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  clearProfilePreferences,
  defaultProfilePreferences,
  hasSavedProfilePreferences,
  loadProfilePreferences,
  type ProfilePreferences,
  profilePreferencesSchema,
  saveProfilePreferences,
} from '@/features/profile/profile-storage';
import { DemoNotice, formatGp, PageHeading } from '@/features/shared';

const strategies = [
  { id: 'Prudente', label: 'Prudente', hint: 'Priorité à la stabilité' },
  { id: 'Équilibrée', label: 'Équilibrée', hint: 'Bon compromis' },
  { id: 'Agressive', label: 'Agressive', hint: 'Plus de variations' },
] as const;

const styles = ['Toutes', 'AFK', 'Actif'] as const;

export function ProfileScreen() {
  const [preferences, setPreferences] = useState<ProfilePreferences>(() =>
    loadProfilePreferences(),
  );
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [hasSaved, setHasSaved] = useState(() => hasSavedProfilePreferences());

  const updatePreference = <Key extends keyof ProfilePreferences>(
    key: Key,
    value: ProfilePreferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaveMessage('');
    setSaveError('');
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = profilePreferencesSchema.safeParse(preferences);

    if (!result.success) {
      setSaveError(result.error.issues[0]?.message ?? 'Vérifie les champs du profil.');
      setSaveMessage('');
      return;
    }

    if (!saveProfilePreferences(result.data)) {
      setSaveError('Le navigateur ne peut pas enregistrer ces préférences.');
      setSaveMessage('');
      return;
    }

    setPreferences(result.data);
    setHasSaved(true);
    setSaveError('');
    setSaveMessage('Préférences enregistrées sur cet appareil.');
  };

  const handleReset = () => {
    setPreferences(defaultProfilePreferences);
    clearProfilePreferences();
    setHasSaved(false);
    setSaveError('');
    setSaveMessage('Préférences locales effacées.');
  };

  return (
    <>
      <PageHeading
        description="Renseigne ton pseudo, ton capital et tes préférences. Ils resteront enregistrés dans ce navigateur."
        eyebrow="PERSONNALISATION / PROFIL"
        title="Tes réglages, à ta façon."
      />

      <DemoNotice>
        Aucun compte n’est requis. Les niveaux ne sont pas synchronisés dans cette maquette : les
        préférences saisies sont stockées localement dans ton navigateur.
      </DemoNotice>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.7fr)]">
        <Card className="border-border/80 bg-card/60 p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <UserRound aria-hidden="true" size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Profil joueur</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ces paramètres sont enregistrés uniquement à ta demande.
              </p>
            </div>
          </div>

          <form className="space-y-7" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2" htmlFor="osrs-username">
                <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Fingerprint aria-hidden="true" className="text-primary" size={14} /> Pseudo OSRS
                </span>
                <input
                  autoComplete="nickname"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  id="osrs-username"
                  maxLength={12}
                  onChange={(event) => updatePreference('username', event.target.value)}
                  placeholder="Ex. Aventurier"
                  value={preferences.username}
                />
                <span className="block text-[10px] text-muted-foreground">
                  Jusqu’à 12 caractères. La connexion HiScores n’est pas active.
                </span>
              </label>
              <label className="block space-y-2" htmlFor="profile-capital">
                <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Wallet aria-hidden="true" className="text-primary" size={14} /> Capital
                  disponible
                </span>
                <span className="flex h-11 items-center rounded-lg border border-border bg-background pr-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <input
                    className="h-full min-w-0 flex-1 rounded-lg border-0 bg-transparent px-3 text-sm tabular-nums outline-none focus:ring-0"
                    id="profile-capital"
                    min="0"
                    onChange={(event) =>
                      updatePreference('capitalGp', Number(event.target.value) || 0)
                    }
                    placeholder="0"
                    step="1000"
                    type="number"
                    value={preferences.capitalGp || ''}
                  />
                  <span className="text-xs font-semibold text-primary">GP</span>
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  Montant manuel utilisé pour les futures recommandations.
                </span>
              </label>
            </div>

            <fieldset>
              <legend className="mb-3 text-xs font-medium text-foreground">
                Stratégie de flipping
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {strategies.map((strategy) => {
                  const selected = preferences.strategy === strategy.id;

                  return (
                    <button
                      aria-pressed={selected}
                      className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary/40 bg-primary/[0.07]' : 'border-border bg-background/55 hover:border-border/90 hover:bg-background'}`}
                      key={strategy.id}
                      onClick={() => updatePreference('strategy', strategy.id)}
                      type="button"
                    >
                      <span className="flex items-center justify-between text-xs font-semibold text-foreground">
                        {strategy.label}
                        {selected && (
                          <Check aria-hidden="true" className="text-primary" size={14} />
                        )}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {strategy.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-xs font-medium text-foreground">
                Préférence de skilling
              </legend>
              <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-background p-1">
                {styles.map((style) => (
                  <button
                    aria-pressed={preferences.skillingStyle === style}
                    className={`rounded-md px-4 py-2 text-xs font-medium transition-colors ${preferences.skillingStyle === style ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    key={style}
                    onClick={() => updatePreference('skillingStyle', style)}
                    type="button"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/80 bg-background/55 p-4">
              <span>
                <span className="block text-xs font-medium text-foreground">
                  Afficher les grands montants en format court
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  Par exemple 1 250 000 GP devient 1,3 M GP.
                </span>
              </span>
              <input
                checked={preferences.compactNumbers}
                className="size-4 accent-[var(--primary)]"
                onChange={(event) => updatePreference('compactNumbers', event.target.checked)}
                type="checkbox"
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div aria-live="polite" className="min-h-5 text-xs">
                {saveError && <p className="text-rose-300">{saveError}</p>}
                {saveMessage && <p className="text-emerald-300">{saveMessage}</p>}
              </div>
              <div className="flex gap-2">
                {hasSaved && (
                  <Button className="text-xs" onClick={handleReset} type="button" variant="ghost">
                    Effacer
                  </Button>
                )}
                <Button className="gap-2" type="submit">
                  <Save aria-hidden="true" size={15} /> Enregistrer les préférences
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="border-border/80 bg-card/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HardDrive aria-hidden="true" className="text-primary" size={16} /> Stockage local
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ton pseudo et tes préférences restent dans le stockage local de ce navigateur. Ils ne
              sont envoyés à aucun serveur.
            </p>
            <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">État du profil</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${hasSaved ? 'bg-emerald-400/10 text-emerald-300' : 'bg-secondary text-muted-foreground'}`}
                >
                  {hasSaved ? 'Enregistré sur cet appareil' : 'Pas encore enregistré'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Capital renseigné</span>
                <span className="font-medium tabular-nums text-foreground">
                  {preferences.capitalGp
                    ? `${formatGp(preferences.capitalGp)} GP`
                    : 'Non renseigné'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Stratégie par défaut</span>
                <span className="font-medium text-foreground">{preferences.strategy}</span>
              </div>
            </div>
          </Card>

          <Card className="border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CloudOff aria-hidden="true" className="text-amber-200" size={16} /> Niveaux HiScores
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              La page HiScores ne permet pas une lecture directe depuis un navigateur. La
              synchronisation automatique demandera une source compatible ; une saisie manuelle
              reste prévue.
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-background/60 p-3 text-[10px] leading-4 text-muted-foreground">
              <Shield aria-hidden="true" className="mt-0.5 shrink-0 text-amber-200" size={13} />{' '}
              Aucun mot de passe ni jeton de compte ne sera demandé.
            </div>
          </Card>

          <p className="flex items-start gap-2 px-1 text-[10px] leading-4 text-muted-foreground">
            <CircleHelp aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={13} /> Le
            capital et les préférences sont enregistrés. Les vues démo n’utilisent pas encore ce
            profil pour calculer des recommandations.
          </p>
        </aside>
      </div>
    </>
  );
}
