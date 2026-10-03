import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as matchers from 'vitest-axe/matchers';
import App from '../App.js';
import { axe } from './axe.js';

expect.extend(matchers);

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}

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
      rules: [{ id: 'rule_1', attribute: 'country', operator: 'IN' as const, values: ['EE', 'FI'], serveValue: true }],
    },
    staging: { enabled: true, killSwitchActive: false, rolloutPercentage: 100, rules: [] },
  },
  evaluationCount: 120,
  createdAt: '2026-09-10T12:00:00Z',
  updatedAt: '2026-09-10T12:00:00Z',
});

function installFetch() {
  const flags = [makeFlag(), { ...makeFlag(), key: 'dark_theme', name: 'Dark theme', tags: ['ui'], evaluationCount: 1 }];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        json: () => Promise.resolve({ success: true, data: url === '/api/flags' ? flags : (flags.find((f) => url === `/api/flags/${f.key}`) ?? {}) }),
      })
    )
  );
}

describe('accessibility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('flag matrix has no violations', async () => {
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('flag matrix switches are named by flag and environment', async () => {
    render(<App />);
    await screen.findByText('One-click checkout');
    expect(screen.getByRole('switch', { name: 'Kill switch for checkout_v2 in staging' })).toBeInTheDocument();
  });

  it('detail drawer has no violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: /Open checkout_v2 in staging/ }));
    await screen.findByRole('heading', { name: 'checkout_v2 in staging' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('new flag dialog has no violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    await screen.findByRole('dialog', { name: 'Create flag' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
