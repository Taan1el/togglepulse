import { MAX_FLAGS_FILE, parseFlags, type FlagsFile } from './flags';
export async function importFlags(file: File): Promise<FlagsFile> {
  try {
    if (file.size > MAX_FLAGS_FILE) throw new Error('File exceeds 4 MiB.');
    const input = await file.text();
    if (file.size < 256 * 1024) return parseFlags(input);
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parsing took too long. Reduce the file size.')); }, 30000);
      const done = () => { clearTimeout(timer); worker.terminate(); };
      worker.onmessage = event => { done(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.data); };
      worker.onerror = () => { done(); reject(new Error('File worker could not parse this file.')); }; worker.postMessage(input);
    });
  } catch (error) { throw new Error(`${file.name}: ${(error as Error).message}`); }
}
