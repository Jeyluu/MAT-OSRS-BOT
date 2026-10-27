import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { App } from './App';

const testSnapshot = {
  schemaVersion: 1 as const,
  source: 'OSRS Wiki Real-time Prices API' as const,
  sourceUrl: 'https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices' as const,
  generatedAt: '2026-10-27T18:00:00.000Z',
  latestAsOf: 1_793_125_200,
  fiveMinuteTimestamp: 1_793_125_200,
  mappingItemCount: 1,
  quotedItemCount: 1,
  items: [
    {
      id: 561,
      name: 'Nature rune',
      icon: 'Nature rune.png',
      members: false,
      buyLimit: 18_000,
      high: 115,
      highTime: 1_793_125_200,
      low: 108,
      lowTime: 1_793_125_140,
      avgHighPrice: 113,
      avgLowPrice: 109,
      highPriceVolume: 12,
      lowPriceVolume: 9,
    },
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => testSnapshot,
    })),
  );
});

test('affiche les prix réels chargés et navigue vers le skilling', async () => {
  renderApp();

  expect(
    await screen.findByRole('heading', { name: 'Les prix, à la source.' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('table')).toHaveTextContent('Nature rune');

  fireEvent.click(screen.getByRole('button', { name: 'Skilling' }));

  expect(
    screen.getByRole('heading', { name: 'Choisis une méthode à ton rythme.' }),
  ).toBeInTheDocument();
});

test('filtre le marché par nom d’item', async () => {
  renderApp();
  await screen.findByRole('table');

  fireEvent.change(screen.getByLabelText('Rechercher un item OSRS'), {
    target: { value: 'objet absent' },
  });

  expect(screen.getByText(/aucun item ne correspond à cette recherche/i)).toBeInTheDocument();
});

test('filtre les méthodes de skilling par style', () => {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Skilling' }));

  fireEvent.click(screen.getByRole('button', { name: 'Actif' }));

  expect(screen.getByText('Préparer des potions de combat')).toBeInTheDocument();
  expect(screen.queryByText('Couper des ifs')).not.toBeInTheDocument();
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
