// In-browser stand-in for services/api.ts, used on the GitHub Pages build
// (import.meta.env.VITE_DEMO_MODE === 'true') where no Express server exists.
// Every export matches api.ts, backed by the same shared evaluation and
// validation code the server runs, with flags held in memory. Reloading the
// page or calling resetDemoData() returns to the fixed sample data.
import type {
  CreateFlagPayload,
  EvaluationContext,
  EvaluationResult,
  FeatureFlag,
  UpdateRolloutPayload,
} from '../../../shared/types.js';
import { ENVIRONMENTS, defaultEnvironments, evaluateFlag as evaluate } from '../../../shared/evaluate.js';
import { validateCreateFlagPayload, ValidationError } from '../../../shared/validate.js';
import { SAMPLE_EVALUATIONS, SAMPLE_FLAGS } from '../../../shared/sample-flags.js';

// Fixed so the sample data is identical on every load.
const SAMPLE_TIME = new Date('2026-10-01T09:00:00.000Z');

let flags = new Map<string, FeatureFlag>();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildFlag(payload: CreateFlagPayload, now: Date): FeatureFlag {
  const { key, name } = validateCreateFlagPayload(payload);
  const defaults = defaultEnvironments();
  const iso = now.toISOString();
  return {
    key,
    name,
    description: payload.description || '',
    tags: payload.tags || [],
    environments: {
      production: { ...defaults.production, ...(payload.environments?.production || {}) },
      staging: { ...defaults.staging, ...(payload.environments?.staging || {}) },
      development: { ...defaults.development, ...(payload.environments?.development || {}) },
    },
    evaluationCount: 0,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function resetDemoData(): void {
  flags = new Map();
  SAMPLE_FLAGS.forEach((sample, index) => {
    const flag = buildFlag(sample, new Date(SAMPLE_TIME.getTime() - (SAMPLE_FLAGS.length - index) * 60_000));
    flags.set(flag.key, flag);
  });
  for (const sample of SAMPLE_EVALUATIONS) {
    const flag = flags.get(sample.flagKey);
    if (flag) {
      flag.evaluationCount += 1;
    }
  }
}

resetDemoData();

function requireFlag(key: string): FeatureFlag {
  const flag = flags.get(key);
  if (!flag) throw new Error(`Flag not found: ${key}`);
  return flag;
}

export async function fetchFlags(): Promise<FeatureFlag[]> {
  return clone([...flags.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export async function fetchFlagByKey(key: string): Promise<FeatureFlag> {
  return clone(requireFlag(key));
}

export async function createFlag(payload: CreateFlagPayload): Promise<FeatureFlag> {
  const { key } = validateCreateFlagPayload(payload);
  if (flags.has(key)) throw new ValidationError(`Flag with key "${key}" already exists`);
  const flag = buildFlag(payload, new Date());
  flags.set(flag.key, flag);
  return clone(flag);
}

export async function updateRollout(key: string, payload: UpdateRolloutPayload): Promise<FeatureFlag> {
  const flag = requireFlag(key);
  const environment = payload.environment ?? 'production';
  if (!(ENVIRONMENTS as readonly string[]).includes(environment)) {
    throw new ValidationError(`environment must be one of ${ENVIRONMENTS.join(', ')}`);
  }
  const current = flag.environments[environment];
  if (payload.rolloutPercentage !== undefined) {
    if (typeof payload.rolloutPercentage !== 'number' || !Number.isFinite(payload.rolloutPercentage)) {
      throw new ValidationError('rolloutPercentage must be a finite number between 0 and 100');
    }
    current.rolloutPercentage = Math.min(100, Math.max(0, payload.rolloutPercentage));
  }
  if (payload.enabled !== undefined) current.enabled = payload.enabled;
  if (payload.killSwitchActive !== undefined) current.killSwitchActive = payload.killSwitchActive;
  flag.updatedAt = new Date().toISOString();
  return clone(flag);
}

export async function toggleKillSwitch(key: string, environment: string, active: boolean): Promise<FeatureFlag> {
  return updateRollout(key, { environment, killSwitchActive: active });
}

export async function evaluateFlag(
  key: string,
  environment: string,
  context: EvaluationContext
): Promise<EvaluationResult> {
  const flag = requireFlag(key);
  if (!context || typeof context.userId !== 'string' || !context.userId) {
    throw new Error('Context with userId is required for evaluation');
  }
  flag.evaluationCount += 1;
  return evaluate(flag, environment, context);
}

export async function deleteFlag(key: string): Promise<void> {
  flags.delete(key);
}
