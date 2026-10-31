import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from '../test/axe';
import { defaultEnvironments } from '../../../shared/evaluate';
import { LocalFlags } from './LocalFlags';
const store = vi.hoisted(() => ({ loadWorkspaceSnapshot: vi.fn(), saveWorkspace: vi.fn() }));
const importer = vi.hoisted(() => ({ importFlags: vi.fn() }));
vi.mock('./workspace', () => store);
vi.mock('./importFile', () => importer);
describe('local switchboard', () => {
  beforeEach(() => { store.loadWorkspaceSnapshot.mockResolvedValue({ data: { version: 1, bucketing: 'sha256-32be-mod100', flags: [{ key: 'checkout', name: 'Checkout', description: '', tags: [], environments: defaultEnvironments() }] }, revision: 0 }); store.saveWorkspace.mockResolvedValue(1); });
  it('has accessible matrix, rule editor, creation and import screens', async () => {
    const { container } = render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'Import flags' })).toBeEnabled());
    expect((await axe(container)).violations).toEqual([]); fireEvent.click(screen.getByRole('button', { name: 'Add rule' })); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'New flag' })); expect((await axe(container)).violations).toEqual([]);
    const opener = screen.getByRole('button', { name: 'Import flags' }); fireEvent.click(opener); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Import and save' })); expect(screen.getByRole('dialog')).toHaveTextContent('Choose a flags.json file'); expect(store.saveWorkspace).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(opener).toHaveFocus();
  });
  it('retains saved configuration when a stale writer is rejected', async () => {
    store.saveWorkspace.mockRejectedValueOnce(new Error('Workspace changed in another tab.'));
    render(<LocalFlags />); const control = await screen.findByRole('switch', { name: 'Enabled in production' }); await waitFor(() => expect(control).toBeEnabled()); fireEvent.click(control);
    await screen.findByText('Workspace changed in another tab.'); expect(control).toHaveAttribute('aria-checked', 'true');
  });
  it('keeps keyboard focus in the dialog while parsing disables all controls and after an error', async () => {
    let rejectImport: (error: Error) => void = () => {};
    importer.importFlags.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectImport = reject; }));
    render(<LocalFlags />); const opener = screen.getByRole('button', { name: 'Import flags' }); await waitFor(() => expect(opener).toBeEnabled()); fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Flags JSON file'), { target: { files: [new File(['{}'], 'synthetic.json')] } }); fireEvent.click(screen.getByRole('button', { name: 'Import and save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Tab' }); expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeInTheDocument();
    rejectImport(new Error('synthetic.json: invalid flags')); await screen.findByText('synthetic.json: invalid flags');
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(opener).toHaveFocus();
  });
});

