import React from 'react';
import type { FeatureFlag } from '../../../shared/types.js';
import { describeState, getEnvConfig } from '../utils/flagState.js';
import { formatCount } from '../utils/pluralize.js';

export const ENV_NAMES = ['production', 'staging', 'development'] as const;

interface FlagMatrixProps {
  flags: FeatureFlag[];
  query: string;
  selectedKey: string | null;
  environment: string;
  onSelectCell: (key: string, env: string) => void;
  onToggleKillSwitch: (key: string, env: string, active: boolean) => void;
  loading: boolean;
}

const isKilledAnywhere = (flag: FeatureFlag) => ENV_NAMES.some((env) => getEnvConfig(flag, env).killSwitchActive);

export const FlagMatrix: React.FC<FlagMatrixProps> = ({
  flags,
  query,
  selectedKey,
  environment,
  onSelectCell,
  onToggleKillSwitch,
  loading,
}) => {
  const term = query.trim().toLowerCase();
  const filtered = flags.filter(
    (f) =>
      !term ||
      f.name.toLowerCase().includes(term) ||
      f.key.toLowerCase().includes(term) ||
      f.tags.some((t) => t.toLowerCase().includes(term))
  );
  const pinned = filtered.filter(isKilledAnywhere);
  const others = filtered.filter((f) => !isKilledAnywhere(f));

  const liveIn = (env: string) =>
    flags.filter((f) => describeState(getEnvConfig(f, env)).kind === 'live').length;

  const renderRow = (flag: FeatureFlag) => {
    const selected = flag.key === selectedKey;
    return (
      <tr key={flag.key} className={selected ? 'selected' : undefined}>
        <th scope="row" className="flag-cell">
          <button
            type="button"
            className="flag-link"
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelectCell(flag.key, environment)}
          >
            <span className="flag-name">{flag.name}</span>
            <span className="flag-key">{flag.key}</span>
          </button>
          <span className="flag-meta mono">
            {formatCount(flag.evaluationCount, 'evaluation')}
          </span>
        </th>
        {ENV_NAMES.map((env) => {
          const cfg = getEnvConfig(flag, env);
          const state = describeState(cfg);
          const active = selected && env === environment;
          const running = state.kind === 'live' || state.kind === 'rolling';
          return (
            <td key={env} data-label={env} className={active ? 'cell-active' : undefined}>
              <div className="cell">
                <button
                  type="button"
                  role="switch"
                  aria-checked={cfg.killSwitchActive}
                  aria-label={`Kill switch for ${flag.key} in ${env}`}
                  className="switch"
                  onClick={() => onToggleKillSwitch(flag.key, env, !cfg.killSwitchActive)}
                >
                  <span className="switch-track">
                    <span className="switch-thumb" />
                  </span>
                </button>
                <button
                  type="button"
                  className="cell-open"
                  aria-label={`Open ${flag.key} in ${env}, ${cfg.rolloutPercentage}% rollout`}
                  onClick={() => onSelectCell(flag.key, env)}
                >
                  <span className="pct mono">{`${cfg.rolloutPercentage}%`}</span>
                  <span className={`state state-${state.tone}`}>
                    <span className={`status-dot ${state.tone}`} aria-hidden="true" />
                    {state.label}
                  </span>
                </button>
              </div>
              <span
                className={`meter ${running ? '' : 'inactive'}`}
                role="meter"
                aria-label={`Rollout for ${flag.key} in ${env}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={cfg.rolloutPercentage}
              >
                <span className="meter-fill" style={{ width: `${cfg.rolloutPercentage}%` }} />
              </span>
            </td>
          );
        })}
      </tr>
    );
  };

  const groupRow = (title: string, count: number, id: string) => (
    <tr className="group-row">
      <th scope="colgroup" colSpan={ENV_NAMES.length + 1} id={id}>
        <div className="group-inner">
          <span>{title}</span>
          <span className="mono">{count}</span>
        </div>
      </th>
    </tr>
  );

  return (
    <section aria-labelledby="flags-heading" className="matrix-section">
      <h2 className="sr-only" id="flags-heading">Flag matrix</h2>

      {loading && flags.length === 0 ? (
        <p className="empty-state">Loading flags.</p>
      ) : flags.length === 0 ? (
        <p className="empty-state">No flags yet. Create one with New flag.</p>
      ) : (
        <div className="table-wrapper" role="region" tabIndex={0} aria-label="Flag matrix, scrolls sideways on narrow screens">
          <table className="matrix">
            <thead>
              <tr>
                <th scope="col">Flag</th>
                {ENV_NAMES.map((env) => (
                  <th scope="col" key={env}>
                    <span className="env-name">{env}</span>
                    <span className="env-note mono">{`${liveIn(env)} live`}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="pinned">
              {groupRow('Kill switches engaged', pinned.length, 'group-killed')}
              {pinned.length === 0 ? (
                <tr>
                  <td colSpan={ENV_NAMES.length + 1} className="group-empty">
                    {term && flags.some(isKilledAnywhere)
                      ? 'No engaged kill switch matches this filter.'
                      : 'No kill switch is engaged in any environment.'}
                  </td>
                </tr>
              ) : (
                pinned.map(renderRow)
              )}
            </tbody>
            <tbody>
              {groupRow('All other flags', others.length, 'group-others')}
              {others.length === 0 ? (
                <tr>
                  <td colSpan={ENV_NAMES.length + 1} className="group-empty">
                    {filtered.length === 0 ? 'No flags match this filter.' : 'Every flag has a kill switch engaged.'}
                  </td>
                </tr>
              ) : (
                others.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
