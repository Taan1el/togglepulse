import type { EnvironmentConfig, EvaluationContext, FeatureFlag, TargetingRule } from '../../../shared/types';
import { formatCount } from '../utils/pluralize';
import { ENVIRONMENTS, RULE_OPERATORS, isSemver } from '../../../shared/evaluate';
export const MAX_FLAGS_FILE = 4 * 1024 * 1024;
export interface StaticFlag { key: string; name: string; description: string; tags: string[]; environments: Record<string, EnvironmentConfig> }
export interface FlagsFile { version: 1; bucketing: 'sha256-32be-mod100'; flags: StaticFlag[] }
/** New flags start switched off at 0 percent everywhere, so creating one never serves anyone. */
export const newFlagEnvironments = (): Record<string, EnvironmentConfig> => Object.fromEntries(ENVIRONMENTS.map(env => [env, { enabled: false, killSwitchActive: false, rolloutPercentage: 0, rules: [] }]));
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
    if (rule.operator === 'SEMVER_GTE' && !isSemver(values[0])) fail(`${path}.values[0]`, 'a SemVer version such as 2.5.0 or 2.5.0-rc.1');
    return { id, attribute, operator: rule.operator as TargetingRule['operator'], values, serveValue: bool(rule.serveValue, `${path}.serveValue`) };
  });
}
export interface RuleDraft extends TargetingRule { text: string }
export const toDraft = (rule: TargetingRule): RuleDraft => ({ ...rule, text: rule.values.join('\n') });
/** One value per line: any line ending, trimmed, blanks dropped, exact duplicates removed. */
export function splitValues(text: string): string[] { return [...new Set(text.split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean))]; }
/** Turns rule drafts into validated rules, with messages that name the rule by its position. */
export function rulesFromDraft(drafts: RuleDraft[]): TargetingRule[] {
  const rules = drafts.map(({ text, ...rule }, index) => {
    const who = `Rule ${index + 1}`; const values = splitValues(text);
    if (!rule.attribute.trim()) throw new Error(`${who} needs an attribute name.`);
    if (!values.length) throw new Error(`${who} needs at least one value. Enter one value per line.`);
    if (values.length > 20) throw new Error(`${who} has ${values.length} values; the limit is 20.`);
    if (values.some(value => value.length > 500)) throw new Error(`${who} has a value longer than 500 characters.`);
    if (values.some(value => /[\u0000-\u001f]/.test(value))) throw new Error(`${who} has a value with a control character. Remove it and save again.`);
    if (!['IN', 'NOT_IN'].includes(rule.operator) && values.length !== 1) throw new Error(`${who} uses ${rule.operator}, which takes one value, but has ${values.length}. Remove the extra lines or switch to IN.`);
    if (rule.operator === 'SEMVER_GTE' && !isSemver(values[0])) throw new Error(`${who}: "${values[0]}" is not a SemVer version. Use a form such as 2.5.0 or 2.5.0-rc.1.`);
    return { ...rule, values };
  });
  try { return parseRules(rules); } catch (caught) { throw new Error((caught as Error).message.replace(/^rules\[(\d+)\]/, (_match, index) => `Rule ${Number(index) + 1}`)); }
}
export interface DetailsDraft { name: string; description: string; tags: string }
export const toDetails = (flag: { name: string; description: string; tags: string[] }): DetailsDraft => ({ name: flag.name, description: flag.description, tags: flag.tags.join(', ') });
/** Validates the name, description and comma-separated tags typed for a flag, with plain messages. */
export function parseDetails(draft: DetailsDraft): { name: string; description: string; tags: string[] } {
  const name = draft.name.trim(); const description = draft.description.trim(); const tags = [...new Set(draft.tags.split(',').map(tag => tag.trim()).filter(Boolean))];
  const control = (text: string) => /[\u0000-\u001f]/.test(text);
  if (!name) throw new Error('Flag name is required.');
  if (name.length > 200) throw new Error(`Flag name can be at most 200 characters; it has ${name.length}.`);
  if (control(name)) throw new Error('Flag name cannot contain line breaks or control characters.');
  if (description.length > 1000) throw new Error(`Description can be at most 1000 characters; it has ${description.length}.`);
  if (control(description)) throw new Error('Description cannot contain line breaks or control characters.');
  if (tags.length > 20) throw new Error(`Use at most 20 tags; there are ${tags.length}.`);
  const long = tags.find(tag => tag.length > 100); if (long) throw new Error(`Tag "${long.slice(0, 20)}..." is longer than 100 characters.`);
  if (tags.some(control)) throw new Error('Tags cannot contain control characters.');
  return { name, description, tags };
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
      if (typeof config.rolloutPercentage !== 'number' || !Number.isFinite(config.rolloutPercentage) || config.rolloutPercentage < 0 || config.rolloutPercentage > 100) fail(`${place}.rolloutPercentage`, 'a whole number from 0 to 100');
      if (!Number.isInteger(config.rolloutPercentage)) throw new Error(`Flag "${key}" in ${env}: rolloutPercentage ${config.rolloutPercentage} is not a whole percent. Buckets are whole percents, so use a whole number from 0 to 100.`);
      environments[env] = { enabled: bool(config.enabled, `${place}.enabled`), killSwitchActive: bool(config.killSwitchActive, `${place}.killSwitchActive`), rolloutPercentage: config.rolloutPercentage, rules: parseRules(config.rules, `${place}.rules`) };
    }
    return { key, name, description, tags, environments };
  });
  return { version: 1, bucketing: 'sha256-32be-mod100', flags };
}
/**
 * Reads a workspace saved by an earlier version. Fractional rollouts used to be
 * accepted; a user is on when bucket < percentage, so 0.1 served exactly the
 * users that 1 serves. Round those up to the whole percent they already served
 * and report each change instead of refusing to open the workspace.
 */
export function parseSaved(data: unknown): { file: FlagsFile; adjusted: string[] } {
  const adjusted: string[] = []; const copy = structuredClone(data) as { flags?: unknown };
  if (object(copy) && Array.isArray(copy.flags)) for (const flag of copy.flags) if (object(flag) && object(flag.environments)) for (const env of ENVIRONMENTS) {
    const config = flag.environments[env];
    if (object(config) && typeof config.rolloutPercentage === 'number' && config.rolloutPercentage > 0 && config.rolloutPercentage < 100 && !Number.isInteger(config.rolloutPercentage)) {
      const whole = Math.ceil(config.rolloutPercentage); adjusted.push(`${String(flag.key)} in ${env} was ${config.rolloutPercentage} percent and now reads ${whole} percent, which serves the same users.`); config.rolloutPercentage = whole;
    }
  }
  return { file: parseFlags(JSON.stringify(copy)), adjusted };
}
/** "3 flags and 7 targeting rules", used to say what an import replaces. */
export function describeFlags(file: FlagsFile): string {
  const rules = file.flags.reduce((total, flag) => total + ENVIRONMENTS.reduce((sum, env) => sum + flag.environments[env].rules.length, 0), 0);
  return `${formatCount(file.flags.length, 'flag')} and ${formatCount(rules, 'targeting rule')}`;
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
