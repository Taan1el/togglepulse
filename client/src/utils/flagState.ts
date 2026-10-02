import type { EnvironmentConfig, FeatureFlag } from '../../../shared/types.js';

export type FlagStateKind = 'killed' | 'off' | 'idle' | 'rolling' | 'live';

export interface FlagState {
  kind: FlagStateKind;
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
}

export const EMPTY_ENV: EnvironmentConfig = {
  enabled: false,
  killSwitchActive: false,
  rolloutPercentage: 0,
  rules: [],
};

export function getEnvConfig(flag: FeatureFlag, environment: string): EnvironmentConfig {
  return flag.environments[environment] ?? EMPTY_ENV;
}

/** Collapses an environment's settings into the one state shown in the table. */
export function describeState(env: EnvironmentConfig): FlagState {
  if (env.killSwitchActive) return { kind: 'killed', label: 'Kill switch on', tone: 'bad' };
  if (!env.enabled) return { kind: 'off', label: 'Off', tone: 'neutral' };
  if (env.rolloutPercentage <= 0) return { kind: 'idle', label: 'On, 0% served', tone: 'neutral' };
  if (env.rolloutPercentage >= 100) return { kind: 'live', label: 'Live', tone: 'ok' };
  return { kind: 'rolling', label: 'Rolling out', tone: 'warn' };
}
