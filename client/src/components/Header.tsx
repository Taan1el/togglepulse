import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onOpenCreate: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCreate, onRefresh, isLoading }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div>
          <h1 className="brand-name">TogglePulse</h1>
          <p className="brand-subtitle">
            Feature flags with percentage rollouts, targeting rules and per-environment kill switches.
          </p>
        </div>

        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
            {isLoading ? 'Refreshing' : 'Refresh flags'}
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            New flag
          </button>
        </div>
      </div>
    </header>
  );
};
