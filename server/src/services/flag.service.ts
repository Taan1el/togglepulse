import crypto from 'node:crypto';
import type {
  FeatureFlag,
  CreateFlagPayload,
  UpdateRolloutPayload,
  EvaluationContext,
  EvaluationResult,
  FlagStats,
} from '../../../shared/types.js';
import { FlagRepository } from '../repositories/flag.repository.js';
import { EvaluatorService } from './evaluator.service.js';
import { ValidationError, NotFoundError } from '../errors.js';

export class FlagService {
  constructor(
    private flagRepo: FlagRepository,
    private evaluator: EvaluatorService
  ) {}

  createFlag(payload: CreateFlagPayload): FeatureFlag {
    const trimmedKey = typeof payload.key === 'string' ? payload.key.trim() : '';
    const trimmedName = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!trimmedKey || !trimmedName) {
      throw new ValidationError('Key and Name are required');
    }

    if (payload.tags !== undefined && !Array.isArray(payload.tags)) {
      throw new ValidationError('Tags must be an array of strings');
    }

    const cleanKey = trimmedKey.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    const existing = this.flagRepo.getFlagByKey(cleanKey);
    if (existing) {
      throw new ValidationError(`Flag with key "${cleanKey}" already exists`);
    }

    const defaultEnvs = {
      production: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 0,
        rules: [],
      },
      staging: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 100,
        rules: [],
      },
      development: {
        enabled: true,
        killSwitchActive: false,
        rolloutPercentage: 100,
        rules: [],
      },
    };

    const mergedEnvs = {
      production: { ...defaultEnvs.production, ...(payload.environments?.production || {}) },
      staging: { ...defaultEnvs.staging, ...(payload.environments?.staging || {}) },
      development: { ...defaultEnvs.development, ...(payload.environments?.development || {}) },
    };

    const now = new Date().toISOString();
    const flag: FeatureFlag = {
      key: cleanKey,
      name: trimmedName,
      description: payload.description || '',
      tags: payload.tags || [],
      environments: mergedEnvs,
      evaluationCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.flagRepo.createFlag(flag);
    return flag;
  }

  getFlag(key: string): FeatureFlag | null {
    return this.flagRepo.getFlagByKey(key);
  }

  getAllFlags(): FeatureFlag[] {
    return this.flagRepo.getAllFlags();
  }

  updateRollout(key: string, payload: UpdateRolloutPayload): FeatureFlag {
    const flag = this.flagRepo.getFlagByKey(key);
    if (!flag) throw new NotFoundError(`Flag not found: ${key}`);

    if (payload.rolloutPercentage !== undefined) {
      if (typeof payload.rolloutPercentage !== 'number' || !Number.isFinite(payload.rolloutPercentage)) {
        throw new ValidationError('rolloutPercentage must be a finite number between 0 and 100');
      }
    }

    const env = payload.environment || 'production';
    const currentEnv = flag.environments[env] || {
      enabled: true,
      killSwitchActive: false,
      rolloutPercentage: 0,
      rules: [],
    };

    const updatedEnv = {
      ...currentEnv,
      rolloutPercentage:
        payload.rolloutPercentage !== undefined
          ? Math.min(100, Math.max(0, payload.rolloutPercentage))
          : currentEnv.rolloutPercentage,
      enabled: payload.enabled !== undefined ? payload.enabled : currentEnv.enabled,
      killSwitchActive:
        payload.killSwitchActive !== undefined
          ? payload.killSwitchActive
          : currentEnv.killSwitchActive,
    };

    flag.environments[env] = updatedEnv;
    this.flagRepo.updateFlagEnvironments(key, flag.environments);

    return this.flagRepo.getFlagByKey(key)!;
  }

  toggleKillSwitch(key: string, environment = 'production', active: boolean): FeatureFlag {
    return this.updateRollout(key, {
      environment,
      killSwitchActive: active,
    });
  }

  evaluate(
    key: string,
    environment = 'production',
    context: EvaluationContext
  ): EvaluationResult {
    const flag = this.flagRepo.getFlagByKey(key);
    if (!flag) {
      throw new NotFoundError(`Flag not found: ${key}`);
    }

    const result = this.evaluator.evaluateFlag(flag, environment, context);

    // Increment evaluation metrics
    this.flagRepo.incrementEvaluationCount(key);
    this.flagRepo.recordEvaluationAudit({
      id: `aud_${crypto.randomBytes(6).toString('hex')}`,
      flagKey: key,
      environment,
      userId: context.userId,
      result: result.enabled,
      reason: result.reason,
      context: context.attributes || {},
      timestamp: result.evaluatedAt,
    });

    return result;
  }

  deleteFlag(key: string): boolean {
    return this.flagRepo.deleteFlag(key);
  }

  getRecentAudits(flagKey?: string, limit = 50): any[] {
    return this.flagRepo.getRecentAudits(flagKey, limit);
  }

  getFlagStats(key: string): FlagStats {
    return this.flagRepo.getFlagStats(key);
  }
}
