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
  it('creates a new flag switched off in every environment', async () => {
    render(<LocalFlags />); await waitFor(() => expect(screen.getByRole('button', { name: 'New flag' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'New flag' })); fireEvent.change(screen.getByLabelText('Flag key'), { target: { value: 'fresh' } }); fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create flag' })); await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalled());
    const created = store.saveWorkspace.mock.calls[0][0].flags.find((item: { key: string }) => item.key === 'fresh');
    for (const environment of ['production', 'staging', 'development']) expect(created.environments[environment]).toMatchObject({ enabled: false, rolloutPercentage: 0, killSwitchActive: false });
  });
  it('edits the name, description and tags of a local flag', async () => {
    render(<LocalFlags />); const name = await screen.findByLabelText('Flag name'); await waitFor(() => expect(screen.getByRole('button', { name: 'Save details' })).toBeEnabled());
    fireEvent.change(name, { target: { value: '  Checkout v2 ' } }); fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' Faster checkout ' } }); fireEvent.change(screen.getByLabelText('Tags, separated by commas'), { target: { value: 'payments, web,, payments' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' })); await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalled());
    expect(store.saveWorkspace.mock.calls[0][0].flags[0]).toMatchObject({ key: 'checkout', name: 'Checkout v2', description: 'Faster checkout', tags: ['payments', 'web'] });
    await waitFor(() => expect(screen.getByLabelText('Flag name')).toHaveValue('Checkout v2'));
  });
  it('rejects an empty name next to the details and saves nothing', async () => {
    render(<LocalFlags />); const name = await screen.findByLabelText('Flag name'); await waitFor(() => expect(screen.getByRole('button', { name: 'Save details' })).toBeEnabled());
    fireEvent.change(name, { target: { value: '   ' } }); fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Flag name is required.')).toBeInTheDocument(); expect(store.saveWorkspace).not.toHaveBeenCalled();
  });
  const twoFlags = () => { store.loadWorkspaceSnapshot.mockResolvedValue({ data: { version: 1, bucketing: 'sha256-32be-mod100', flags: ['checkout', 'search'].map(key => ({ key, name: key, description: '', tags: [], environments: defaultEnvironments() })) }, revision: 0 }); };
  const addDraftRule = async () => { await waitFor(() => expect(screen.getByRole('button', { name: 'Add rule' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Add rule' })); fireEvent.change(screen.getByLabelText('Attribute for rule 1'), { target: { value: 'plan' } }); };
  it('keeps an unsaved rule draft when another control saves', async () => {
    render(<LocalFlags />); await addDraftRule();
    fireEvent.click(screen.getByRole('switch', { name: 'Enabled in production' })); await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Trigger kill switch' })); await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Attribute for rule 1')).toHaveValue('plan'); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('warns before an environment change discards a rule draft, and keeps it on cancel', async () => {
    const { container } = render(<LocalFlags />); await addDraftRule(); const staging = screen.getByRole('button', { name: 'staging' }); staging.focus(); fireEvent.click(staging);
    const dialog = await screen.findByRole('dialog'); expect(dialog).toHaveTextContent('Discard unsaved changes?'); expect(dialog).toHaveTextContent('Your rule edits for checkout in production are not saved.'); expect((await axe(container)).violations).toEqual([]);
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus(); expect(screen.getByRole('button', { name: 'production' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(staging).toHaveFocus();
    expect(screen.getByLabelText('Attribute for rule 1')).toHaveValue('plan'); expect(screen.getByRole('button', { name: 'production' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(staging); fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'staging' })).toHaveAttribute('aria-pressed', 'true')); expect(screen.queryByLabelText('Attribute for rule 1')).toBeNull();
  });
  it('warns before switching flag with unsaved details and needs no warning when nothing changed', async () => {
    twoFlags(); render(<LocalFlags />); const other = await screen.findByRole('button', { name: /Open search in production/ }); await waitFor(() => expect(other).toBeEnabled());
    fireEvent.click(other); await waitFor(() => expect(screen.getByLabelText('Flag name')).toHaveValue('search')); expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByLabelText('Flag name'), { target: { value: 'Search v2' } }); fireEvent.click(screen.getByRole('button', { name: /Open checkout in production/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Your name, description or tag edits for search are not saved.');
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })); await waitFor(() => expect(screen.getByLabelText('Flag name')).toHaveValue('checkout'));
  });
  it('lets a kill switch on another flag engage without discarding the draft', async () => {
    twoFlags(); render(<LocalFlags />); await addDraftRule();
    fireEvent.click(screen.getByRole('switch', { name: /Kill switch for search in production/ })); await waitFor(() => expect(store.saveWorkspace).toHaveBeenCalledTimes(1));
    expect(store.saveWorkspace.mock.calls[0][0].flags.find((item: { key: string }) => item.key === 'search').environments.production.killSwitchActive).toBe(true);
    expect(screen.getByLabelText('Attribute for rule 1')).toHaveValue('plan'); expect(screen.queryByRole('dialog')).toBeNull();
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

