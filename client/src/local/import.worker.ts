import { parseFlags } from './flags';
self.onmessage = (event: MessageEvent<string>) => { try { self.postMessage({ data: parseFlags(event.data) }); } catch (error) { self.postMessage({ error: (error as Error).message }); } };
