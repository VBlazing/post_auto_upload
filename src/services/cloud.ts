/*
 * @Author: VBlazing
 * @Date: 2025-11-18 21:17:09
 * @LastEditors: VBlazing
 * @LastEditTime: 2025-11-19 14:04:22
 * @Description: cloud service
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { IMAGE_EXTENSIONS } from '../config';
import { UploadPostPayload, UploadPostResult } from '../types';

export async function uploadImage(localPath: string): Promise<string> {
  await delay(150);
  const filename = path.basename(localPath);
  return `https://cdn.example.com/${Date.now()}-${filename}`;
}

export async function uploadAssets(
  assetsDir: string | undefined,
  markdownDir: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!assetsDir) return result;
  const exists = await pathExistsSafe(assetsDir);
  if (!exists) return result;
  const files = await collectAssetFiles(assetsDir);
  for (const file of files) {
    const remoteUrl = await uploadImage(file);
    const relative = path.relative(markdownDir, file);
    const normalized = normalizeRelative(relative);
    result.set(normalized, remoteUrl);
    result.set(`./${normalized}`, remoteUrl);
  }
  return result;
}

export async function uploadPost(
  payload: UploadPostPayload
): Promise<UploadPostResult> {
  await delay(250);
  const slug = slugify(payload.title);
  return {
    id: randomUUID(),
    url: `https://blog.example.com/${slug}`
  };
}

function normalizeRelative(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

async function collectAssetFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectAssetFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;
    files.push(fullPath);
  }
  return files;
}

async function pathExistsSafe(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
