import { useSyncExternalStore } from 'react';
import { updates } from './offline';

type Watcher = Pick<typeof updates, 'ready' | 'subscribe' | 'apply'>;

// Offers a reload when a new version is installed. Nothing reloads until the button is used.
export function UpdateNotice({ watcher = updates }: { watcher?: Watcher }) {
  const ready = useSyncExternalStore(watcher.subscribe, watcher.ready);
  return <div role="status">{ready && <div className="update-notice"><p>A new version is ready.</p><button type="button" className="btn btn-secondary" onClick={() => watcher.apply()}>Reload</button></div>}</div>;
}
