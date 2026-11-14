// Standalone ES module. Accept only a validated version 1 flags file.
// SHA-256 uses UTF-8 userId:flagKey; the first unsigned big-endian word mod 100.
// Rollouts are whole percents: a user is on when bucket < rolloutPercentage.
// Requires crypto.subtle (a secure context: HTTPS or localhost, or a runtime with WebCrypto), so evaluate() is async.
export async function evaluate(file, flagKey, environment, context) {
  if (file.version !== 1 || file.bucketing !== 'sha256-32be-mod100' || !Array.isArray(file.flags)) throw new TypeError('Unsupported flags file');
  if (!context || typeof context.userId !== 'string' || !context.userId || context.userId.length > 500) throw new TypeError('Expected userId (1 to 500 characters)');
  const flag = file.flags.find(item => item.key === flagKey);
  const base = { flagKey, environment };
  const env = flag && Object.hasOwn(flag.environments, environment) ? flag.environments[environment] : undefined;
  if (!env) return { ...base, enabled: false, reason: 'DEFAULT_OFF' };
  if (env.killSwitchActive) return { ...base, enabled: false, reason: 'KILL_SWITCH' };
  if (!env.enabled) return { ...base, enabled: false, reason: 'DISABLED' };
  // SemVer 2.0.0 precedence: missing minor and patch are 0, one leading v is allowed, build metadata is ignored.
  // Returns -1, 0 or 1, or NaN when either side is not a valid version (so "compare(a, b) >= 0" is false).
  const semver = /^v?(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-z-][0-9a-z-]*))*))?(?:\+[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/;
  const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const digits = (a, b) => a.length !== b.length ? order(a.length, b.length) : order(a, b);
  const compare = (a, b) => {
    const left = semver.exec(a.toLowerCase()), right = semver.exec(b.toLowerCase());
    if (!left || !right) return NaN;
    for (let i = 1; i <= 3; i++) { const diff = digits(left[i] || '0', right[i] || '0'); if (diff) return diff; }
    const x = left[4] ? left[4].split('.') : [], y = right[4] ? right[4].split('.') : [];
    if (!x.length || !y.length) return order(y.length, x.length);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const numeric = [/^\d+$/.test(x[i]), /^\d+$/.test(y[i])];
      const diff = numeric[0] && numeric[1] ? digits(x[i], y[i]) : numeric[0] ? -1 : numeric[1] ? 1 : order(x[i], y[i]);
      if (diff) return diff;
    }
    return order(x.length, y.length);
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
