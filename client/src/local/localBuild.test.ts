// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LOCAL_CSP } from '../../localBuild';
let directory: string;
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
describe('offline Pages output', () => {
  it('emits the exact CSP, self-hosted fonts, scoped manifest and complete cache', async () => {
    directory = await mkdtemp(join(tmpdir(), 'togglepulse-build-'));
    await build({ root: resolve('.'), mode: 'pages', build: { outDir: directory, emptyOutDir: true }, logLevel: 'silent' });
    const html = await readFile(join(directory, 'index.html'), 'utf8');
    expect(html.replaceAll('&#39;', "'")).toContain(LOCAL_CSP);
    // The original data-URL favicon contains the SVG namespace, which is not a request.
    expect(html.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    expect(html).toContain('/togglepulse/manifest.webmanifest');
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.scope).toBe('/togglepulse/'); expect(manifest.start_url).toBe('/togglepulse/'); expect(manifest.theme_color).toBe('#111317');
    const worker = await readFile(join(directory, 'sw.js'), 'utf8');
    const assets = await readdir(join(directory, 'assets'));
    for (const asset of assets) expect(worker).toContain(`/togglepulse/assets/${asset}`);
    expect(worker).toContain("cache: 'reload'"); expect(worker).toContain('SKIP_WAITING'); expect(worker).not.toMatch(/^\s*self\.skipWaiting\(\)/m);
    expect(assets.some(asset => asset.includes('import.worker'))).toBe(true);
    for (const asset of assets.filter(asset => asset.endsWith('.css'))) {
      const css = await readFile(join(directory, 'assets', asset), 'utf8');
      for (const face of css.matchAll(/@font-face\{[^}]+\}/g)) expect(face[0]).not.toContain('data:');
    }
  }, 60000);
});

