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
  beforeEach(() => { vi.clearAllMocks(); store.loadWorkspaceSnapshot.mockResolvedValue({ data: { version: 1, bucketing: 'sha256-32be-mod100', flags: [{ key: 'checkout', name: 'Checkout', description: '', tags: [], environments: defaultEnvironments() }] }, revision: 0 }); store.saveWorkspace.mockResolvedValue(1); });
  it('has accessible matrix, rule editor, creation and import screens', async () => {
    const { container } = render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'Import flags' })).toBeEnabled());
    expect((await axe(container)).violations).toEqual([]); fireEvent.click(screen.getByRole('button', { name: 'Add rule' })); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'New flag' })); expect((await axe(container)).violations).toEqual([]);
    const opener = screen.getByRole('button', { name: 'Import flags' }); fireEvent.click(opener); expect((await axe(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Import and save' })); expect(screen.getByRole('dialog')).toHaveTextContent('Choose a flags.json file'); expect(store.saveWorkspace).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(opener).toHaveFocus();
  });
  it('saves rule values written with blank lines, trailing newlines and CRLF', async () => {
    render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'Add rule' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText('Operator for rule 1'), { target: { value: 'IN' } });
    fireEvent.change(screen.getByLabelText('Values for rule 1, one per line'), { target: { value: ' EE \r\n\r\nFI\r\n EE\n\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalled());
    expect(store.saveWorkspace.mock.calls[0][0].flags[0].environments.production.rules[0].values).toEqual(['EE', 'FI']);
  });
  it('shows a readable message next to the rules when a rule has no values', async () => {
    render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'Add rule' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.change(screen.getByLabelText('Values for rule 1, one per line'), { target: { value: '\n \n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(await screen.findByText('Rule 1 needs at least one value. Enter one value per line.')).toBeInTheDocument(); expect(store.saveWorkspace).not.toHaveBeenCalled();
  });
  it('says whole percent beside the rollout control', async () => {
    render(<LocalFlags />); expect(await screen.findByText('Whole percent, 0 to 100.')).toBeInTheDocument();
  });
  it('opens a workspace saved with a fractional rollout and says what changed', async () => {
    const environments = defaultEnvironments(); environments.production.rolloutPercentage = 0.1;
    store.loadWorkspaceSnapshot.mockResolvedValue({ data: { version: 1, bucketing: 'sha256-32be-mod100', flags: [{ key: 'checkout', name: 'Checkout', description: '', tags: [], environments }] }, revision: 3 });
    render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'Import flags' })).toBeEnabled());
    expect(screen.getByText(/checkout in production was 0\.1 percent and now reads 1 percent/)).toBeInTheDocument(); expect(store.saveWorkspace).not.toHaveBeenCalled();
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

