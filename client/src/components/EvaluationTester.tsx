import React, { useState } from 'react';
import type { FeatureFlag, EvaluationResult } from '../../../shared/types.js';
import { evaluateFlag } from '../services/index.js';

interface EvaluationTesterProps {
  flag: FeatureFlag | null;
  environment: string;
}

export const EvaluationTester: React.FC<EvaluationTesterProps> = ({ flag, environment }) => {
  const [userId, setUserId] = useState('usr_tallinn_101');
  const [country, setCountry] = useState('EE');
  const [role, setRole] = useState('user');
  const [appVersion, setAppVersion] = useState('2.5.0');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!flag) return null;

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await evaluateFlag(flag.key, environment, {
        userId,
        attributes: { country, role, appVersion },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  const shown = result && result.flagKey === flag.key && result.environment === environment ? result : null;

  return (
    <section aria-labelledby="tester-heading">
      <h2 className="section-heading" id="tester-heading">Evaluation tester</h2>
      <p className="section-description">
        Check what <span className="mono">{flag.key}</span> returns in {environment} for one user. Each check counts as an evaluation.
      </p>

      <div className="tester-section">
        <form className="tester-form" onSubmit={handleEvaluate}>
          <div className="field wide">
            <label className="field-label" htmlFor="tester-user">User ID</label>
            <input id="tester-user" type="text" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="tester-country">Country code</label>
            <input
              id="tester-country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="EE, FI, DE"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="tester-version">App version</label>
            <input
              id="tester-version"
              type="text"
              value={appVersion}
              onChange={(e) => setAppVersion(e.target.value)}
              placeholder="2.4.0"
            />
          </div>
          <div className="field wide">
            <label className="field-label" htmlFor="tester-role">Role</label>
            <select id="tester-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">Standard user</option>
              <option value="beta_tester">Beta tester</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary wide" disabled={loading || !userId.trim()}>
            {loading ? 'Evaluating' : 'Evaluate flag'}
          </button>
        </form>

        <div>
          {error && <output className="alert alert-error">{error}</output>}
          {shown ? (
            <div className="result-panel">
              <div className="result-panel-header">
                <h3>
                  Result for <span className="mono">{shown.flagKey}</span>
                </h3>
                <span className="badge">
                  <span className={`status-dot ${shown.enabled ? 'ok' : 'neutral'}`} aria-hidden="true" />
                  {shown.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <dl className="result-list">
                <div>
                  <dt>Reason</dt>
                  <dd>{shown.reason}</dd>
                </div>
                <div>
                  <dt>Bucket</dt>
                  <dd>{shown.bucket !== undefined ? `${shown.bucket} / 99` : 'Not used'}</dd>
                </div>
                <div>
                  <dt>Matched rule</dt>
                  <dd>{shown.matchedRuleId ?? 'None'}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{shown.environment}</dd>
                </div>
              </dl>
            </div>
          ) : (
            !error && <p className="result-empty">Run an evaluation to see the result and reason here.</p>
          )}
        </div>
      </div>
    </section>
  );
};
