import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.js';
import { resetDemoData } from '../services/index.js';

async function renderDemoApp() {
  vi.stubEnv('VITE_DEMO_MODE', 'true');
  resetDemoData();
  const fetchSpy = vi.fn(() => Promise.reject(new Error('the demo must not call the network')));
  vi.stubGlobal('fetch', fetchSpy);
  render(<App />);
  await screen.findByRole('heading', { name: /in production/ });
  return fetchSpy;
}

describe('demo mode', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the demo bar and the sample flags without any network request', async () => {
    const fetchSpy = await renderDemoApp();
    expect(screen.getByText('Demo: everything runs in your browser with sample data.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Source on GitHub' })).toHaveLength(2);
    expect(await screen.findByText('One-click checkout')).toBeInTheDocument();
    expect(screen.getByText('Dark theme')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('runs a kill switch and an evaluation entirely in the browser', async () => {
    const user = userEvent.setup();
    const fetchSpy = await renderDemoApp();
    await user.click(await screen.findByRole('button', { name: 'Trigger kill switch' }));
    await screen.findByRole('button', { name: 'Release kill switch' });
    await user.click(screen.getByRole('button', { name: 'Evaluate flag' }));
    expect(await screen.findByText('KILL_SWITCH')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resets changes from the demo bar', async () => {
    const user = userEvent.setup();
    await renderDemoApp();
    await user.click(screen.getByRole('button', { name: /One-click checkout/ }));
    await user.click(await screen.findByRole('button', { name: 'Trigger kill switch' }));
    const row = () => screen.getByRole('button', { name: /One-click checkout/ }).closest('tr')!;
    await waitFor(() => expect(within(row()).getByText('Kill switch on')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    await waitFor(() => expect(within(row()).getByText('Rolling out')).toBeInTheDocument());
  });
});
