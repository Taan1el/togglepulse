import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchFlags,
  fetchFlagByKey,
  createFlag,
  updateRollout,
  toggleKillSwitch,
  evaluateFlag,
  deleteFlag,
  resetDemoData,
} from '../services/demoApi.js';
import { computeBucket } from '../../../shared/evaluate.js';
import { SAMPLE_FLAGS } from '../../../shared/sample-flags.js';

describe('demoApi (in-browser data layer)', () => {
  beforeEach(() => {
    resetDemoData();
  });

  it('starts from the fixed sample flags with the sample evaluation count', async () => {
    const flags = await fetchFlags();
    expect(flags.map((f) => f.key).sort()).toEqual(SAMPLE_FLAGS.map((f) => f.key).sort());
    const checkout = await fetchFlagByKey('checkout_v2');
    expect(checkout.evaluationCount).toBe(5);
    expect(checkout.createdAt).toBe('2026-10-01T08:56:00.000Z');
    expect(checkout.environments.production.rolloutPercentage).toBe(35);
  });

  it('returns copies, so callers cannot mutate the stored flags', async () => {
    const flag = await fetchFlagByKey('checkout_v2');
    flag.environments.production.rolloutPercentage = 99;
    expect((await fetchFlagByKey('checkout_v2')).environments.production.rolloutPercentage).toBe(35);
  });

  it('creates a flag with normalized key and defaults, and rejects duplicates and bad input', async () => {
    const flag = await createFlag({ key: ' New Flag ', name: 'New', description: '', tags: [] });
    expect(flag.key).toBe('new_flag');
    expect(flag.environments.production.rolloutPercentage).toBe(0);
    expect(flag.environments.staging.rolloutPercentage).toBe(100);
    await expect(createFlag({ key: 'new_flag', name: 'Again', description: '', tags: [] }))
      .rejects.toThrow(/already exists/);
    await expect(createFlag({ key: '', name: 'x', description: '', tags: [] })).rejects.toThrow(/required/);
    await expect(createFlag({
      key: 'bad', name: 'Bad', description: '', tags: [],
      environments: { production: { rolloutPercentage: 120 } },
    })).rejects.toThrow(/between 0 and 100/);
  });

  it('updates and clamps rollout percentages, and validates the environment', async () => {
    const up = await updateRollout('vector_search', { environment: 'production', rolloutPercentage: 250 });
    expect(up.environments.production.rolloutPercentage).toBe(100);
    const down = await updateRollout('vector_search', { environment: 'staging', rolloutPercentage: -4 });
    expect(down.environments.staging.rolloutPercentage).toBe(0);
    await expect(updateRollout('vector_search', { environment: 'qa', rolloutPercentage: 5 })).rejects.toThrow();
    await expect(updateRollout('vector_search', { rolloutPercentage: Number.NaN })).rejects.toThrow();
    await expect(updateRollout('missing', { rolloutPercentage: 5 })).rejects.toThrow(/not found/);
  });

  it('keeps rollout settings when the kill switch is toggled', async () => {
    const killed = await toggleKillSwitch('checkout_v2', 'production', true);
    expect(killed.environments.production).toMatchObject({ killSwitchActive: true, rolloutPercentage: 35, enabled: true });
    const released = await toggleKillSwitch('checkout_v2', 'production', false);
    expect(released.environments.production).toMatchObject({ killSwitchActive: false, rolloutPercentage: 35 });
  });

  it('evaluates deterministically with the shared bucket function and counts evaluations', async () => {
    const result = await evaluateFlag('vector_search', 'production', { userId: 'usr_x' });
    expect(result.reason).toBe('ROLLOUT_BUCKET');
    expect(result.bucket).toBe(computeBucket('usr_x', 'vector_search'));
    expect(result.enabled).toBe(result.bucket! < 15);
    const again = await evaluateFlag('vector_search', 'production', { userId: 'usr_x' });
    expect(again.bucket).toBe(result.bucket);
    expect((await fetchFlagByKey('vector_search')).evaluationCount).toBe(2);
  });

  it('applies the sample targeting rule and the kill switch precedence', async () => {
    const hit = await evaluateFlag('checkout_v2', 'production', { userId: 'u', attributes: { country: 'ee' } });
    expect(hit).toMatchObject({ enabled: true, reason: 'RULE_MATCH', matchedRuleId: 'rule_baltic_beta' });
    const killed = await evaluateFlag('legacy_md5_auth', 'production', { userId: 'u' });
    expect(killed.reason).toBe('KILL_SWITCH');
    await expect(evaluateFlag('checkout_v2', 'production', { userId: '' })).rejects.toThrow(/userId/);
  });

  it('deletes flags and restores the sample data on reset', async () => {
    await deleteFlag('checkout_v2');
    await expect(fetchFlagByKey('checkout_v2')).rejects.toThrow();
    await createFlag({ key: 'extra', name: 'Extra', description: '', tags: [] });
    resetDemoData();
    const keys = (await fetchFlags()).map((f) => f.key);
    expect(keys).toContain('checkout_v2');
    expect(keys).not.toContain('extra');
  });
});
