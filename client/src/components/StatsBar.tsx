import React from 'react';
import type { FeatureFlag } from '../../../shared/types.js';
import { describeState, getEnvConfig } from '../utils/flagState.js';

interface StatsBarProps {
  flags: FeatureFlag[];
  environment: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({ flags, environment }) => {
  const states = flags.map((f) => describeState(getEnvConfig(f, environment)));
  const count = (kind: string) => states.filter((s) => s.kind === kind).length;
  const evaluations = flags.reduce((sum, f) => sum + f.evaluationCount, 0);

  return (
    <div className="stats-strip">
      <div className="stat-cell">
        <span className="stat-label">Flags</span>
        <span className="stat-value">{flags.length}</span>
        <span className="stat-note">in {environment}</span>
      </div>
      <div className="stat-cell">
        <span className="stat-label">Live at 100%</span>
        <span className="stat-value">{count('live')}</span>
        <span className="stat-note">serving every user</span>
      </div>
      <div className="stat-cell">
        <span className="stat-label">Rolling out</span>
        <span className="stat-value">{count('rolling')}</span>
        <span className="stat-note">between 1% and 99%</span>
      </div>
      <div className="stat-cell">
        <span className="stat-label">Kill switches on</span>
        <span className="stat-value">{count('killed')}</span>
        <span className="stat-note">{count('off')} switched off</span>
      </div>
      <div className="stat-cell">
        <span className="stat-label">Evaluations</span>
        <span className="stat-value">{evaluations.toLocaleString('en-US')}</span>
        <span className="stat-note">all environments</span>
      </div>
    </div>
  );
};
