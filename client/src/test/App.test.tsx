import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.js';

const makeFlag = () => ({
  key: 'checkout_v2',
  name: 'One-click checkout',
  description: 'Single-step checkout funnel.',
  tags: ['checkout', 'fintech'],
  environments: {
    production: {
      enabled: true,
      killSwitchActive: false,
      rolloutPercentage: 40,
      rules: [
        { id: 'rule_1', attribute: 'country', operator: 'IN' as const, values: ['EE', 'FI'], serveValue: true },
      ],
    },
    staging: { enabled: true, killSwitchActive: false, rolloutPercentage: 100, rules: [] },
  },
  evaluationCount: 120,
  createdAt: '2026-09-10T12:00:00Z',
  updatedAt: '2026-09-10T12:00:00Z',
});

const secondFlag = () => ({
  ...makeFlag(),
  key: 'dark_theme',
  name: 'Dark theme',
  description: '',
  tags: ['ui'],
  environments: {
    production: { enabled: false, killSwitchActive: false, rolloutPercentage: 0, rules: [] },
  },
  evaluationCount: 1,
});

const evalResult = {
  flagKey: 'checkout_v2',
  enabled: true,
  environment: 'production',
  reason: 'RULE_MATCH' as const,
  matchedRuleId: 'rule_1',
  evaluatedAt: '2026-09-10T12:30:00Z',
};

type Call = { url: string; method: string; body: any };

function installFetch(flags = [makeFlag(), secondFlag()]) {
  const calls: Call[] = [];
  const state = new Map(flags.map((f) => [f.key, structuredClone(f)]));
  const ok = (data: unknown) => Promise.resolve({ json: () => Promise.resolve({ success: true, data }) });

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      const path = url.replace('/api', '');
      if (path === '/flags' && method === 'GET') return ok([...state.values()]);
      if (path === '/flags' && method === 'POST') {
        const created = { ...makeFlag(), key: body.key, name: body.name, evaluationCount: 0 };
        state.set(created.key, created);
        return ok(created);
      }
      const match = path.match(/^\/flags\/([^/]+)(\/\w+)?$/);
      if (match) {
        const flag = state.get(match[1]);
        if (!flag) return Promise.resolve({ json: () => Promise.resolve({ success: false, error: 'not found' }) });
        if (match[2] === '/evaluate') return ok({ ...evalResult, flagKey: flag.key, environment: body.environment });
        if (match[2] === '/rollout') {
          const env = (flag.environments as any)[body.environment];
          env.rolloutPercentage = body.rolloutPercentage;
          return ok(flag);
        }
        if (match[2] === '/killswitch') {
          (flag.environments as any)[body.environment].killSwitchActive = body.active;
          return ok(flag);
        }
        if (method === 'DELETE') {
          state.delete(flag.key);
          return ok({ deleted: true });
        }
        return ok(flag);
      }
      return ok({});
    })
  );
  return calls;
}

