import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import AdmZip from 'adm-zip';
import {
  MANIFEST_PATH,
  POSTS_DIR,
  SUPPORTED_ARCHIVE_EXTENSIONS,
  TEMP_DIR
} from '../config';
import { ArchiveInfo, ExtractionResult, ProcessedManifest } from '../types';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) {
    return fallback;
  }
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function listArchives(): Promise<ArchiveInfo[]> {
  await ensureDir(POSTS_DIR);
  const dirEntries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
  const archives: ArchiveInfo[] = [];
  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_ARCHIVE_EXTENSIONS.includes(ext)) continue;
    const fullPath = path.join(POSTS_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    archives.push({
      name: entry.name,
      path: fullPath,
      mtime: stats.mtimeMs
    });
  }
  archives.sort((a, b) => a.mtime - b.mtime);
  return archives;
}

export async function hashFile(filePath: string): Promise<string> {
  const hasher = crypto.createHash('sha256');
  const stream = fssync.createReadStream(filePath);
  return await new Promise((resolve, reject) => {
    stream.on('data', chunk => hasher.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hasher.digest('hex')));
  });
}

export async function extractArchive(
  archivePath: string,
  hash?: string
): Promise<ExtractionResult> {
  await ensureDir(TEMP_DIR);
  const basename = path.basename(archivePath, path.extname(archivePath));
  const stagingPath = path.join(
    TEMP_DIR,
    `${basename}-${Date.now()}-${randomUUID()}`
  );
  await ensureDir(stagingPath);
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(stagingPath, true);
  return {
    stagingPath,
    hash: hash ?? (await hashFile(archivePath)),
    archiveName: path.basename(archivePath)
  };
}

export async function cleanupTemp(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

export async function readManifest(): Promise<ProcessedManifest> {
  return readJSON<ProcessedManifest>(MANIFEST_PATH, {});
}

export async function writeManifest(data: ProcessedManifest): Promise<void> {
  await writeJSON(MANIFEST_PATH, data);
}
