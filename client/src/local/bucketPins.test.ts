// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeBucket, defaultEnvironments, evaluateFlag } from '../../../shared/evaluate';
import { evaluate } from '../../../shared/static-evaluator.js';
import { emptyFlags, matrixFlags } from './flags';

// Buckets recorded from the released evaluator. A change that moves any of
// these reassigns real users between rollout groups.
const pinned: Record<string, Record<string, number>> = {
  checkout: {
    '0': 74, 'visitor-0': 25, 'visitor-1': 71, 'visitor-42': 99, 'visitor-unicode-õ': 90, 'user-1': 53, 'user-2': 70, 'user-3': 60,
    alice: 24, bob: 19, carol: 4, u1: 26, u2: 86, a: 67, [`${'x'.repeat(40)}`]: 66, 'visitor-😀-7': 10, 'Straße': 18,
    'ID with spaces': 81, 'tallinn:ööü€': 29, 'visitor-99': 15,
  },
  dark_mode: {
    '0': 51, 'visitor-0': 89, 'visitor-1': 36, 'visitor-42': 61, 'visitor-unicode-õ': 35, 'user-1': 1, 'user-2': 62, 'user-3': 79,
    alice: 53, bob: 39, carol: 7, u1: 57, u2: 35, a: 10, [`${'x'.repeat(40)}`]: 55, 'visitor-😀-7': 13, 'Straße': 12,
    'ID with spaces': 72, 'tallinn:ööü€': 78, 'visitor-99': 84,
  },
};

describe('pinned buckets for whole-percent rollouts', () => {
  it('keeps every recorded user in the same bucket in all evaluators', async () => {
    for (const [key, users] of Object.entries(pinned)) {
      const file = { ...emptyFlags(), flags: [{ key, name: key, description: '', tags: [], environments: defaultEnvironments() }] };
      for (const [userId, bucket] of Object.entries(users)) {
        expect(computeBucket(userId, key)).toBe(bucket);
        for (const percentage of [bucket, bucket + 1]) {
          file.flags[0].environments.production = { enabled: true, killSwitchActive: false, rolloutPercentage: percentage, rules: [] };
          const exported = await evaluate(file, key, 'production', { userId });
          expect(exported).toMatchObject({ bucket, enabled: bucket < percentage, reason: 'ROLLOUT_BUCKET' });
          const { evaluatedAt: _time, ...shared } = evaluateFlag(matrixFlags(file)[0], 'production', { userId });
          expect(shared).toEqual(exported);
        }
      }
    }
  });
});
