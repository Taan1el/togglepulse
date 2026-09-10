export type RuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'SEMVER_GTE';

export interface TargetingRule {
  id: string;
  attribute: string;
  operator: RuleOperator;
  values: string[];
  serveValue: boolean;
}

export interface EnvironmentConfig {
  enabled: boolean;
  killSwitchActive: boolean;
  rolloutPercentage: number; // 0 - 100
  rules: TargetingRule[];
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  tags: string[];
  environments: Record<string, EnvironmentConfig>;
  evaluationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationContext {
  userId: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface EvaluationResult {
  flagKey: string;
  enabled: boolean;
  environment: string;
  reason: 'KILL_SWITCH' | 'DISABLED' | 'RULE_MATCH' | 'ROLLOUT_BUCKET' | 'DEFAULT_OFF';
  matchedRuleId?: string;
  bucket?: number;
  evaluatedAt: string;
}

export interface FlagStats {
  totalEvaluations: number;
  trueEvaluations: number;
  falseEvaluations: number;
  killSwitchEngagements: number;
}

export interface CreateFlagPayload {
  key: string;
  name: string;
  description: string;
  tags: string[];
  environments?: Record<string, Partial<EnvironmentConfig>>;
}

export interface UpdateRolloutPayload {
  environment: string;
  rolloutPercentage: number;
  enabled?: boolean;
  killSwitchActive?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
