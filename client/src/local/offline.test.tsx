import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe } from '../test/axe';
import { createUpdateWatcher } from './offline';
import { UpdateNotice } from './UpdateNotice';

class FakeWorker extends EventTarget { state = 'installing'; postMessage = vi.fn(); }
class FakeRegistration extends EventTarget { waiting: FakeWorker | null = null; installing: FakeWorker | null = null; }
const install = (registration: FakeRegistration, worker: FakeWorker) => {
  registration.installing = worker; registration.dispatchEvent(new Event('updatefound'));
  worker.state = 'installed'; worker.dispatchEvent(new Event('statechange'));
};

describe('update watcher', () => {
  it('does not offer an update for the first install, when nothing controls the page yet', () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); watcher.watch(registration, () => false);
    install(registration, new FakeWorker()); expect(watcher.ready()).toBe(false);
  });

  it('offers an update when a new worker finishes installing while another controls the page', () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); const listener = vi.fn(); watcher.subscribe(listener); watcher.watch(registration, () => true);
    expect(watcher.ready()).toBe(false); install(registration, new FakeWorker()); expect(watcher.ready()).toBe(true); expect(listener).toHaveBeenCalledTimes(1);
  });

  it('finds a worker that was already waiting when the page loaded', () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); registration.waiting = Object.assign(new FakeWorker(), { state: 'installed' });
    watcher.watch(registration, () => true); expect(watcher.ready()).toBe(true);
  });

  it('withdraws the offer when the waiting worker is replaced', () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); watcher.watch(registration, () => true); const worker = new FakeWorker(); install(registration, worker);
    worker.state = 'redundant'; worker.dispatchEvent(new Event('statechange')); expect(watcher.ready()).toBe(false);
  });

  it('asks the waiting worker to activate and reloads once, only after the request', () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); const container = new EventTarget(); const reload = vi.fn();
    watcher.reloadWhenControlled(container, reload); watcher.watch(registration, () => true);
    container.dispatchEvent(new Event('controllerchange')); expect(reload).not.toHaveBeenCalled();
    const worker = new FakeWorker(); install(registration, worker); watcher.apply(); expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }); expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event('controllerchange')); container.dispatchEvent(new Event('controllerchange')); expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when asked to apply with no waiting worker', () => {
    const watcher = createUpdateWatcher(); const container = new EventTarget(); const reload = vi.fn(); watcher.reloadWhenControlled(container, reload); watcher.apply(); container.dispatchEvent(new Event('controllerchange')); expect(reload).not.toHaveBeenCalled();
  });
});

describe('update notice', () => {
  it('shows nothing until an update is waiting, then a quiet status with a Reload button', async () => {
    const watcher = createUpdateWatcher(); const registration = new FakeRegistration(); watcher.watch(registration, () => true);
    const { container } = render(<UpdateNotice watcher={watcher} />); expect(screen.queryByText('A new version is ready.')).toBeNull(); expect(screen.queryByRole('button')).toBeNull();
    const worker = new FakeWorker(); act(() => install(registration, worker));
    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready.'); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' })); expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
