// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import { serviceWorker } from '../../localBuild';

const BASE = '/togglepulse/';
const ORIGIN = 'https://example.test';
const FILES = [BASE, `${BASE}index.html`, `${BASE}assets/app-1.js`, `${BASE}sw.js`];
const CACHE = 'togglepulse-offline-_togglepulse_-';

type Handler = (event: Record<string, unknown>) => void;
interface Exposed { cacheName: (prefix: string, version: string) => string; strategyFor: (...args: unknown[]) => string; CACHE_NAME: string }

function boot(version = 'v1', options: { network?: (request: Request) => Promise<Response>; stored?: Record<string, string[]> } = {}) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>(Object.entries(options.stored ?? {}).map(([name, urls]) => [name, new Map(urls.map((url) => [new URL(url, ORIGIN).href, new Response(`cached ${url}`)]))]));
  const added: Request[] = [];
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => undefined);
  const network = vi.fn(options.network ?? (async (request: Request) => new Response(`network ${new URL(request.url).pathname}`)));
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      addAll: async (requests: Request[]) => { added.push(...requests); for (const request of requests) store.set(request.url, new Response(`precached ${request.url}`)); },
      match: async (request: Request | string) => { const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN); url.search = ''; return store.get(url.href)?.clone(); },
    };
  };
  const context: Record<string, unknown> = {
    self: { addEventListener: (type: string, handler: Handler) => { handlers[type] = handler; }, location: { origin: ORIGIN }, skipWaiting, clients: { claim } },
    caches: { open: async (name: string) => cacheFor(name), keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name) },
    // A worker resolves relative request URLs against its own origin; Node needs that done for it.
    fetch: network, Request: class extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, ORIGIN).href, init); } }, Response, URL,
  };
  vm.runInNewContext(`${serviceWorker(CACHE, version, BASE, FILES)}\nthis.exposed = { cacheName, strategyFor, CACHE_NAME };`, context);
  const exposed = context.exposed as Exposed;
  const respond = async (url: string, init: { method?: string; mode?: string } = {}) => {
    let answer: Promise<Response> | undefined;
    const request = { url: new URL(url, ORIGIN).href, method: init.method ?? 'GET', mode: init.mode ?? 'cors' };
    handlers.fetch({ request, respondWith: (value: Promise<Response>) => { answer = value; } });
    return answer ? (await answer).text() : undefined;
  };
  const wait = async (type: string) => { let done: Promise<unknown> = Promise.resolve(); handlers[type]({ waitUntil: (value: Promise<unknown>) => { done = value; } }); await done; };
  return { exposed, stores, added, skipWaiting, claim, network, respond, wait, handlers };
}

describe('generated service worker', () => {
  it('names the cache from the prefix and the build version', () => {
    const { exposed } = boot('abc123');
    expect(exposed.cacheName('p-', 'abc')).toBe('p-abc'); expect(exposed.CACHE_NAME).toBe(`${CACHE}abc123`);
    expect(boot('def456').exposed.CACHE_NAME).not.toBe(exposed.CACHE_NAME);
  });

  it('chooses network first for the app page, cache first for built files and leaves everything else alone', () => {
    const { exposed } = boot(); const choose = (method: string, mode: string, url: string) => exposed.strategyFor(method, mode, new URL(url), ORIGIN, BASE);
    expect(choose('GET', 'navigate', `${ORIGIN}${BASE}`)).toBe('navigate'); expect(choose('GET', 'navigate', `${ORIGIN}${BASE}?x=1`)).toBe('navigate');
    expect(choose('GET', 'cors', `${ORIGIN}${BASE}assets/app-1.js`)).toBe('asset'); expect(choose('GET', 'no-cors', `${ORIGIN}${BASE}icon-192.png`)).toBe('asset');
    expect(choose('POST', 'cors', `${ORIGIN}${BASE}assets/app-1.js`)).toBe('ignore'); expect(choose('GET', 'cors', 'https://other.test/togglepulse/a.js')).toBe('ignore');
    expect(choose('GET', 'navigate', `${ORIGIN}/elsewhere/`)).toBe('ignore');
  });

  it('precaches every file with cache reload so a stale HTTP copy is never stored', async () => {
    const { wait, added, stores, skipWaiting } = boot('v1'); await wait('install');
    expect(added.map((request) => new URL(request.url).pathname)).toEqual(FILES); expect(added.every((request) => request.cache === 'reload')).toBe(true);
    expect(stores.has(`${CACHE}v1`)).toBe(true); expect(skipWaiting).not.toHaveBeenCalled();
  });

  it('serves the page from the network when it can and from the cached copy when offline', async () => {
    const stored = { [`${CACHE}v1`]: [`${BASE}index.html`, BASE] };
    const online = boot('v1', { stored }); expect(await online.respond(BASE, { mode: 'navigate' })).toBe(`network ${BASE}`);
    const offline = boot('v1', { stored, network: async () => { throw new TypeError('offline'); } });
    expect(await offline.respond(BASE, { mode: 'navigate' })).toBe(`cached ${BASE}`); expect(await offline.respond(`${BASE}?tab=2`, { mode: 'navigate' })).toBe(`cached ${BASE}`);
    expect(await offline.respond(`${BASE}other`, { mode: 'navigate' })).toBe(`cached ${BASE}index.html`);
    const empty = boot('v1', { network: async () => { throw new TypeError('offline'); } }); await expect(empty.respond(BASE, { mode: 'navigate' })).rejects.toThrow('offline');
  });

  it('serves built files from the cache without touching the network', async () => {
    const { respond, network } = boot('v1', { stored: { [`${CACHE}v1`]: [`${BASE}assets/app-1.js`] } });
    expect(await respond(`${BASE}assets/app-1.js`)).toBe(`cached ${BASE}assets/app-1.js`); expect(network).not.toHaveBeenCalled();
    expect(await respond(`${BASE}assets/other.js`)).toBe(`network ${BASE}assets/other.js`); expect(network).toHaveBeenCalledTimes(1);
    expect(await respond(`${BASE}assets/app-1.js`, { method: 'POST' })).toBeUndefined();
  });

  it('waits for the page before activating and deletes only older versioned caches', async () => {
    const { handlers, wait, stores, skipWaiting, claim } = boot('v2', { stored: { [`${CACHE}v1`]: [], [`${CACHE}v2`]: [], 'other-app-v1': [] } });
    await wait('activate'); expect([...stores.keys()].sort()).toEqual(['other-app-v1', `${CACHE}v2`]); expect(claim).toHaveBeenCalled();
    handlers.message({ data: { type: 'SOMETHING_ELSE' } }); handlers.message({ data: null }); expect(skipWaiting).not.toHaveBeenCalled();
    handlers.message({ data: { type: 'SKIP_WAITING' } }); expect(skipWaiting).toHaveBeenCalledTimes(1);
  });
});
