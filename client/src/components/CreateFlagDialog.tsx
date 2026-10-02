import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createFlag } from '../services/index.js';

interface CreateFlagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (key: string) => void;
}

export const CreateFlagDialog: React.FC<CreateFlagDialogProps> = ({ isOpen, onClose, onCreated }) => {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('canary, rollout');
  const [rolloutPercentage, setRolloutPercentage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    keyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !name.trim()) {
      setError('Key and name are required');
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
        environments: { production: { rolloutPercentage } },
      });
      onCreated(newFlag.key);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 id="create-heading">Create flag</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div className="modal-body">
            <div className="field">
              <label className="field-label" htmlFor="new-key">Flag key</label>
              <input
                id="new-key"
                ref={keyRef}
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="checkout_v3_beta"
              />
              <span className="field-help">Lowercased; anything except letters, digits, _ and - becomes _.</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-name">Display name</label>
              <input
                id="new-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Instant checkout"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-description">Description</label>
              <textarea
                id="new-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it changes and when it can go to 100%"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="new-tags">Tags, comma-separated</label>
              <input id="new-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="field">
              <div className="field-row">
                <label className="field-label" htmlFor="new-rollout">Initial production rollout</label>
                <output className="field-value" htmlFor="new-rollout">{`${rolloutPercentage}%`}</output>
              </div>
              <input
                id="new-rollout"
                type="range"
                min="0"
                max="100"
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(parseInt(e.target.value, 10))}
              />
            </div>
            {error && <output className="alert alert-error">{error}</output>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating' : 'Create flag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
