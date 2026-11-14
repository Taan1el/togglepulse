import { evaluate } from '../../../shared/static-evaluator.js';
import evaluatorSource from '../../../shared/static-evaluator.js?raw';
import { ENVIRONMENTS } from '../../../shared/evaluate';
import type { EvaluationContext, TargetingRule } from '../../../shared/types';
import type { FlagsFile } from './flags';
export { evaluate, evaluatorSource };

// Truth tables for the conformance groups. The expected results shipped in test-vectors.json are
// produced by evaluate(); the tests check them against these hand-written answers, so a wrong
// evaluator cannot quietly rewrite its own expectations.

/** [rollout percent, bucket of the user, user ID]. Buckets belong to the flag key "boundary". A user is on when bucket < percent. */
export const boundaryCases: Array<[number, number, string]> = [
  [0, 0, 'boundary-40'], [1, 1, 'boundary-63'], [1, 0, 'boundary-40'], [50, 50, 'boundary-71'], [50, 49, 'boundary-41'],
  [99, 99, 'boundary-29'], [99, 98, 'boundary-240'], [100, 99, 'boundary-29'],
];
/** [operator, rule values, attribute value (undefined means the attribute is missing), whether the rule matches]. */
export const operatorCases: Array<[TargetingRule['operator'], string[], string | undefined, boolean]> = [
  ['EQUALS', ['EE'], 'ee', true], ['EQUALS', ['EE'], 'FI', false], ['EQUALS', ['EE'], 'EEE', false], ['EQUALS', ['EE'], undefined, false],
  ['NOT_EQUALS', ['EE'], 'FI', true], ['NOT_EQUALS', ['EE'], 'ee', false], ['NOT_EQUALS', ['EE'], undefined, false],
  ['IN', ['EE', 'FI'], 'fi', true], ['IN', ['EE', 'FI'], 'DE', false], ['IN', ['EE', 'FI'], undefined, false],
  ['NOT_IN', ['EE', 'FI'], 'DE', true], ['NOT_IN', ['EE', 'FI'], 'fi', false], ['NOT_IN', ['EE', 'FI'], undefined, false],
  ['CONTAINS', ['bet'], 'Beta_Tester', true], ['CONTAINS', ['bet'], 'alpha', false], ['CONTAINS', ['bet'], undefined, false],
  ['STARTS_WITH', ['beta'], 'BETA_tester', true], ['STARTS_WITH', ['beta'], 'tester_beta', false], ['STARTS_WITH', ['beta'], undefined, false],
  ['SEMVER_GTE', ['2.5.0'], '2.10.0', true], ['SEMVER_GTE', ['2.5.0'], '2.4.9', false], ['SEMVER_GTE', ['2.5.0'], undefined, false],
];
/** [app version, SEMVER_GTE rule value, whether the rule matches]: SemVer 2.0.0 precedence, case-insensitive, invalid versions never match. */
export const semverCases: Array<[string, string, boolean]> = [
  ['2.5.0-beta2', '2.5.2', false], ['2.5.0-beta2', '2.5.0', false], ['2.5.0', '2.5.0-beta2', true], ['2.5.0', '2.5.0', true], ['2.5.1', '2.5.0', true], ['2.4.9', '2.5.0', false],
  ['1.0.0-rc10', '1.0.10', false], ['1.0.0-rc.1', '1.0.0', false], ['1.0.0', '1.0.0-rc.1', true],
  ['1.0.0-alpha', '1.0.0-alpha.1', false], ['1.0.0-alpha.1', '1.0.0-alpha', true], ['1.0.0-alpha.1', '1.0.0-alpha.beta', false], ['1.0.0-alpha.beta', '1.0.0-alpha.1', true],
  ['1.0.0-beta', '1.0.0-alpha.beta', true], ['1.0.0-alpha.beta', '1.0.0-beta', false], ['1.0.0-beta.2', '1.0.0-beta.11', false], ['1.0.0-beta.11', '1.0.0-beta.2', true],
  ['1.0.0-beta.11', '1.0.0-rc.1', false], ['1.0.0-rc.1', '1.0.0-beta.11', true], ['1.0.0-RC.1', '1.0.0-rc.1', true],
  ['1.0.0+build.5', '1.0.0+build.9', true], ['1.0.0+build.5', '1.0.0-rc.1', true], ['1.0.0-rc.1+build.5', '1.0.0', false],
  ['v2.0', '2.0.0', true], ['2', '2.0.0', true], ['1.9.0', '2', false], ['2.10.0', '2.9.0', true], ['2.9.0', '2.10.0', false],
  ['2.x', '1.0.0', false], ['latest', '1.0.0', false], ['1.0.0-', '0.1.0', false], ['1.2.3.4', '1.2.3', false], ['01.2.3', '1.2.3', false], ['1.0.0-01', '1.0.0-0', false],
  ['1.0.0', 'abc', false], ['9.9.9', '', false],
];

