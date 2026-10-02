import type {
  FeatureFlag,
  TargetingRule,
  EvaluationContext,
  EvaluationResult,
} from '../../../shared/types.js';
import {
  computeBucket,
  compareSemver,
  evaluateFlag,
  evaluateRule,
} from '../../../shared/evaluate.js';

// Thin wrapper so the service layer keeps one injectable object. The logic
// itself lives in shared/evaluate.ts and also runs in the browser demo.
export class EvaluationEngine {
  computeBucket(userId: string, flagKey: string): number {
    return computeBucket(userId, flagKey);
  }

  evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
    return evaluateRule(rule, context);
  }

  compareSemver(a: string, b: string): number {
    return compareSemver(a, b);
  }

  evaluateFlag(flag: FeatureFlag, environment = 'production', context: EvaluationContext): EvaluationResult {
    return evaluateFlag(flag, environment, context);
  }
}
