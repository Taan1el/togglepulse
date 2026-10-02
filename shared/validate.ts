// Input validation shared by the Express server and the browser demo, so both
// reject the same flag payloads with the same messages.
import { ENVIRONMENTS, RULE_OPERATORS } from './evaluate.js';
import type { CreateFlagPayload } from './types.js';

export class ValidationError extends Error {
  code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeFlagKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function validateRules(rules: unknown, environment: string): void {
  const where = `environments.${environment}.rules`;
  if (!Array.isArray(rules)) {
    throw new ValidationError(`${where} must be an array`);
  }
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!isPlainObject(rule)) {
      throw new ValidationError(`${where} entries must be objects`);
    }
    if (typeof rule.id !== 'string' || !rule.id || seen.has(rule.id)) {
      throw new ValidationError(`${where} entries need a unique string id`);
    }
    seen.add(rule.id);
    if (typeof rule.attribute !== 'string' || !rule.attribute) {
      throw new ValidationError(`${where} entries need an attribute`);
    }
    if (!RULE_OPERATORS.includes(rule.operator)) {
      throw new ValidationError(`${where} operator must be one of ${RULE_OPERATORS.join(', ')}`);
    }
    if (!Array.isArray(rule.values) || rule.values.some((v: unknown) => typeof v !== 'string')) {
      throw new ValidationError(`${where} values must be an array of strings`);
    }
    if (typeof rule.serveValue !== 'boolean') {
      throw new ValidationError(`${where} serveValue must be a boolean`);
    }
  }
}

/** Throws ValidationError for a bad payload; returns the normalized key and trimmed name. */
export function validateCreateFlagPayload(payload: CreateFlagPayload): { key: string; name: string } {
  const trimmedKey = typeof payload.key === 'string' ? payload.key.trim() : '';
  const trimmedName = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!trimmedKey || !trimmedName) {
    throw new ValidationError('Key and Name are required');
  }

  if (payload.tags !== undefined && !Array.isArray(payload.tags)) {
    throw new ValidationError('Tags must be an array of strings');
  }

  if (payload.environments !== undefined) {
    if (!isPlainObject(payload.environments)) {
      throw new ValidationError('environments must be an object');
    }
    for (const environment of ENVIRONMENTS) {
      const config = payload.environments[environment];
      if (config === undefined) continue;
      if (!isPlainObject(config)) {
        throw new ValidationError(`environments.${environment} must be an object`);
      }
      for (const field of ['enabled', 'killSwitchActive'] as const) {
        if (config[field] !== undefined && typeof config[field] !== 'boolean') {
          throw new ValidationError(`environments.${environment}.${field} must be a boolean`);
        }
      }
      const percentage = config.rolloutPercentage;
      if (percentage !== undefined && (
        typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100
      )) {
        throw new ValidationError(`environments.${environment}.rolloutPercentage must be a finite number between 0 and 100`);
      }
      if (config.rules !== undefined) {
        validateRules(config.rules, environment);
      }
    }
  }

  return { key: normalizeFlagKey(trimmedKey), name: trimmedName };
}
