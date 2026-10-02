import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../shared/sha256.js';
import {
  computeBucket,
  compareSemver,
  defaultEnvironments,
  evaluateFlag,
  evaluateRule,
} from '../../shared/evaluate.js';
import type { FeatureFlag, TargetingRule } from '../../shared/types.js';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('shared sha256', () => {
  it('matches node:crypto for empty, short, block-boundary and unicode input', () => {
    const inputs = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'tallinn:ööü€', 'user:flag'];
    for (const input of inputs) {
      expect(hex(sha256(input))).toBe(crypto.createHash('sha256').update(input).digest('hex'));
    }
  });
});

describe('computeBucket', () => {
  it('matches the node:crypto formula for many users', () => {
    for (let i = 0; i < 200; i++) {
      const userId = `user-${i}`;
      const expected = crypto.createHash('sha256').update(`${userId}:checkout`).digest().readUInt32BE(0) % 100;
      expect(computeBucket(userId, 'checkout')).toBe(expected);
    }
  });

  it('is stable and always inside 0..99', () => {
    for (let i = 0; i < 500; i++) {
      const bucket = computeBucket(`u${i}`, 'flag');
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
      expect(computeBucket(`u${i}`, 'flag')).toBe(bucket);
    }
  });

  it('only adds users when the rollout percentage grows', () => {
    const flagAt = (pct: number): FeatureFlag => ({
      key: 'ramp', name: 'Ramp', description: '', tags: [], evaluationCount: 0,
      createdAt: '', updatedAt: '',
      environments: { production: { enabled: true, killSwitchActive: false, rolloutPercentage: pct, rules: [] } },
    });
    const enabledAt = (pct: number) => new Set(
      Array.from({ length: 300 }, (_, i) => `u${i}`)
        .filter((u) => evaluateFlag(flagAt(pct), 'production', { userId: u }).enabled)
    );
    const ten = enabledAt(10);
    const fifty = enabledAt(50);
    for (const user of ten) expect(fifty.has(user)).toBe(true);
    expect(fifty.size).toBeGreaterThan(ten.size);
    expect(enabledAt(0).size).toBe(0);
    expect(enabledAt(100).size).toBe(300);
  });
});

describe('rule operators', () => {
  const rule = (operator: TargetingRule['operator'], values: string[], attribute = 'country'): TargetingRule => ({
    id: 'r', attribute, operator, values, serveValue: true,
  });

  it('returns false when the attribute is missing, whatever the operator', () => {
    for (const op of ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'STARTS_WITH', 'SEMVER_GTE'] as const) {
      expect(evaluateRule(rule(op, ['x']), { userId: 'u' })).toBe(false);
    }
  });

  it('compares case-insensitively and supports userId as an attribute', () => {
    expect(evaluateRule(rule('EQUALS', ['ee']), { userId: 'u', attributes: { country: 'EE' } })).toBe(true);
    expect(evaluateRule(rule('IN', ['ADMIN_1'], 'userId'), { userId: 'admin_1' })).toBe(true);
    expect(evaluateRule(rule('NOT_IN', ['ee', 'fi']), { userId: 'u', attributes: { country: 'DE' } })).toBe(true);
    expect(evaluateRule(rule('NOT_EQUALS', ['ee']), { userId: 'u', attributes: { country: 'EE' } })).toBe(false);
    expect(evaluateRule(rule('CONTAINS', ['beta'], 'role'), { userId: 'u', attributes: { role: 'Beta_Tester' } })).toBe(true);
    expect(evaluateRule(rule('STARTS_WITH', ['usr_'], 'userId'), { userId: 'USR_9' })).toBe(true);
  });

  it('coerces numbers and booleans to strings', () => {
    expect(evaluateRule(rule('EQUALS', ['true'], 'beta'), { userId: 'u', attributes: { beta: true } })).toBe(true);
    expect(evaluateRule(rule('EQUALS', ['42'], 'age'), { userId: 'u', attributes: { age: 42 } })).toBe(true);
  });

  it('compares semantic versions numerically, not alphabetically', () => {
    expect(compareSemver('2.10.0', '2.9.0')).toBe(1);
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('v1.2.3', '1.2.4')).toBe(-1);
    expect(evaluateRule(rule('SEMVER_GTE', ['2.5.0'], 'appVersion'), { userId: 'u', attributes: { appVersion: '2.10.1' } })).toBe(true);
    expect(evaluateRule(rule('SEMVER_GTE', ['2.5.0'], 'appVersion'), { userId: 'u', attributes: { appVersion: '2.4.9' } })).toBe(false);
  });
});

describe('evaluateFlag precedence', () => {
  const flag = (): FeatureFlag => ({
    key: 'f', name: 'F', description: '', tags: [], evaluationCount: 0, createdAt: '', updatedAt: '',
    environments: {
      ...defaultEnvironments(),
      production: {
        enabled: true, killSwitchActive: false, rolloutPercentage: 0,
        rules: [
          { id: 'deny', attribute: 'country', operator: 'EQUALS', values: ['ru'], serveValue: false },
          { id: 'allow', attribute: 'country', operator: 'IN', values: ['ee', 'ru'], serveValue: true },
        ],
      },
    },
  });
  const now = new Date('2026-10-02T10:00:00Z');

  it('uses the first matching rule, even when a later rule also matches', () => {
    const result = evaluateFlag(flag(), 'production', { userId: 'u', attributes: { country: 'RU' } }, now);
    expect(result).toMatchObject({ enabled: false, reason: 'RULE_MATCH', matchedRuleId: 'deny' });
    expect(result.evaluatedAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('falls through to the rollout when no rule matches', () => {
    const result = evaluateFlag(flag(), 'production', { userId: 'u', attributes: { country: 'DE' } }, now);
    expect(result.reason).toBe('ROLLOUT_BUCKET');
    expect(result.enabled).toBe(false);
    expect(result.bucket).toBe(computeBucket('u', 'f'));
  });

  it('returns DEFAULT_OFF for an unknown environment and lets the kill switch beat a disabled flag check', () => {
    expect(evaluateFlag(flag(), 'qa', { userId: 'u' }, now).reason).toBe('DEFAULT_OFF');
    const killed = flag();
    killed.environments.production.killSwitchActive = true;
    killed.environments.production.enabled = false;
    expect(evaluateFlag(killed, 'production', { userId: 'u' }, now).reason).toBe('KILL_SWITCH');
  });
});
