import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';
import { skillingMethods, skillingSkills } from './features/skilling/skilling-catalog';

const nowSeconds = Math.floor(Date.now() / 1_000);
const skillingMarketIds = [
  ...new Set(
    skillingMethods.flatMap((method) => [
      ...method.inputs.map((item) => item.itemId),
      ...method.outputs.map((item) => item.itemId),
    ]),
  ),
].filter((id) => id !== 561);
const testSnapshot = {
  schemaVersion: 2 as const,
  source: 'OSRS Wiki Real-time Prices API' as const,
  sourceUrl: 'https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices' as const,
  generatedAt: new Date().toISOString(),
  latestAsOf: nowSeconds,
  fiveMinuteTimestamp: nowSeconds,
  mappingItemCount: skillingMarketIds.length + 1,
  quotedItemCount: skillingMarketIds.length + 1,
  items: [
    {
      id: 561,
      name: 'Nature rune',
      icon: 'Nature rune.png',
      members: false,
      buyLimit: 18_000,
      high: 115,
      highTime: nowSeconds,
      low: 108,
      lowTime: nowSeconds - 60,
      avgHighPrice: 113,
      avgLowPrice: 109,
      highPriceVolume: 12,
      lowPriceVolume: 9,
      history: Array.from({ length: 16 }, (_, index) => ({
        timestamp: nowSeconds - (15 - index) * 300,
        avgHighPrice: 113 + index * 0.1,
        avgLowPrice: 109 + index * 0.1,
        highPriceVolume: 12,
        lowPriceVolume: 9,
      })),
    },
    ...skillingMarketIds.map((id) => ({
      id,
      name: `Item de test ${id}`,
      icon: `Item de test ${id}.png`,
      members: false,
      buyLimit: 10_000,
      high: 150,
      highTime: nowSeconds,
      low: 100,
      lowTime: nowSeconds,
      avgHighPrice: 140,
      avgLowPrice: 110,
      highPriceVolume: 100,
      lowPriceVolume: 100,
      history: null,
    })),
  ],
};

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.localStorage.setItem(
    'osrs-helper.preferences.v1',
    JSON.stringify({
      username: '',
      capitalGp: 2_500_000,
      strategy: 'Équilibrée',
      skillingStyle: 'Toutes',
      compactNumbers: false,
    }),
  );
  window.localStorage.setItem(
    'osrs-helper.skilling-levels.v1',
    JSON.stringify(Object.fromEntries(skillingSkills.map((skill) => [skill, 99]))),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => testSnapshot,
    })),
  );
});

test('affiche les opportunités calculées et navigue vers le skilling', async () => {
  renderApp();

  expect(
    await screen.findByRole('heading', { name: 'Des marges, avec leur risque.' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Nature rune');

  fireEvent.click(screen.getByRole('button', { name: 'Skilling' }));

  expect(
    screen.getByRole('heading', { name: 'Des méthodes, des prix réels.' }),
  ).toBeInTheDocument();
});

test('filtre les opportunités par nom d’item', async () => {
  renderApp();
  await screen.findByRole('table');

  fireEvent.change(screen.getByLabelText('Rechercher un item OSRS'), {
    target: { value: 'objet absent' },
  });

  expect(screen.getByText(/aucune opportunité ne correspond à ces filtres/i)).toBeInTheDocument();
});

test('filtre les méthodes réelles par style', async () => {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Skilling' }));
  await screen.findByRole('heading', { name: 'Des méthodes, des prix réels.' });

  fireEvent.change(screen.getByLabelText('Filtrer par rythme'), {
    target: { value: 'Actif' },
  });

  expect(screen.getByText('Tisser des drift nets')).toBeInTheDocument();
  expect(screen.queryByText('Empenner des yew longbow (u)')).not.toBeInTheDocument();
});

test('enregistre les préférences du profil dans localStorage', () => {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Profil' }));

  fireEvent.change(screen.getByPlaceholderText('Ex. Aventurier'), {
    target: { value: 'DemoPlayer' },
  });
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2500000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }));

  expect(screen.getByText('Préférences enregistrées sur cet appareil.')).toBeInTheDocument();
  expect(
    JSON.parse(window.localStorage.getItem('osrs-helper.preferences.v1') ?? '{}'),
  ).toMatchObject({
    username: 'DemoPlayer',
    capitalGp: 2_500_000,
    strategy: 'Équilibrée',
  });
});
