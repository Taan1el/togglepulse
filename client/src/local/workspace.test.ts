import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { clearWorkspace, loadMode, loadWorkspaceSnapshot, saveMode, saveWorkspace } from './workspace';
describe('browser workspace transactions', () => {
  it('round trips and separates source mode, rejects stale writers, and retains revisions after clearing', async () => {
    const first = await loadWorkspaceSnapshot();
    const revision = await saveWorkspace({ events: ['synthetic'] }, { expectedRevision: first.revision });
    await saveMode('sample'); expect(await loadMode()).toBe('sample'); expect((await loadWorkspaceSnapshot()).data).toEqual({ events: ['synthetic'] });
    await expect(saveWorkspace({ lost: true }, { expectedRevision: first.revision })).rejects.toThrow('another tab');
    expect((await loadWorkspaceSnapshot()).revision).toBe(revision);
    await clearWorkspace(); expect((await loadWorkspaceSnapshot()).data).toBeNull();
    await expect(saveWorkspace({}, { expectedRevision: revision })).rejects.toThrow('another tab');
    await saveMode('workspace'); expect(await loadMode()).toBe('workspace');
  });
});
