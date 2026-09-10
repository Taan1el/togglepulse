import React, { useState } from 'react';
import type { FeatureFlag, EvaluationResult } from '../../../shared/types.js';
import { evaluateFlag } from '../services/api.js';

interface EvaluationSandboxProps {
  flag: FeatureFlag | null;
  currentEnv: string;
}

export const EvaluationSandbox: React.FC<EvaluationSandboxProps> = ({ flag, currentEnv }) => {
  const [userId, setUserId] = useState('usr_tallinn_101');
  const [country, setCountry] = useState('EE');
  const [role, setRole] = useState('user');
  const [appVersion, setAppVersion] = useState('2.5.0');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!flag) return null;

  const handleEvaluate = async () => {
    try {
      setLoading(true);
      setError(null);
      const evalRes = await evaluateFlag(flag.key, currentEnv, {
        userId,
        attributes: {
          country,
          role,
          appVersion,
        },
      });
      setResult(evalRes);
    } catch (err: any) {
      setError(err.message || 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sandbox-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
          Interactive SDK Evaluation Sandbox
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Simulate Client &amp; Microservice Context
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <div>
          <label className="input-label">User ID / Actor:</label>
          <input
            type="text"
            className="text-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">Country Code:</label>
          <input
            type="text"
            className="text-input"
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="EE, FI, DE"
          />
        </div>

        <div>
          <label className="input-label">User Role:</label>
          <select
            className="text-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">Standard User</option>
            <option value="beta_tester">Beta Tester</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <div>
          <label className="input-label">Client App Version:</label>
          <input
            type="text"
            className="text-input"
            value={appVersion}
            onChange={(e) => setAppVersion(e.target.value)}
            placeholder="e.g. 2.4.0"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleEvaluate} disabled={loading}>
          {loading ? 'Evaluating...' : 'Evaluate Flag via SDK'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--color-crimson)', fontSize: '0.85rem' }}>
          &times; {error}
        </div>
      )}

      {result && (
        <div className="sandbox-result-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              className="badge-status"
              style={{
                fontSize: '0.9rem',
                padding: '0.3rem 0.8rem',
                background: result.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: result.enabled ? '#34d399' : '#f87171',
                border: `1px solid ${result.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              }}
            >
              {result.enabled ? 'ENABLED (TRUE)' : 'DISABLED (FALSE)'}
            </span>

            <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
              Reason: <strong style={{ color: 'var(--color-cyan)' }}>{result.reason}</strong>
              {result.matchedRuleId && <span> (Matched: {result.matchedRuleId})</span>}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            SHA-256 Cohort Bucket:{' '}
            <strong style={{ color: 'var(--color-amber)' }}>{result.bucket ?? 'N/A'}</strong> / 99
          </div>
        </div>
      )}
    </div>
  );
};
