import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children: ReactNode;
}

// A modal question with a safe default: focus starts on the cancel button, Tab
// stays inside, Escape cancels, and focus returns to the control that was in
// use before the dialog opened.
export function ConfirmDialog({ title, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false, children }: ConfirmDialogProps) {
  const card = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const latest = useRef({ onCancel, busy });
  latest.current = { onCancel, busy };
  const headingId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancel.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!latest.current.busy) latest.current.onCancel(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
      const first = items[0]; const last = items.at(-1);
      if (!items.length || !card.current?.contains(document.activeElement) || document.activeElement === card.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() ?? card.current?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="modal-backdrop"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={card} tabIndex={-1}>
    <div className="modal-header"><h2 id={headingId}>{title}</h2></div>
    <div className="modal-body">{children}</div>
    <div className="modal-footer"><button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</button><button type="button" className="btn btn-secondary" ref={cancel} disabled={busy} onClick={onCancel}>{cancelLabel}</button></div>
  </div></div>;
}
