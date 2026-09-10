import React, { useState } from 'react';
import type { FeatureFlag } from '../../../shared/types.js';

interface FlagListProps {
  flags: FeatureFlag[];
  selectedKey: string | null;
  currentEnv: string;
  onSelectFlag: (key: string) => void;
  loading: boolean;
}

export const FlagList: React.FC<FlagListProps> = ({
  flags,
  selectedKey,
  currentEnv,
  onSelectFlag,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = flags.filter((f) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      f.name.toLowerCase().includes(term) ||
      f.key.toLowerCase().includes(term) ||
      f.tags.some((t) => t.toLowerCase().includes(term))
    );
  });

  if (loading && flags.length === 0) {
    return (
      <div className="panel-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading feature flags...</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div className="panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          Feature Flags ({flags.length})
        </div>
      </div>

      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          className="text-input"
          placeholder="Filter by name, key or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((flag) => {
          const isSelected = flag.key === selectedKey;
          const envConfig = flag.environments[currentEnv] || {
            enabled: false,
            killSwitchActive: false,
            rolloutPercentage: 0,
            rules: [],
          };

          let statusBadge = (
            <span className="badge-status badge-active">
              {envConfig.rolloutPercentage}% Rollout
            </span>
          );

          if (envConfig.killSwitchActive) {
            statusBadge = <span className="badge-status badge-kill">Kill Switch</span>;
          } else if (!envConfig.enabled) {
            statusBadge = <span className="badge-status badge-off">Off</span>;
          }

          return (
            <div
              key={flag.key}
              className={`flag-list-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectFlag(flag.key)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="flag-title">{flag.name}</span>
                {statusBadge}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-amber)' }}>
                  {flag.key}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {flag.evaluationCount} evals
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                {flag.tags.map((t) => (
                  <span key={t} className="tag-badge">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
