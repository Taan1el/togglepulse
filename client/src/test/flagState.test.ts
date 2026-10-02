import { describe, it, expect } from 'vitest';
import { describeState } from '../utils/flagState.js';

const env = (over: Partial<Parameters<typeof describeState>[0]>) => ({
  enabled: true, killSwitchActive: false, rolloutPercentage: 50, rules: [], ...over,
});

describe('describeState', () => {
  it('puts the kill switch before every other setting', () => {
    expect(describeState(env({ killSwitchActive: true, enabled: false })).kind).toBe('killed');
    expect(describeState(env({ killSwitchActive: true, rolloutPercentage: 100 })).tone).toBe('bad');
  });

  it('reports a disabled environment as off', () => {
    expect(describeState(env({ enabled: false, rolloutPercentage: 100 })).kind).toBe('off');
  });

  it('separates 0 percent, partial and full rollouts', () => {
    expect(describeState(env({ rolloutPercentage: 0 })).kind).toBe('idle');
    expect(describeState(env({ rolloutPercentage: 35 })).kind).toBe('rolling');
    expect(describeState(env({ rolloutPercentage: 100 })).kind).toBe('live');
  });
});
