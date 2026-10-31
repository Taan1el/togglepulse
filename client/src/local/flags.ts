import type { EnvironmentConfig, EvaluationContext, FeatureFlag, TargetingRule } from '../../../shared/types';
import { ENVIRONMENTS, RULE_OPERATORS } from '../../../shared/evaluate';
export const MAX_FLAGS_FILE = 4 * 1024 * 1024;
export interface StaticFlag { key: string; name: string; description: string; tags: string[]; environments: Record<string, EnvironmentConfig> }
export interface FlagsFile { version: 1; bucketing: 'sha256-32be-mod100'; flags: StaticFlag[] }
export const emptyFlags = (): FlagsFile => ({ version: 1, bucketing: 'sha256-32be-mod100', flags: [] });
function fail(where: string, expected: string): never { throw new Error(`${where}: expected ${expected}.`); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function string(value: unknown, where: string, max = 500, empty = false): string { if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max || /[\u0000-\u001f]/.test(value)) fail(where, `${empty ? '0' : '1'} to ${max} characters without control characters`); return value as string; }
function bool(value: unknown, where: string): boolean { if (typeof value !== 'boolean') fail(where, 'true or false'); return value as boolean; }
export function parseRules(value: unknown, where = 'rules'): TargetingRule[] {
  if (!Array.isArray(value) || value.length > 50) fail(where, 'an array of at most 50 rules');
  const seen = new Set<string>();
  return value.map((rule, index) => {
    const path = `${where}[${index}]`; if (!object(rule)) fail(path, 'a rule object');
    const id = string(rule.id, `${path}.id`, 100); if (seen.has(id)) fail(`${path}.id`, 'a unique rule ID'); seen.add(id);
    const attribute = string(rule.attribute, `${path}.attribute`, 100);
    if (['__proto__', 'constructor', 'prototype'].includes(attribute)) fail(`${path}.attribute`, 'a non-reserved attribute');
    if (!RULE_OPERATORS.includes(rule.operator as TargetingRule['operator'])) fail(`${path}.operator`, RULE_OPERATORS.join(', '));
    if (!Array.isArray(rule.values) || rule.values.length < 1 || rule.values.length > 20) fail(`${path}.values`, '1 to 20 strings');
    const values = rule.values.map((item, position) => string(item, `${path}.values[${position}]`, 500));
    if (!['IN', 'NOT_IN'].includes(rule.operator as string) && values.length !== 1) fail(`${path}.values`, 'one value for this operator');
    if (rule.operator === 'SEMVER_GTE' && !/^\d{1,9}(?:\.\d{1,9}){0,3}$/.test(values[0])) fail(`${path}.values[0]`, 'a numeric dot version such as 2.5.0');
    return { id, attribute, operator: rule.operator as TargetingRule['operator'], values, serveValue: bool(rule.serveValue, `${path}.serveValue`) };
  });
}
export function parseFlags(input: string): FlagsFile {
  if (new TextEncoder().encode(input).length > MAX_FLAGS_FILE) fail('File', 'at most 4 MiB');
  let value: unknown; try { value = JSON.parse(input.replace(/^\uFEFF/, '')); } catch { return fail('File', 'valid flags JSON'); }
  if (!object(value) || value.version !== 1 || value.bucketing !== 'sha256-32be-mod100' || !Array.isArray(value.flags) || value.flags.length > 200) fail('File', 'version 1, bucketing sha256-32be-mod100, and at most 200 flags');
  const seen = new Set<string>();
  const flags = value.flags.map((flag, index): StaticFlag => {
    const path = `flags[${index}]`; if (!object(flag)) fail(path, 'a flag object');
    const key = string(flag.key, `${path}.key`, 100);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key) || seen.has(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) fail(`${path}.key`, 'a unique lowercase key using letters, digits, _ or -'); seen.add(key);
    const name = string(flag.name, `${path}.name`, 200); const description = string(flag.description, `${path}.description`, 1000, true);
    if (!Array.isArray(flag.tags) || flag.tags.length > 20) fail(`${path}.tags`, 'at most 20 strings');
    const tags = flag.tags.map((tag, position) => string(tag, `${path}.tags[${position}]`, 100));
    if (!object(flag.environments) || Object.keys(flag.environments).length !== 3 || !ENVIRONMENTS.every(env => Object.hasOwn(flag.environments as object, env))) fail(`${path}.environments`, 'production, staging, and development configs');
    const environments: Record<string, EnvironmentConfig> = {};
    for (const env of ENVIRONMENTS) {
      const config = flag.environments[env]; const place = `${path}.environments.${env}`;
      if (!object(config)) fail(place, 'an environment config');
      if (typeof config.rolloutPercentage !== 'number' || !Number.isFinite(config.rolloutPercentage) || config.rolloutPercentage < 0 || config.rolloutPercentage > 100) fail(`${place}.rolloutPercentage`, 'a number from 0 to 100');
      environments[env] = { enabled: bool(config.enabled, `${place}.enabled`), killSwitchActive: bool(config.killSwitchActive, `${place}.killSwitchActive`), rolloutPercentage: config.rolloutPercentage, rules: parseRules(config.rules, `${place}.rules`) };
    }
    return { key, name, description, tags, environments };
  });
  return { version: 1, bucketing: 'sha256-32be-mod100', flags };
}
export function parseContext(input: string): EvaluationContext {
  if (input.length > 16000) fail('Context', 'at most 16000 characters');
  let value: unknown; try { value = JSON.parse(input); } catch { return fail('Context', 'valid JSON'); }
  if (!object(value)) fail('Context', 'an object');
  const userId = string(value.userId, 'context.userId');
  const attributes: Record<string, string | number | boolean> = Object.create(null);
  if (value.attributes !== undefined) {
    if (!object(value.attributes) || Object.keys(value.attributes).length > 50) fail('context.attributes', 'an object of at most 50 scalar attributes');
    for (const [key, item] of Object.entries(value.attributes)) {
      string(key, 'attribute name', 100); if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Attribute', 'a non-reserved name');
      if (typeof item === 'string') attributes[key] = string(item, `attributes.${key}`, 500, true);
      else if (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) attributes[key] = item;
      else fail(`attributes.${key}`, 'a string, finite number, or boolean');
    }
  }
  return { userId, attributes };
}
export function matrixFlags(file: FlagsFile): FeatureFlag[] { return file.flags.map(flag => ({ ...flag, evaluationCount: 0, createdAt: '', updatedAt: '' })); }
