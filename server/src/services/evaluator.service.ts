import crypto from 'node:crypto';
import type {
  FeatureFlag,
  TargetingRule,
  EvaluationContext,
  EvaluationResult,
} from '../../../shared/types.js';

export class EvaluatorService {
  computeBucket(userId: string, flagKey: string): number {
    const hash = crypto
      .createHash('sha256')
      .update(`${userId}:${flagKey}`)
      .digest();
    return hash.readUInt32BE(0) % 100;
  }

  evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
    const rawVal =
      rule.attribute === 'userId'
        ? context.userId
        : context.attributes?.[rule.attribute];

    if (rawVal === undefined || rawVal === null) return false;
    const strVal = String(rawVal).toLowerCase();

    switch (rule.operator) {
      case 'EQUALS':
        return strVal === rule.values[0]?.toLowerCase();
      case 'NOT_EQUALS':
        return strVal !== rule.values[0]?.toLowerCase();
      case 'IN':
        return rule.values.map((v) => v.toLowerCase()).includes(strVal);
      case 'NOT_IN':
        return !rule.values.map((v) => v.toLowerCase()).includes(strVal);
      case 'CONTAINS':
        return strVal.includes(rule.values[0]?.toLowerCase() || '');
      case 'STARTS_WITH':
        return strVal.startsWith(rule.values[0]?.toLowerCase() || '');
      case 'SEMVER_GTE':
        return this.compareSemver(strVal, rule.values[0] || '0.0.0') >= 0;
      default:
        return false;
    }
  }

  compareSemver(a: string, b: string): number {
    const partsA = a.replace(/[^0-9.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
    const partsB = b.replace(/[^0-9.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  evaluateFlag(
    flag: FeatureFlag,
    environment = 'production',
    context: EvaluationContext
  ): EvaluationResult {
    const now = new Date().toISOString();
    const envConfig = flag.environments[environment];

    if (!envConfig) {
      return {
        flagKey: flag.key,
        enabled: false,
        environment,
        reason: 'DEFAULT_OFF',
        evaluatedAt: now,
      };
    }

    // Precedence 1: Emergency Kill Switch
    if (envConfig.killSwitchActive) {
      return {
        flagKey: flag.key,
        enabled: false,
        environment,
        reason: 'KILL_SWITCH',
        evaluatedAt: now,
      };
    }

    // Precedence 2: Environment Disabled
    if (!envConfig.enabled) {
      return {
        flagKey: flag.key,
        enabled: false,
        environment,
        reason: 'DISABLED',
        evaluatedAt: now,
      };
    }

    // Precedence 3: Targeted Rules
    if (envConfig.rules && envConfig.rules.length > 0) {
      for (const rule of envConfig.rules) {
        if (this.evaluateRule(rule, context)) {
          return {
            flagKey: flag.key,
            enabled: rule.serveValue,
            environment,
            reason: 'RULE_MATCH',
            matchedRuleId: rule.id,
            evaluatedAt: now,
          };
        }
      }
    }

    // Precedence 4: Percentage Rollout
    const bucket = this.computeBucket(context.userId, flag.key);
    const isWithinRollout = bucket < envConfig.rolloutPercentage;

    return {
      flagKey: flag.key,
      enabled: isWithinRollout,
      environment,
      reason: 'ROLLOUT_BUCKET',
      bucket,
      evaluatedAt: now,
    };
  }
}
