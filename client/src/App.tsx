import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import type { FeatureFlag } from '../../shared/types.js';
import {
  fetchFlags,
  fetchFlagByKey,
  updateRollout,
  toggleKillSwitch,
} from './services/api.js';
import { Header } from './components/Header.js';
import { FlagList } from './components/FlagList.js';
import { FlagDetail } from './components/FlagDetail.js';
import { EvaluationSandbox } from './components/EvaluationSandbox.js';
import { CreateFlagModal } from './components/CreateFlagModal.js';

export const App: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [currentEnv, setCurrentEnv] = useState<string>('production');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Load flags
  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFlags();
      setFlags(data);
      if (data.length > 0 && (!selectedKey || !data.some((f) => f.key === selectedKey))) {
        setSelectedKey(data[0].key);
      }
    } catch (err) {
      console.error('Failed to load flags:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Load selected flag details
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
      loadFlags();
    } catch (err) {
      console.error('Update rollout failed:', err);
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
      loadFlags();
    } catch (err) {
      console.error('Kill switch toggle failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlag = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`Are you sure you want to delete flag "${selectedKey}"?`)) return;

    try {
      await fetch(`/api/flags/${selectedKey}`, { method: 'DELETE' });
      setSelectedKey(null);
      setSelectedFlag(null);
      loadFlags();
    } catch (err) {
      console.error('Delete flag failed:', err);
    }
  };

  return (
    <div className="app-container">
      <Header
        currentEnv={currentEnv}
        onSelectEnv={setCurrentEnv}
        onOpenCreateModal={() => setIsCreateOpen(true)}
        onRefresh={loadFlags}
        flagCount={flags.length}
      />

      <main className="main-content">
        <div className="workspace-split">
          <FlagList
            flags={flags}
            selectedKey={selectedKey}
            currentEnv={currentEnv}
            onSelectFlag={setSelectedKey}
            loading={loading}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <FlagDetail
              flag={selectedFlag}
              currentEnv={currentEnv}
              onUpdateRollout={handleUpdateRollout}
              onToggleKillSwitch={handleToggleKillSwitch}
              onDeleteFlag={handleDeleteFlag}
              saving={saving}
            />

            <EvaluationSandbox
              flag={selectedFlag}
              currentEnv={currentEnv}
            />
          </div>
        </div>
      </main>

      <CreateFlagModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(key) => {
          loadFlags();
          setSelectedKey(key);
        }}
      />
    </div>
  );
};

export default App;
