import { evaluate } from '../../../shared/static-evaluator.js';
import evaluatorSource from '../../../shared/static-evaluator.js?raw';
import { ENVIRONMENTS } from '../../../shared/evaluate';
import type { EvaluationContext } from '../../../shared/types';
import type { FlagsFile } from './flags';
export { evaluate, evaluatorSource };
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
  return { version: 1, bucketing: file.bucketing, flags: file, vectors };
}
