// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { defaultEnvironments, evaluateFlag } from '../../../shared/evaluate';
import { emptyFlags, matrixFlags, parseContext, parseFlags, parseRules, type FlagsFile } from './flags';
import { evaluate, evaluatorSource, testVectors } from './exports';
const fixture = (): FlagsFile => ({ ...emptyFlags(), flags: [{ key: 'checkout', name: 'Checkout', description: '', tags: ['synthetic'], environments: defaultEnvironments() }] });
describe('versioned flags files', () => {
  it('round trips schema fields and ignores extra metadata', () => { const data = fixture(); expect(parseFlags('\uFEFF' + JSON.stringify({ ...data, extra: 'ignored' }))).toEqual(data); });
  it.each([
    '{', '{"version":2}', JSON.stringify({ ...fixture(), bucketing: 'different' }),
    JSON.stringify({ ...fixture(), flags: [fixture().flags[0], fixture().flags[0]] }),
    JSON.stringify({ ...fixture(), flags: [{ ...fixture().flags[0], key: '__proto__' }] }),
    JSON.stringify({ ...fixture(), flags: [{ ...fixture().flags[0], environments: {} }] }),
    JSON.stringify({ ...fixture(), flags: [{ ...fixture().flags[0], name: 5 }] }),
  ])('rejects malformed or ambiguous file %s', input => expect(() => parseFlags(input)).toThrow());
  it.each([NaN, Infinity, -1, 101, '20', null])('rejects invalid rollout %s', value => { const data = fixture(); (data.flags[0].environments.production as unknown as Record<string, unknown>).rolloutPercentage = value; expect(() => parseFlags(JSON.stringify(data))).toThrow('rolloutPercentage'); });
  it('validates specific rule paths, cardinality and unique IDs', () => {
    const rule = { id: 'one', attribute: 'country', operator: 'EQUALS', values: ['EE'], serveValue: true };
    expect(parseRules([rule])[0]).toEqual(rule);
    expect(() => parseRules([rule, rule])).toThrow('unique rule ID');
    expect(() => parseRules([{ ...rule, operator: 'CUSTOM' }])).toThrow('rules[0].operator');
    expect(() => parseRules([{ ...rule, attribute: '__proto__' }])).toThrow('non-reserved');
    expect(() => parseRules([{ ...rule, values: [] }])).toThrow('values');
    expect(() => parseRules([{ ...rule, values: ['EE', 'FI'] }])).toThrow('one value');
    expect(() => parseRules([{ ...rule, operator: 'SEMVER_GTE', values: ['2.5-beta'] }])).toThrow('numeric dot');
  });
  it.each(['{', '{}', '{"userId":5}', '{"userId":"x","attributes":{"__proto__":"yes"}}', '{"userId":"x","attributes":{"role":[]}}'])('rejects malformed contexts %s', input => expect(() => parseContext(input)).toThrow());
  it('copies only owned scalar context attributes', () => { expect(parseContext('{"userId":"x","attributes":{"country":"EE","paid":true,"age":42}}')).toEqual({ userId: 'x', attributes: { country: 'EE', paid: true, age: 42 } }); });
});
describe('portable evaluator', () => {
  it('keeps bucket boundaries and Unicode aligned with native SHA-256 and the existing engine', async () => {
    const data = fixture(); data.flags[0].environments.production.rolloutPercentage = 37.5;
    for (let index = 0; index < 300; index++) {
      const userId = `visitor-õ-\u{1f600}-${index}`; const bucket = createHash('sha256').update(`${userId}:checkout`).digest().readUInt32BE(0) % 100;
      const result = await evaluate(data, 'checkout', 'production', { userId });
      expect(result.bucket).toBe(bucket); expect(result.enabled).toBe(bucket < 37.5);
      const { evaluatedAt: _time, ...legacy } = evaluateFlag(matrixFlags(data)[0], 'production', { userId }); expect(result).toEqual(legacy);
    }
  });
  it.each([
    ['EQUALS', ['EE'], 'ee', true], ['NOT_EQUALS', ['EE'], 'FI', true], ['IN', ['EE', 'FI'], 'fi', true], ['NOT_IN', ['EE', 'FI'], 'DE', true],
    ['CONTAINS', ['bet'], 'beta_tester', true], ['STARTS_WITH', ['beta'], 'BETA_tester', true], ['SEMVER_GTE', ['2.5.0'], '2.10.0', true],
    ['EQUALS', ['EE'], 'FI', false], ['SEMVER_GTE', ['2.5.0'], '2.4.9', false],
  ])('matches %s identically in the editor and export', async (operator, values, value, matches) => {
    const data = fixture(); data.flags[0].environments.production.rules = parseRules([{ id: 'rule', attribute: 'probe', operator, values, serveValue: true }]);
    const context = { userId: 'test', attributes: { probe: value } }; const result = await evaluate(data, 'checkout', 'production', context);
    expect(result.reason === 'RULE_MATCH').toBe(matches);
    const { evaluatedAt: _time, ...legacy } = evaluateFlag(matrixFlags(data)[0], 'production', context); expect(result).toEqual(legacy);
  });
  it('handles missing attributes, first-match false rules, disabled configs, kill switches, unknown keys and environments', async () => {
    const data = fixture(); const config = data.flags[0].environments.production;
    config.rolloutPercentage = 100; config.rules = parseRules([{ id: 'off', attribute: 'role', operator: 'NOT_EQUALS', values: ['admin'], serveValue: false }, { id: 'on', attribute: 'userId', operator: 'EQUALS', values: ['test'], serveValue: true }]);
    expect((await evaluate(data, 'checkout', 'production', { userId: 'test' })).matchedRuleId).toBe('on');
    expect((await evaluate(data, 'checkout', 'production', { userId: 'test', attributes: { role: 'user' } })).enabled).toBe(false);
    config.enabled = false; expect((await evaluate(data, 'checkout', 'production', { userId: 'test' })).reason).toBe('DISABLED');
    config.killSwitchActive = true; expect((await evaluate(data, 'checkout', 'production', { userId: 'test' })).reason).toBe('KILL_SWITCH');
    expect((await evaluate(data, 'none', 'production', { userId: 'test' })).reason).toBe('DEFAULT_OFF'); expect((await evaluate(data, 'checkout', 'none', { userId: 'test' })).reason).toBe('DEFAULT_OFF');
  });
  it('exports a standalone module that executes every exported vector and agrees with the existing evaluator', async () => {
    const data = fixture(); data.flags[0].environments.staging.killSwitchActive = true; data.flags[0].environments.development.enabled = false;
    const exported = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(evaluatorSource).toString('base64')}`) as { evaluate: typeof evaluate };
    expect(evaluatorSource.split('\n').length).toBeLessThanOrEqual(45); expect(evaluatorSource).not.toMatch(/^import /m);
    const kit = await testVectors(data);
    for (const vector of kit.vectors) {
      expect(await exported.evaluate(kit.flags, vector.flagKey, vector.environment, vector.context)).toEqual(vector.expected);
      const flag = matrixFlags(data).find(item => item.key === vector.flagKey);
      if (flag) { const { evaluatedAt: _time, ...legacy } = evaluateFlag(flag, vector.environment, vector.context); expect(vector.expected).toEqual(legacy); }
    }
  });
});


