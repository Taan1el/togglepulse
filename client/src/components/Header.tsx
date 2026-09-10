import React from 'react';

interface HeaderProps {
  currentEnv: string;
  onSelectEnv: (env: string) => void;
  onOpenCreateModal: () => void;
  onRefresh: () => void;
  flagCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentEnv,
  onSelectEnv,
  onOpenCreateModal,
  onRefresh,
  flagCount,
}) => {
  return (
    <header className="app-header">
      <div className="brand-badge">
        <div className="brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#040812" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </div>
        <div>
          <div className="brand-title">TogglePulse</div>
          <div className="brand-sub">Canary Rollouts &amp; Dynamic Toggles</div>
        </div>
      </div>

      <div className="env-selector">
        {['production', 'staging', 'development'].map((env) => (
          <button
            key={env}
            className={`env-btn ${currentEnv === env ? 'active' : ''}`}
            onClick={() => onSelectEnv(env)}
          >
            {env}
          </button>
        ))}
      </div>

      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onRefresh} title="Reload flags">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh ({flagCount})
        </button>

        <button className="btn btn-primary" onClick={onOpenCreateModal}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Flag
        </button>
      </div>
    </header>
  );
};
