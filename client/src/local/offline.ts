type Listener = () => void;

interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}
interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}
interface ContainerLike { addEventListener(type: 'controllerchange', listener: () => void): void }

/**
 * Tracks a service worker that has installed and is waiting to take over.
 * A first install has no controlling worker, so it never counts as an update.
 * The page reloads only after the person asked for the update.
 */
export function createUpdateWatcher() {
  let waiting: WorkerLike | null = null;
  let requested = false;
  let reloaded = false;
  const listeners = new Set<Listener>();
  const set = (worker: WorkerLike | null) => {
    if (waiting === worker) return;
    waiting = worker;
    listeners.forEach((listener) => listener());
  };
  return {
    ready: () => waiting !== null,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    watch(registration: RegistrationLike, hasController: () => boolean) {
      const check = (worker: WorkerLike | null) => {
        if (worker && worker.state === 'installed' && hasController()) set(worker);
      };
      check(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          check(worker);
          if (worker.state === 'redundant' && waiting === worker) set(null);
        });
      });
    },
    /** Tell the waiting worker to activate. The reload follows when it takes control. */
    apply() {
      if (!waiting) return;
      requested = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
    },
    reloadWhenControlled(container: ContainerLike, reload: () => void) {
      container.addEventListener('controllerchange', () => {
        if (!requested || reloaded) return;
        reloaded = true;
        reload();
      });
    },
  };
}

export const updates = createUpdateWatcher();

export function registerOffline(): void {
  if (import.meta.env.MODE !== 'pages' || !('serviceWorker' in navigator)) return;

  updates.reloadWhenControlled(navigator.serviceWorker, () => window.location.reload());
  const register = () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).then((registration) => {
      updates.watch(registration, () => navigator.serviceWorker.controller !== null);
    }).catch((error: unknown) => {
      console.error('Offline storage could not start.', error);
    });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
