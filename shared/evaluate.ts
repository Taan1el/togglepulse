// Pure flag evaluation logic shared by the Express server and the in-browser
// demo. Nothing here touches storage or the network, and the clock is only
// read through the optional `now` argument.
import { sha256 } from './sha256.js';
import type {
  EnvironmentConfig,
  EvaluationContext,
  EvaluationResult,
  FeatureFlag,
  RuleOperator,
  TargetingRule,
} from './types.js';

export const ENVIRONMENTS = ['production', 'staging', 'development'] as const;

export const RULE_OPERATORS: readonly RuleOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'STARTS_WITH', 'SEMVER_GTE',
];

/**
 * Bucket 0-99 for a user and flag. The hash input is "userId:flagKey". The
 * bucket does not depend on the rollout percentage, so raising the percentage
 * only adds users and lowering it only removes users.
 */
export function computeBucket(userId: string, flagKey: string): number {
  const digest = sha256(`${userId}:${flagKey}`);
  const first32 = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  return first32 % 100;
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
  const partsA = parse(a);
  const partsB = parse(b);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

export function evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
  const rawVal = rule.attribute === 'userId' ? context.userId : context.attributes?.[rule.attribute];
  if (rawVal === undefined || rawVal === null) return false;
  const strVal = String(rawVal).toLowerCase();
  const first = rule.values[0]?.toLowerCase();

  switch (rule.operator) {
    case 'EQUALS':
      return strVal === first;
    case 'NOT_EQUALS':
      return strVal !== first;
    case 'IN':
      return rule.values.some((v) => v.toLowerCase() === strVal);
    case 'NOT_IN':
      return !rule.values.some((v) => v.toLowerCase() === strVal);
    case 'CONTAINS':
      return strVal.includes(first || '');
    case 'STARTS_WITH':
      return strVal.startsWith(first || '');
    case 'SEMVER_GTE':
      return compareSemver(strVal, rule.values[0] || '0.0.0') >= 0;
    default:
      return false;
  }
}

/**
 * Precedence: kill switch, disabled environment, targeting rules (first match
 * wins), then the percentage rollout.
 */
export function evaluateFlag(
  flag: FeatureFlag,
  environment: string,
  context: EvaluationContext,
  now: Date = new Date()
): EvaluationResult {
  const base = { flagKey: flag.key, environment, evaluatedAt: now.toISOString() };
  const env: EnvironmentConfig | undefined = flag.environments[environment];

  if (!env) return { ...base, enabled: false, reason: 'DEFAULT_OFF' };
  if (env.killSwitchActive) return { ...base, enabled: false, reason: 'KILL_SWITCH' };
  if (!env.enabled) return { ...base, enabled: false, reason: 'DISABLED' };

  for (const rule of env.rules ?? []) {
    if (evaluateRule(rule, context)) {
      return { ...base, enabled: rule.serveValue, reason: 'RULE_MATCH', matchedRuleId: rule.id };
    }
  }

  const bucket = computeBucket(context.userId, flag.key);
  return { ...base, enabled: bucket < env.rolloutPercentage, reason: 'ROLLOUT_BUCKET', bucket };
}

export function defaultEnvironments(): Record<string, EnvironmentConfig> {
  const make = (rolloutPercentage: number): EnvironmentConfig => ({
    enabled: true, killSwitchActive: false, rolloutPercentage, rules: [],
  });
  return { production: make(0), staging: make(100), development: make(100) };
}