describe('TogglePulse console', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the product header, the three environments and no demo bar', async () => {
    installFetch();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'TogglePulse' })).toBeInTheDocument();
    for (const env of ['production', 'staging', 'development']) {
      expect(screen.getByRole('button', { name: env })).toBeInTheDocument();
    }
    expect(screen.queryByText(/everything runs in your browser/i)).not.toBeInTheDocument();
    await screen.findByText('One-click checkout');
  });

  it('lists flags in a table with state text, rollout value and rule count', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    const table = document.querySelector('.flags-table') as HTMLElement;
    const row = within(table).getByRole('button', { name: /One-click checkout/ }).closest('tr')!;
    expect(within(row).getByText('Rolling out')).toBeInTheDocument();
    expect(within(row).getByText('40%')).toBeInTheDocument();
    expect(within(row).getByText('1 rule')).toBeInTheDocument();
    const dark = within(table).getByRole('button', { name: /Dark theme/ }).closest('tr')!;
    expect(within(dark).getByText('Off')).toBeInTheDocument();
    expect(within(dark).getByText('0 rules')).toBeInTheDocument();
  });

  it('summarizes the selected environment in one stats strip', async () => {
    installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    const strip = document.querySelector('.stats-strip') as HTMLElement;
    expect(within(strip).getByText('Flags').nextSibling).toHaveTextContent('2');
    expect(within(strip).getByText('Rolling out').nextSibling).toHaveTextContent('1');
    expect(within(strip).getByText('Evaluations').nextSibling).toHaveTextContent('121');
  });

  it('switches environment and shows that environment settings', async () => {
    const user = userEvent.setup();
    installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: 'staging' }));
    expect(screen.getByRole('heading', { name: 'Flags in staging' })).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /One-click checkout/ }).closest('tr')!;
    expect(within(row).getByText('Live')).toBeInTheDocument();
    // dark_theme has no staging config, so it reads as off at 0%
    expect(within(screen.getByRole('button', { name: /Dark theme/ }).closest('tr')!).getByText('0%')).toBeInTheDocument();
  });

  it('filters the table by name, key or tag', async () => {
    const user = userEvent.setup();
    installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    await user.type(screen.getByLabelText(/filter flags/i), 'fintech');
    expect(screen.getByRole('button', { name: /One-click checkout/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dark theme/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/filter flags/i));
    await user.type(screen.getByLabelText(/filter flags/i), 'nothing-matches');
    expect(screen.getByText('No flags match this filter.')).toBeInTheDocument();
  });

  it('applies a rollout change through the PATCH endpoint', async () => {
    const user = userEvent.setup();
    const calls = installFetch();
    render(<App />);
    await screen.findByText('Currently 40% of users get this flag on.');
    const range = screen.getByLabelText('Rollout percentage');
    const apply = screen.getByRole('button', { name: 'Apply rollout' });
    expect(apply).toBeDisabled();
    fireEvent.change(range, { target: { value: '55' } });
    expect(apply).toBeEnabled();
    await user.click(apply);
    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH');
      expect(patch).toMatchObject({
        url: '/api/flags/checkout_v2/rollout',
        body: { environment: 'production' },
      });
      expect(patch!.body.rolloutPercentage).toBe(55);
    });
  });

  it('triggers and releases the kill switch for the current environment', async () => {
    const user = userEvent.setup();
    const calls = installFetch();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Trigger kill switch' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Release kill switch' })).toBeInTheDocument());
    expect(calls.find((c) => c.url.endsWith('/killswitch'))).toMatchObject({
      method: 'POST',
      body: { environment: 'production', active: true },
    });
    const row = screen.getByRole('button', { name: /One-click checkout/ }).closest('tr')!;
    await waitFor(() => expect(within(row).getByText('Kill switch on')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Apply rollout' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Release kill switch' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trigger kill switch' })).toBeInTheDocument());
    expect(calls.filter((c) => c.url.endsWith('/killswitch')).at(-1)!.body.active).toBe(false);
  });

  it('shows targeting rules of the selected flag', async () => {
    installFetch();
    render(<App />);
    await screen.findByRole('heading', { name: 'Targeting rules (1)' });
    const rules = document.querySelector('.rules-table') as HTMLElement;
    expect(within(rules).getByText('country')).toBeInTheDocument();
    expect(screen.getByText('EE, FI')).toBeInTheDocument();
    expect(screen.getByText('IN')).toBeInTheDocument();
  });

  it('evaluates a user and prints the reason', async () => {
    const user = userEvent.setup();
    const calls = installFetch();
    render(<App />);
    await screen.findByRole('heading', { name: 'Evaluation tester' });
    expect(screen.getByText(/Run an evaluation/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Evaluate flag' }));
    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('RULE_MATCH')).toBeInTheDocument();
    expect(screen.getByText('rule_1')).toBeInTheDocument();
    const evaluate = calls.find((c) => c.url.endsWith('/evaluate'))!;
    expect(evaluate.body).toEqual({
      environment: 'production',
      context: { userId: 'usr_tallinn_101', attributes: { country: 'EE', role: 'user', appVersion: '2.5.0' } },
    });
  });

  it('creates a flag from the dialog and selects it', async () => {
    const user = userEvent.setup();
    const calls = installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    const dialog = screen.getByRole('dialog', { name: 'Create flag' });
    expect(within(dialog).getByLabelText('Flag key')).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));
    expect(within(dialog).getByText('Key and name are required')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Flag key'), 'new_banner');
    await user.type(within(dialog).getByLabelText('Display name'), 'New banner');
    await user.click(within(dialog).getByRole('button', { name: 'Create flag' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const post = calls.find((c) => c.method === 'POST' && c.url === '/api/flags')!;
    expect(post.body).toMatchObject({
      key: 'new_banner',
      name: 'New banner',
      tags: ['canary', 'rollout'],
      environments: { production: { rolloutPercentage: 10 } },
    });
    expect(await screen.findByRole('heading', { name: /new_banner in production/ })).toBeInTheDocument();
  });

  it('closes the dialog with Cancel and with Escape', async () => {
    const user = userEvent.setup();
    installFetch();
    render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes the selected flag only after confirmation', async () => {
    const user = userEvent.setup();
    const calls = installFetch();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: /Delete flag/ }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(screen.getByRole('button', { name: /Delete flag/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/flags/checkout_v2')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('button', { name: /One-click checkout/ })).not.toBeInTheDocument());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('shows a readable error when flags cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
    render(<App />);
    expect(await screen.findByText(/Could not load flags/)).toBeInTheDocument();
    expect(screen.getByText('No flags yet. Create one with New flag.')).toBeInTheDocument();
  });
});
