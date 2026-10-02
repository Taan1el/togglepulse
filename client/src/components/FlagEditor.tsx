import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { FeatureFlag } from '../../../shared/types.js';
import { describeState, getEnvConfig } from '../utils/flagState.js';

interface FlagEditorProps {
  flag: FeatureFlag | null;
  environment: string;
  onUpdateRollout: (pct: number) => void;
  onToggleKillSwitch: (active: boolean) => void;
  onDeleteFlag: () => void;
  saving: boolean;
}

export const FlagEditor: React.FC<FlagEditorProps> = ({
  flag,
  environment,
  onUpdateRollout,
  onToggleKillSwitch,
  onDeleteFlag,
  saving,
}) => {
  const [sliderVal, setSliderVal] = useState(() => flag?.environments[environment]?.rolloutPercentage || 0);

  useEffect(() => {
    if (flag) {
      setSliderVal(flag.environments[environment]?.rolloutPercentage || 0);
    }
  }, [flag, environment]);

  if (!flag) {
    return (
      <section aria-labelledby="editor-heading">
        <h2 className="section-heading" id="editor-heading">Flag settings</h2>
        <p className="empty-state">Select a flag in the table to change its rollout or kill switch.</p>
      </section>
    );
  }

  const env = getEnvConfig(flag, environment);
  const state = describeState(env);
  const killed = env.killSwitchActive;

  return (
    <section aria-labelledby="editor-heading">
      <h2 className="section-heading" id="editor-heading">
        <span className="mono">{flag.key}</span> in {environment}
      </h2>
      <p className="section-description">{flag.description || 'No description.'}</p>

      <div className="editor-split">
        <div className="editor-column">
          <div className="field">
            <div className="field-row">
              <label className="field-label" htmlFor="rollout-range">Rollout percentage</label>
              <output className="field-value" htmlFor="rollout-range">{`${sliderVal}%`}</output>
            </div>
            <input
              id="rollout-range"
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={(e) => setSliderVal(parseInt(e.target.value, 10))}
              disabled={killed}
            />
            <span className="field-help">Currently {env.rolloutPercentage}% of users get this flag on.</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onUpdateRollout(sliderVal)}
            disabled={saving || killed || sliderVal === env.rolloutPercentage}
          >
            {saving ? 'Updating' : 'Apply rollout'}
          </button>

          <div className={`kill-panel ${killed ? 'active' : ''}`}>
            <h3 className="panel-heading">Kill switch</h3>
            <p className="field-help">
              {killed
                ? 'On. This flag returns false for everyone in this environment. The rollout and rules are kept.'
                : 'Off. Turning it on makes this flag return false for everyone in this environment.'}
            </p>
            <button
              type="button"
              className={`btn ${killed ? 'btn-secondary' : 'btn-danger'}`}
              onClick={() => onToggleKillSwitch(!killed)}
              disabled={saving}
            >
              {killed ? 'Release kill switch' : 'Trigger kill switch'}
            </button>
          </div>

          <button type="button" className="btn btn-tertiary" onClick={onDeleteFlag}>
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Delete flag
          </button>
        </div>

        <div className="editor-detail">
          <dl className="result-list">
            <div>
              <dt>State</dt>
              <dd className="plain">
                <span className={`state state-${state.tone}`}>
                  <span className={`status-dot ${state.tone}`} aria-hidden="true" />
                  {state.label}
                </span>
              </dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd className="plain">{flag.tags.length ? flag.tags.join(', ') : 'None'}</dd>
            </div>
            <div>
              <dt>Evaluations</dt>
              <dd>{flag.evaluationCount.toLocaleString('en-US')}</dd>
            </div>
          </dl>

          <h3 className="panel-heading">Targeting rules ({env.rules.length})</h3>
          {env.rules.length === 0 ? (
            <p className="field-help">
              No rules in this environment, so only the rollout percentage decides.
            </p>
          ) : (
            <>
              <div className="table-wrapper" tabIndex={0} aria-label="Targeting rules">
                <table className="rules-table">
                  <thead>
                    <tr>
                      <th scope="col">Attribute</th>
                      <th scope="col">Operator</th>
                      <th scope="col">Values</th>
                      <th scope="col">Serves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {env.rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="mono">{rule.attribute}</td>
                        <td className="mono">{rule.operator}</td>
                        <td className="mono">{rule.values.join(', ')}</td>
                        <td className="mono">{String(rule.serveValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field-help">Rules are checked in order before the rollout; the first match decides.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};
