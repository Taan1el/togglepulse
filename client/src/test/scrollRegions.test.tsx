import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.js';

const makeFlag = () => ({
  key: 'checkout_v2',
  name: 'One-click checkout',
  description: 'Single-step checkout funnel.',
  tags: ['checkout'],
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

// Containers that can scroll sideways must be reachable by keyboard (jsdom cannot measure scrolling,
// so this checks the markup that makes them focusable and named).
const SCROLLERS = '.table-wrapper, [class*="overflow-auto"], [class*="scroll"]';

function expectKeyboardReachable(container: HTMLElement) {
  const found = container.querySelectorAll<HTMLElement>(SCROLLERS);
  expect(found.length).toBeGreaterThan(0);
  found.forEach((el) => {
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect((el.getAttribute('aria-label') ?? '').trim()).not.toBe('');
  });
}

describe('scrollable regions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const flags = [makeFlag()];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true, data: url === '/api/flags' ? flags : flags[0] }),
        })
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('flag matrix wrapper is focusable and named', async () => {
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    expectKeyboardReachable(container);
  });

  it('drawer rules table wrapper is focusable and named', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: /Open checkout_v2 in production/ }));
    await screen.findByRole('heading', { name: 'checkout_v2 in production' });
    expectKeyboardReachable(container);
    expect(container.querySelectorAll('.table-wrapper').length).toBe(2);
  });

  it('new flag dialog keeps the matrix wrapper reachable', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('One-click checkout');
    await user.click(screen.getByRole('button', { name: 'New flag' }));
    await screen.findByRole('dialog', { name: 'Create flag' });
    expectKeyboardReachable(container);
  });
});
