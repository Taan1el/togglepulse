import React, { useEffect, useRef } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ query, onQueryChange, onOpenCreate, onRefresh, isLoading }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" jumps to the command bar unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="app-header">
      <div className="brand-row">
        <h1 className="brand-name">TogglePulse</h1>
        <p className="brand-subtitle">
          Feature flags with percentage rollouts, targeting rules and per-environment kill switches.
        </p>
      </div>

      <div className="command-bar">
        <div className="command-field">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <label className="sr-only" htmlFor="flag-filter">
            Filter flags by name, key or tag
          </label>
          <input
            id="flag-filter"
            ref={inputRef}
            type="text"
            autoComplete="off"
            placeholder="Find a flag by name, key or tag"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
          {isLoading ? 'Refreshing' : 'Refresh flags'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New flag
        </button>
      </div>
    </header>
  );
};