export interface ConformanceGroup {
  name: string; flags: FlagsFile; flagKey: string; environment: string;
  cases: Array<{ name: string; context: EvaluationContext; expected: Awaited<ReturnType<typeof evaluate>> }>;
}
const groupFile = (key: string, rolloutPercentage: number, rules: TargetingRule[]): FlagsFile => {
  const config = () => ({ enabled: true, killSwitchActive: false, rolloutPercentage, rules });
  return { version: 1, bucketing: 'sha256-32be-mod100', flags: [{ key, name: key, description: 'Synthetic flag for conformance checks', tags: [], environments: { production: config(), staging: config(), development: config() } }] };
};
const probeRule = (operator: TargetingRule['operator'], values: string[]): TargetingRule => ({ id: 'probe-rule', attribute: 'probe', operator, values, serveValue: true });
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
async function conformance(): Promise<ConformanceGroup[]> {
  const groups: ConformanceGroup[] = [];
  const add = async (name: string, flags: FlagsFile, cases: Array<{ name: string; context: EvaluationContext }>) => {
    const flagKey = flags.flags[0].key;
    groups.push({ name, flags, flagKey, environment: 'production', cases: await Promise.all(cases.map(async item => ({ ...item, expected: await evaluate(flags, flagKey, 'production', item.context) }))) });
  };
  for (const percent of [0, 1, 50, 99, 100]) {
    await add(`Rollout ${percent} percent: a user is on when bucket < ${percent}`, groupFile('boundary', percent, []),
      boundaryCases.filter(([rollout]) => rollout === percent).map(([, bucket, userId]) => ({ name: `bucket ${bucket} is ${bucket < percent ? 'on' : 'off'}`, context: { userId } })));
  }
  for (const [name, items] of groupBy(operatorCases, item => `${item[0]} ${JSON.stringify(item[1])}`)) {
    await add(`Operator ${name} with rollout 0`, groupFile('conformance', 0, [probeRule(items[0][0], items[0][1])]),
      items.map(([, , value, matches]) => ({ name: `${value === undefined ? 'missing attribute' : JSON.stringify(value)} ${matches ? 'matches' : 'does not match'}`, context: { userId: 'conformance-user', attributes: (value === undefined ? {} : { probe: value }) as Record<string, string> } })));
  }
  for (const [rule, items] of groupBy(semverCases, item => item[1])) {
    await add(`SEMVER_GTE ${JSON.stringify(rule)} with rollout 0`, groupFile('conformance', 0, [probeRule('SEMVER_GTE', [rule])]),
      items.map(([version, , matches]) => ({ name: `${JSON.stringify(version)} ${matches ? 'matches' : 'does not match'}`, context: { userId: 'conformance-user', attributes: { probe: version } } })));
  }
  return groups;
}

export async function testVectors(file: FlagsFile) {
  const contexts: EvaluationContext[] = [
    { userId: 'visitor-0' }, { userId: 'visitor-1' }, { userId: 'visitor-42', attributes: { country: 'EE', role: 'beta_tester', appVersion: '2.5.0' } },
    { userId: 'visitor-unicode-õ', attributes: { country: 'FI', role: 'user', appVersion: '1.0.0' } },
  ];
  const vectors = [];
  for (const flag of file.flags) for (const environment of ENVIRONMENTS) {
    const probes = [...contexts, ...flag.environments[environment].rules.slice(0, 8).map(rule => rule.attribute === 'userId' ? { userId: rule.values[0] } : { userId: 'rule-probe', attributes: { [rule.attribute]: rule.values[0] } })];
    for (const context of probes) vectors.push({ flagKey: flag.key, environment, context, expected: await evaluate(file, flag.key, environment, context) });
  }
  vectors.push({ flagKey: '__missing__', environment: 'production', context: contexts[0], expected: await evaluate(file, '__missing__', 'production', contexts[0]) });
  return {
    version: 1, bucketing: file.bucketing,
    notes: [
      'evaluate.js is asynchronous and needs crypto.subtle. Browsers expose it only in secure contexts (HTTPS or localhost); Node, Deno and Bun provide it.',
      'vectors: run each entry against the top-level flags and compare evaluate() with expected using deep equality.',
      'conformance: each group carries its own flags file. Run every case with the group flagKey, environment and the case context. The groups are the same for every export and cover rollout bucket boundaries, every operator including non-matches and missing attributes, and SemVer 2.0.0 prerelease ordering, so a port with a different comparison or bucket check fails them.',
    ],
    flags: file, vectors, conformance: await conformance(),
  };
}
