// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { defaultEnvironments, evaluateFlag } from '../../../shared/evaluate';
import { emptyFlags, matrixFlags, parseContext, parseFlags, parseRules, parseSaved, newFlagEnvironments, parseDetails, rulesFromDraft, splitValues, toDetails, toDraft, type FlagsFile } from './flags';
import { boundaryCases, evaluate, evaluatorSource, operatorCases, semverCases, testVectors } from './exports';
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
  it.each([0.1, 37.5, 99.9, 1e-7])('rejects the fractional rollout %s and names the flag and environment', value => {
    const data = fixture(); data.flags[0].environments.staging.rolloutPercentage = value;
    expect(() => parseFlags(JSON.stringify(data))).toThrow(`Flag "checkout" in staging: rolloutPercentage ${value} is not a whole percent`);
  });
  it.each([0, 1, 50, 99, 100])('accepts the whole percent %s', value => { const data = fixture(); data.flags[0].environments.production.rolloutPercentage = value; expect(parseFlags(JSON.stringify(data)).flags[0].environments.production.rolloutPercentage).toBe(value); });
  it('opens a workspace saved with a fractional rollout by rounding up to the percent it already served', async () => {
    const saved = fixture(); saved.flags[0].environments.production.rolloutPercentage = 0.1; saved.flags[0].environments.staging.rolloutPercentage = 37.5; saved.flags[0].environments.development.rolloutPercentage = 99.2;
    const { file, adjusted } = parseSaved(saved);
    expect(file.flags[0].environments.production.rolloutPercentage).toBe(1); expect(file.flags[0].environments.staging.rolloutPercentage).toBe(38); expect(file.flags[0].environments.development.rolloutPercentage).toBe(100);
    expect(adjusted).toHaveLength(3); expect(adjusted[0]).toContain('checkout in production was 0.1 percent and now reads 1 percent');
    for (let index = 0; index < 200; index++) { const userId = `saved-${index}`; expect((await evaluate(file, 'checkout', 'staging', { userId })).enabled).toBe((await evaluate(saved, 'checkout', 'staging', { userId })).enabled); }
    expect(saved.flags[0].environments.production.rolloutPercentage).toBe(0.1);
    expect(parseSaved(fixture()).adjusted).toEqual([]);
  });
  it('validates specific rule paths, cardinality and unique IDs', () => {
    const rule = { id: 'one', attribute: 'country', operator: 'EQUALS', values: ['EE'], serveValue: true };
    expect(parseRules([rule])[0]).toEqual(rule);
    expect(() => parseRules([rule, rule])).toThrow('unique rule ID');
    expect(() => parseRules([{ ...rule, operator: 'CUSTOM' }])).toThrow('rules[0].operator');
    expect(() => parseRules([{ ...rule, attribute: '__proto__' }])).toThrow('non-reserved');
    expect(() => parseRules([{ ...rule, values: [] }])).toThrow('values');
    expect(() => parseRules([{ ...rule, values: ['EE', 'FI'] }])).toThrow('one value');
    expect(() => parseRules([{ ...rule, operator: 'SEMVER_GTE', values: ['2.5.x'] }])).toThrow('SemVer version');
  });
  it.each(['{', '{}', '{"userId":5}', '{"userId":"x","attributes":{"__proto__":"yes"}}', '{"userId":"x","attributes":{"role":[]}}'])('rejects malformed contexts %s', input => expect(() => parseContext(input)).toThrow());
  it('copies only owned scalar context attributes', () => { expect(parseContext('{"userId":"x","attributes":{"country":"EE","paid":true,"age":42}}')).toEqual({ userId: 'x', attributes: { country: 'EE', paid: true, age: 42 } }); });
});
describe('new flag defaults', () => {
  it('starts disabled at 0 percent in every environment and still passes validation', async () => {
    const environments = newFlagEnvironments(); expect(Object.keys(environments)).toEqual(['production', 'staging', 'development']);
    for (const config of Object.values(environments)) expect(config).toEqual({ enabled: false, killSwitchActive: false, rolloutPercentage: 0, rules: [] });
    const file = { ...emptyFlags(), flags: [{ key: 'fresh', name: 'Fresh', description: '', tags: [], environments }] }; expect(parseFlags(JSON.stringify(file))).toEqual(file);
    for (const env of Object.keys(environments)) expect((await evaluate(file, 'fresh', env, { userId: 'visitor-1' })).enabled).toBe(false);
  });
});
describe('flag details editing', () => {
  const draft = (change: Partial<{ name: string; description: string; tags: string }> = {}) => ({ name: 'Checkout', description: 'New checkout', tags: 'payments, web', ...change });
  it('trims the name and description and splits, trims and de-duplicates tags', () => {
    expect(parseDetails(draft({ name: '  Checkout v2 ', description: ' Faster. ', tags: ' payments ,web,, payments , ' }))).toEqual({ name: 'Checkout v2', description: 'Faster.', tags: ['payments', 'web'] });
    expect(parseDetails(draft({ description: '', tags: '' }))).toEqual({ name: 'Checkout', description: '', tags: [] });
    expect(parseDetails(toDetails({ name: 'A', description: 'B', tags: ['x', 'y'] }))).toEqual({ name: 'A', description: 'B', tags: ['x', 'y'] });
  });
  it.each([
    [{ name: '  ' }, 'Flag name is required.'], [{ name: 'n'.repeat(201) }, 'at most 200 characters'], [{ name: 'a\tb' }, 'Flag name cannot contain'],
    [{ description: 'd'.repeat(1001) }, 'Description can be at most 1000'], [{ description: 'a\nb' }, 'Description cannot contain line breaks'],
    [{ tags: Array.from({ length: 21 }, (_, i) => `t${i}`).join(',') }, 'at most 20 tags'], [{ tags: `ok,${'t'.repeat(101)}` }, 'longer than 100 characters'],
  ])('rejects %j with a plain message', (change, message) => expect(() => parseDetails(draft(change))).toThrow(message));
  it('produces values the flags file validation accepts', () => {
    const file = fixture(); Object.assign(file.flags[0], parseDetails(draft({ name: ' Pay ', tags: 'b, a' }))); expect(parseFlags(JSON.stringify(file)).flags[0]).toMatchObject({ name: 'Pay', tags: ['b', 'a'] });
  });
});
describe('rule value editing', () => {
  const draft = (text: string, operator = 'IN') => ({ ...toDraft({ id: 'one', attribute: 'country', operator: operator as 'IN', values: ['x'], serveValue: true }), text });
  it('splits on any line ending, trims, drops blanks and removes exact duplicates', () => {
    expect(splitValues(' EE \r\n\r\nFI\rSE\n\n  EE\n  \t\n')).toEqual(['EE', 'FI', 'SE']);
    expect(splitValues('EE\nee')).toEqual(['EE', 'ee']);
    expect(splitValues('\n\r\n  ')).toEqual([]);
  });
  it('saves values with a trailing newline, CRLF and blank lines', () => {
    expect(rulesFromDraft([draft('EE\r\n\r\nFI\r\n')])[0].values).toEqual(['EE', 'FI']);
    expect(rulesFromDraft([draft('EE\n', 'EQUALS')])[0].values).toEqual(['EE']);
  });
  it('explains problems by rule position without index paths', () => {
    expect(() => rulesFromDraft([draft('EE'), draft('\n \n')])).toThrow('Rule 2 needs at least one value');
    expect(() => rulesFromDraft([draft('EE\nFI', 'EQUALS')])).toThrow('Rule 1 uses EQUALS, which takes one value, but has 2');
    expect(() => rulesFromDraft([draft('beta', 'SEMVER_GTE')])).toThrow('Rule 1: "beta" is not a SemVer version');
    expect(() => rulesFromDraft([draft(Array.from({ length: 21 }, (_, i) => `v${i}`).join('\n'))])).toThrow('limit is 20');
    expect(() => rulesFromDraft([{ ...draft('EE'), attribute: '  ' }])).toThrow('Rule 1 needs an attribute name');
  });
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
  it.each([
    ['2.5.0-beta2', '2.5.2', false], ['1.0.0-rc10', '1.0.10', false], ['2.5.0-beta2', '2.5.0', false], ['2.5.0', '2.5.0-beta2', true],
    ['1.0.0-alpha', '1.0.0-alpha.1', false], ['1.0.0-alpha.1', '1.0.0-alpha.beta', false], ['1.0.0-alpha.beta', '1.0.0-beta', false],
    ['1.0.0-beta', '1.0.0-beta.2', false], ['1.0.0-beta.2', '1.0.0-beta.11', false], ['1.0.0-beta.11', '1.0.0-rc.1', false], ['1.0.0-rc.1', '1.0.0', false],
    ['1.0.0-beta.11', '1.0.0-beta.2', true], ['1.0.0-alpha.beta', '1.0.0-alpha.1', true], ['1.0.0-rc.1', '1.0.0-beta.11', true], ['1.0.0-alpha.1', '1.0.0-alpha', true],
    ['1.0.0-RC.1', '1.0.0-rc.1', true], ['1.0.0+build.5', '1.0.0+build.9', true], ['1.0.0+b', '1.0.0-b', true], ['1.0.0-a+x', '1.0.0-a+y', true],
    ['v2.0', '2.0.0', true], ['2', '2.0.0', true], ['2.10.0', '2.9.0', true], ['2.9.0', '2.10.0', false],
    ['99999999999999999999.0.0', '99999999999999999998.0.0', true], ['2.5.2', '2.5.2', true],
    ['2.x', '1.0.0', false], ['latest', '1.0.0', false], ['1.0.0-', '0.1.0', false], ['1.0.0', 'abc', false], ['1.0.0', '', false],
    ['01.2.3', '1.2.3', false], ['1.2.3.4', '1.2.3', false], ['1.0.0-01', '1.0.0-0', false], ['1.0.0--', '0.0.0', true],
  ])('compares SemVer %s against %s with the same result in the editor and export (match %s)', async (attribute, rule, matches) => {
    const data = fixture(); data.flags[0].environments.production.rules = [{ id: 'rule', attribute: 'appVersion', operator: 'SEMVER_GTE', values: [rule], serveValue: true }];
    const context = { userId: 'test', attributes: { appVersion: attribute } }; const result = await evaluate(data, 'checkout', 'production', context);
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
describe('exported conformance vectors', () => {
  const legacyCompare = (a: string, b: string) => { const parts = (value: string) => value.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0); const aa = parts(a), bb = parts(b); for (let i = 0; i < Math.max(aa.length, bb.length); i++) if ((aa[i] || 0) !== (bb[i] || 0)) return (aa[i] || 0) > (bb[i] || 0) ? 1 : -1; return 0; };
  const kitFor = async () => testVectors(fixture());
  it('uses user IDs whose buckets match the recorded boundary table', () => {
    for (const [, bucket, userId] of boundaryCases) expect(createHash('sha256').update(`${userId}:boundary`).digest().readUInt32BE(0) % 100).toBe(bucket);
  });
  it('covers a user at the rollout percent and one just below it for 0, 1, 50, 99 and 100 percent', async () => {
    const kit = await kitFor(); const seen = new Map<number, number[]>();
    for (const group of kit.conformance.filter(item => item.flagKey === 'boundary')) {
      const percent = group.flags.flags[0].environments.production.rolloutPercentage; seen.set(percent, group.cases.map(item => item.expected.bucket as number));
      for (const item of group.cases) expect(item.expected).toMatchObject({ reason: 'ROLLOUT_BUCKET', enabled: (item.expected.bucket as number) < percent });
    }
    expect([...seen.keys()]).toEqual([0, 1, 50, 99, 100]);
    expect(seen.get(0)).toEqual([0]); expect(seen.get(1)).toEqual([1, 0]); expect(seen.get(50)).toEqual([50, 49]); expect(seen.get(99)).toEqual([99, 98]); expect(seen.get(100)).toEqual([99]);
  });
  it('matches the hand-written answers for every operator, missing attribute and version', async () => {
    const kit = await kitFor(); const truth = new Map<string, boolean>();
    for (const [operator, values, value, matches] of operatorCases) truth.set(`${operator}|${values.join(',')}|${value}`, matches);
    for (const [version, rule, matches] of semverCases) truth.set(`SEMVER_GTE|${rule}|${version}`, matches);
    let checked = 0;
    for (const group of kit.conformance.filter(item => item.flagKey === 'conformance')) {
      const rule = group.flags.flags[0].environments.production.rules[0];
      for (const item of group.cases) { const key = `${rule.operator}|${rule.values.join(',')}|${item.context.attributes?.probe}`; expect(truth.has(key), key).toBe(true); expect(item.expected.reason === 'RULE_MATCH', `${group.name}: ${item.name}`).toBe(truth.get(key)); checked++; }
    }
    expect(checked).toBe(operatorCases.length + semverCases.length);
    for (const operator of ['EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'STARTS_WITH', 'SEMVER_GTE']) expect(operatorCases.some(([name, , , matches]) => name === operator && !matches)).toBe(true);
  });
  it('gives the same answers in the exported module and the server evaluator', async () => {
    const exported = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(evaluatorSource).toString('base64')}`) as { evaluate: typeof evaluate };
    for (const group of (await kitFor()).conformance) for (const item of group.cases) {
      expect(await exported.evaluate(group.flags, group.flagKey, group.environment, item.context), `${group.name}: ${item.name}`).toEqual(item.expected);
      const { evaluatedAt: _time, ...server } = evaluateFlag(matrixFlags(group.flags as FlagsFile)[0], group.environment, item.context); expect(server, `${group.name}: ${item.name}`).toEqual(item.expected);
    }
  });
  it('fails a port that strips non-digits from versions or uses <= for the bucket check', async () => {
    const kit = await kitFor(); const cases = kit.conformance.flatMap(group => group.cases.map(item => ({ group, item })));
    const legacyMisses = cases.filter(({ group, item }) => { const rule = group.flags.flags[0].environments.production.rules[0]; return rule?.operator === 'SEMVER_GTE' && (legacyCompare(String(item.context.attributes?.probe).toLowerCase(), rule.values[0]) >= 0) !== (item.expected.reason === 'RULE_MATCH'); });
    expect(legacyMisses.length).toBeGreaterThanOrEqual(10);
    expect(cases.some(({ item }) => item.expected.reason === 'RULE_MATCH' && item.expected.matchedRuleId === 'probe-rule' && item.context.attributes?.probe === '2.5.0-beta2')).toBe(false);
    const lessOrEqual = cases.filter(({ group, item }) => group.flagKey === 'boundary' && ((item.expected.bucket as number) <= group.flags.flags[0].environments.production.rolloutPercentage) !== item.expected.enabled);
    expect(lessOrEqual.map(({ item }) => item.expected.bucket)).toEqual([0, 1, 50, 99]);
  });
  it('documents the crypto.subtle requirement in the exported files', async () => {
    expect(evaluatorSource).toMatch(/Requires crypto\.subtle/); expect((await kitFor()).notes.join(' ')).toMatch(/needs crypto\.subtle.*secure contexts/);
  });
});

