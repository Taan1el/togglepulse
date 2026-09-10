import React, { useState } from 'react';
import { createFlag } from '../services/api.js';

interface CreateFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (key: string) => void;
}

export const CreateFlagModal: React.FC<CreateFlagModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('canary, rollout');
  const [rolloutPercentage, setRolloutPercentage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!key.trim() || !name.trim()) {
      setError('Key and Name are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);

      const newFlag = await createFlag({
        key,
        name,
        description,
        tags: tagArray,
        environments: {
          production: {
            rolloutPercentage,
          },
        },
      });

      onCreated(newFlag.key);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create New Feature Flag</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div>
            <label className="input-label">Unique Flag Key:</label>
            <input
              type="text"
              className="text-input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. checkout_v3_beta"
            />
          </div>

          <div>
            <label className="input-label">Display Name:</label>
            <input
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Instant Apple Pay Checkout"
            />
          </div>

          <div>
            <label className="input-label">Description:</label>
            <textarea
              className="text-area"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the feature and release criteria..."
            />
          </div>

          <div>
            <label className="input-label">Tags (comma-separated):</label>
            <input
              type="text"
              className="text-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div>
            <label className="input-label">Initial Production Rollout ({rolloutPercentage}%):</label>
            <input
              type="range"
              min="0"
              max="100"
              value={rolloutPercentage}
              onChange={(e) => setRolloutPercentage(parseInt(e.target.value, 10))}
              className="rollout-slider"
            />
          </div>

          {error && (
            <div style={{ color: 'var(--color-crimson)', fontSize: '0.85rem' }}>
              &times; {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Flag'}
          </button>
        </div>
      </div>
    </div>
  );
};
