import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { FeatureFlag } from '../../../shared/types.js';
import { describeState, getEnvConfig } from '../utils/flagState.js';
import { formatCount } from '../utils/pluralize.js';

export const ENV_NAMES = ['production', 'staging', 'development'] as const;

interface FlagTableProps {
  flags: FeatureFlag[];
  selectedKey: string | null;
  environment: string;
  onSelectEnv: (env: string) => void;
  onSelectFlag: (key: string) => void;
  loading: boolean;
}

export const FlagTable: React.FC<FlagTableProps> = ({
  flags,
  selectedKey,
  environment,
  onSelectEnv,
  onSelectFlag,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const term = searchTerm.trim().toLowerCase();
  const filtered = flags.filter(
    (f) =>
      !term ||
      f.name.toLowerCase().includes(term) ||
      f.key.toLowerCase().includes(term) ||
      f.tags.some((t) => t.toLowerCase().includes(term))
  );

  return (
    <section aria-labelledby="flags-heading">
      <div className="explorer-toolbar">
        <h2 className="section-heading" id="flags-heading">
          Flags in {environment}
        </h2>
        <div className="explorer-controls">
          <div className="env-switch">
            {ENV_NAMES.map((env) => (
              <button
                key={env}
                type="button"
                className="env-btn"
                aria-pressed={environment === env}
                onClick={() => onSelectEnv(env)}
              >
                {env}
              </button>
            ))}
          </div>
          <div className="search-field">
            <label className="sr-only" htmlFor="flag-filter">
              Filter flags by name, key or tag
            </label>
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            <input
              id="flag-filter"
              type="text"
              placeholder="Filter by name, key or tag"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading && flags.length === 0 ? (
        <p className="empty-state">Loading flags.</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">
          {flags.length === 0 ? 'No flags yet. Create one with New flag.' : 'No flags match this filter.'}
        </p>
      ) : (
        <div className="table-wrapper" tabIndex={0} aria-label="Flags table, scrolls sideways on narrow screens">
          <table className="flags-table">
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Flag</th>
                <th scope="col">Rollout</th>
                <th scope="col">Rules</th>
                <th scope="col" className="num">Evaluations</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((flag) => {
                const env = getEnvConfig(flag, environment);
                const state = describeState(env);
                const selected = flag.key === selectedKey;
                return (
                  <tr key={flag.key} className={selected ? 'selected' : undefined}>
                    <td>
                      <span className={`state state-${state.tone}`}>
                        <span className={`status-dot ${state.tone}`} aria-hidden="true" />
                        {state.label}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="flag-link"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onSelectFlag(flag.key)}
                      >
                        <span className="flag-name">{flag.name}</span>
                        <span className="flag-key">{flag.key}</span>
                      </button>
                    </td>
                    <td>
                      <span className="meter-row">
                        <span
                          className={`meter ${state.kind === 'live' || state.kind === 'rolling' ? '' : 'inactive'}`}
                          role="meter"
                          aria-label={`Rollout for ${flag.key}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={env.rolloutPercentage}
                        >
                          <span className="meter-fill" style={{ width: `${env.rolloutPercentage}%` }} />
                        </span>
                        <span className="mono meter-value">{`${env.rolloutPercentage}%`}</span>
                      </span>
                    </td>
                    <td className="mono">{formatCount(env.rules.length, 'rule')}</td>
                    <td className="mono num">{flag.evaluationCount.toLocaleString('en-US')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
