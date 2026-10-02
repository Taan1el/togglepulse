import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import type { FeatureFlag } from '../../shared/types.js';
import {
  fetchFlags,
  fetchFlagByKey,
  updateRollout,
  toggleKillSwitch,
  deleteFlag,
} from './services/index.js';
import { DemoBanner } from './components/DemoBanner.js';
import { Header } from './components/Header.js';
import { StatsBar } from './components/StatsBar.js';
import { FlagTable } from './components/FlagTable.js';
import { FlagEditor } from './components/FlagEditor.js';
import { EvaluationTester } from './components/EvaluationTester.js';
import { CreateFlagDialog } from './components/CreateFlagDialog.js';

export const App: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [currentEnv, setCurrentEnv] = useState<string>('production');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeCreate = useCallback(() => setIsCreateOpen(false), []);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFlags();
      setFlags(data);
      setSelectedKey((prev) =>
        data.length > 0 && (!prev || !data.some((f) => f.key === prev)) ? data[0].key : prev
      );
      setError(null);
    } catch (err) {
      console.error('Failed to load flags:', err);
      setError('Could not load flags. Check that the server is running and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedFlag(null);
      return;
    }

    let isMounted = true;
    const loadDetail = async () => {
      try {
        const flag = await fetchFlagByKey(selectedKey);
        if (isMounted) setSelectedFlag(flag);
      } catch (err) {
        console.error('Failed to load flag detail:', err);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedKey]);

  const handleUpdateRollout = async (pct: number) => {
    if (!selectedKey) return;
    try {
      setSaving(true);
      const updated = await updateRollout(selectedKey, {
        environment: currentEnv,
        rolloutPercentage: pct,
      });
      setSelectedFlag(updated);
      setError(null);
      loadFlags();
    } catch (err) {
      console.error('Update rollout failed:', err);
      setError('The rollout change was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleKillSwitch = async (active: boolean) => {
    if (!selectedKey) return;
    try {
      setSaving(true);
      const updated = await toggleKillSwitch(selectedKey, currentEnv, active);
      setSelectedFlag(updated);
      setError(null);
      loadFlags();
    } catch (err) {
      console.error('Kill switch toggle failed:', err);
      setError('The kill switch change was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlag = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`Delete flag "${selectedKey}"? This also removes its evaluation history.`)) return;

    try {
      await deleteFlag(selectedKey);
      setSelectedKey(null);
      setSelectedFlag(null);
      loadFlags();
    } catch (err) {
      console.error('Delete flag failed:', err);
      setError('The flag was not deleted.');
    }
  };

  return (
    <div className="app-container">
      <DemoBanner onReset={() => { setSelectedKey(null); loadFlags(); }} />
      <Header
        onOpenCreate={() => setIsCreateOpen(true)}
        onRefresh={loadFlags}
        isLoading={loading}
      />

      <main className="app-main">
        {error && <output className="alert alert-error">{error}</output>}

        <StatsBar flags={flags} environment={currentEnv} />

        <FlagTable
          flags={flags}
          selectedKey={selectedKey}
          environment={currentEnv}
          onSelectEnv={setCurrentEnv}
          onSelectFlag={setSelectedKey}
          loading={loading}
        />

        <FlagEditor
          key={`${selectedFlag?.key ?? "none"}:${currentEnv}`}
          flag={selectedFlag}
          environment={currentEnv}
          onUpdateRollout={handleUpdateRollout}
          onToggleKillSwitch={handleToggleKillSwitch}
          onDeleteFlag={handleDeleteFlag}
          saving={saving}
        />

        <EvaluationTester flag={selectedFlag} environment={currentEnv} />
      </main>

      <footer className="app-footer">
        <span>TogglePulse 1.0.0, MIT license</span>
        <a href="https://github.com/Taan1el/togglepulse" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>

      <CreateFlagDialog
        isOpen={isCreateOpen}
        onClose={closeCreate}
        onCreated={(key) => {
          setSelectedKey(key);
          loadFlags();
        }}
      />
    </div>
  );
};

export default App;
