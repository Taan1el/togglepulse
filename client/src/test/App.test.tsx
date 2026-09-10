import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.js';

const mockFlag = {
  key: 'checkout_v2',
  name: 'One-Click Checkout & Apple Pay',
  description: 'Streamlined checkout funnel with biometric payment integration.',
  tags: ['checkout', 'fintech'],
  environments: {
    production: {
      enabled: true,
      killSwitchActive: false,
      rolloutPercentage: 40,
      rules: [
        {
          id: 'rule_1',
          attribute: 'country',
          operator: 'IN' as const,
          values: ['EE', 'FI'],
          serveValue: true,
        },
      ],
    },
  },
  evaluationCount: 120,
  createdAt: '2026-09-10T12:00:00Z',
  updatedAt: '2026-09-10T12:00:00Z',
};

const mockEvalResult = {
  flagKey: 'checkout_v2',
  enabled: true,
  environment: 'production',
  reason: 'RULE_MATCH' as const,
  matchedRuleId: 'rule_1',
  bucket: 24,
  evaluatedAt: '2026-09-10T12:30:00Z',
};

describe('TogglePulse Client Dashboard Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/flags/checkout_v2/evaluate')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, data: mockEvalResult }),
          });
        }
        if (url.includes('/api/flags/checkout_v2')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, data: mockFlag }),
          });
        }
        if (url.includes('/api/flags')) {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, data: [mockFlag] }),
          });
        }
        if (url.includes('/api/health')) {
          return Promise.resolve({
            json: () => Promise.resolve({ status: 'healthy', service: 'togglepulse-engine' }),
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      })
    );
  });

  it('renders application brand title and environment switcher', async () => {
    render(<App />);

    expect(screen.getByText('TogglePulse')).toBeInTheDocument();
    expect(screen.getByText('Canary Rollouts & Dynamic Toggles')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
  });

  it('displays flag list and rollout percentage badge', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('One-Click Checkout & Apple Pay').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('40% Rollout')).toBeInTheDocument();
      expect(screen.getByText('#checkout')).toBeInTheDocument();
    });
  });

  it('renders flag detail panel and percentage rollout slider', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Canary Percentage Rollout')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('Trigger Kill Switch')).toBeInTheDocument();
    });
  });

  it('evaluates user context in the interactive SDK sandbox', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Interactive SDK Evaluation Sandbox')).toBeInTheDocument();
    });

    const evalBtn = screen.getByText('Evaluate Flag via SDK');
    fireEvent.click(evalBtn);

    await waitFor(() => {
      expect(screen.getByText('ENABLED (TRUE)')).toBeInTheDocument();
      expect(screen.getByText(/RULE_MATCH/i)).toBeInTheDocument();
    });
  });

  it('opens and closes the Create Flag modal', async () => {
    render(<App />);

    const newBtn = screen.getByText('New Flag');
    fireEvent.click(newBtn);

    expect(screen.getByText('Create New Feature Flag')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. checkout_v3_beta/i)).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Create New Feature Flag')).not.toBeInTheDocument();
    });
  });
});
