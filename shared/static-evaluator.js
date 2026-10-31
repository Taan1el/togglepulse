// Standalone ES module. Accept only a validated version 1 flags file.
// SHA-256 uses UTF-8 userId:flagKey; the first unsigned big-endian word mod 100.
export async function evaluate(file, flagKey, environment, context) {
  if (file.version !== 1 || file.bucketing !== 'sha256-32be-mod100' || !Array.isArray(file.flags)) throw new TypeError('Unsupported flags file');
  if (!context || typeof context.userId !== 'string' || !context.userId || context.userId.length > 500) throw new TypeError('Expected userId (1 to 500 characters)');
  const flag = file.flags.find(item => item.key === flagKey);
  const base = { flagKey, environment };
  const env = flag && Object.hasOwn(flag.environments, environment) ? flag.environments[environment] : undefined;
  if (!env) return { ...base, enabled: false, reason: 'DEFAULT_OFF' };
  if (env.killSwitchActive) return { ...base, enabled: false, reason: 'KILL_SWITCH' };
  if (!env.enabled) return { ...base, enabled: false, reason: 'DISABLED' };
  const compare = (a, b) => {
    const parts = value => value.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
    const aa = parts(a), bb = parts(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) if ((aa[i] || 0) !== (bb[i] || 0)) return (aa[i] || 0) > (bb[i] || 0) ? 1 : -1;
    return 0;
  };
  for (const rule of env.rules) {
    const raw = rule.attribute === 'userId' ? context.userId : context.attributes && Object.hasOwn(context.attributes, rule.attribute) ? context.attributes[rule.attribute] : undefined;
    if (raw === undefined || raw === null) continue;
    const value = String(raw).toLowerCase(), first = (rule.values[0] || '').toLowerCase();
    const matches = { EQUALS: () => value === first, NOT_EQUALS: () => value !== first,
      IN: () => rule.values.some(item => item.toLowerCase() === value), NOT_IN: () => !rule.values.some(item => item.toLowerCase() === value),
      CONTAINS: () => value.includes(first), STARTS_WITH: () => value.startsWith(first), SEMVER_GTE: () => compare(value, first) >= 0 };
    if (matches[rule.operator] && matches[rule.operator]()) return { ...base, enabled: rule.serveValue, reason: 'RULE_MATCH', matchedRuleId: rule.id };
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${context.userId}:${flagKey}`));
  const bucket = new DataView(digest).getUint32(0, false) % 100;
  return { ...base, enabled: bucket < env.rolloutPercentage, reason: 'ROLLOUT_BUCKET', bucket };
}
