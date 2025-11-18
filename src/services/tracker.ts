import { ProcessedManifest, ProcessedRecord } from '../types';
import { readManifest, writeManifest } from '../utils/fs';

class Tracker {
  private cache: ProcessedManifest | null = null;

  private async load(): Promise<ProcessedManifest> {
    if (this.cache) {
      return this.cache;
    }
    this.cache = await readManifest();
    return this.cache;
  }

  async isProcessed(archiveName: string, hash: string): Promise<boolean> {
    const data = await this.load();
    const record = data[archiveName];
    return Boolean(record && record.hash === hash);
  }

  async markProcessed(record: ProcessedRecord): Promise<void> {
    const data = await this.load();
    data[record.archiveName] = record;
    this.cache = data;
    await writeManifest(data);
  }
}

export const tracker = new Tracker();
