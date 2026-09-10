import React, { useState, useEffect } from 'react';
import type { FeatureFlag } from '../../../shared/types.js';

interface FlagDetailProps {
  flag: FeatureFlag | null;
  currentEnv: string;
  onUpdateRollout: (pct: number) => void;
  onToggleKillSwitch: (active: boolean) => void;
  onDeleteFlag: () => void;
  saving: boolean;
}

export const FlagDetail: React.FC<FlagDetailProps> = ({
  flag,
  currentEnv,
  onUpdateRollout,
  onToggleKillSwitch,
  onDeleteFlag,
  saving,
}) => {
  const [sliderVal, setSliderVal] = useState(0);

  useEffect(() => {
    if (flag) {
      const envConfig = flag.environments[currentEnv];
      setSliderVal(envConfig?.rolloutPercentage || 0);
    }
  }, [flag, currentEnv]);

  if (!flag) {
    return (
      <div className="flag-detail-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Select a feature flag from the left to configure.</p>
      </div>
    );
  }

  const envConfig = flag.environments[currentEnv] || {
    enabled: false,
    killSwitchActive: false,
    rolloutPercentage: 0,
    rules: [],
  };

  const handleApplyRollout = () => {
    onUpdateRollout(sliderVal);
  };

  return (
    <div className="flag-detail-panel">
      {/* Header Ribbon */}
      <div className="detail-header-ribbon">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{flag.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-amber)' }}>
              key: {flag.key}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Env: <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>{currentEnv}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            className={`btn ${envConfig.killSwitchActive ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => onToggleKillSwitch(!envConfig.killSwitchActive)}
          >
            {envConfig.killSwitchActive ? 'Deactivate Kill Switch' : 'Trigger Kill Switch'}
          </button>
          <button className="btn btn-secondary" onClick={onDeleteFlag} title="Delete flag">
            Delete
          </button>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        {flag.description || 'No description provided.'}
      </div>

      {/* Canary Percentage Rollout Control */}
      <div className="rollout-control-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Canary Percentage Rollout</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Deterministic SHA-256 Hash Cohort
          </span>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="100"
            value={sliderVal}
            onChange={(e) => setSliderVal(parseInt(e.target.value, 10))}
            className="rollout-slider"
            disabled={envConfig.killSwitchActive}
          />
          <span className="rollout-pct-display">{sliderVal}%</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleApplyRollout}
            disabled={saving || envConfig.killSwitchActive || sliderVal === envConfig.rolloutPercentage}
          >
            {saving ? 'Updating...' : 'Apply Rollout'}
          </button>
        </div>
      </div>

      {/* Targeted Rules List */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Targeting Rules ({envConfig.rules?.length || 0})
        </h3>

        {(!envConfig.rules || envConfig.rules.length === 0) ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No targeted rules defined. Rollout is governed purely by percentage cohort allocation.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {envConfig.rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--color-cyan)' }}>IF {rule.attribute}</span>{' '}
                  <strong style={{ color: 'var(--color-amber)' }}>{rule.operator}</strong>{' '}
                  <span style={{ color: 'var(--color-emerald)' }}>[{rule.values.join(', ')}]</span>
                </div>
                <span className="badge-status badge-active">Serve: {String(rule.serveValue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
