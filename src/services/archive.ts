/*
 * @Author: VBlazing
 * @Date: 2025-11-18 21:16:56
 * @LastEditors: VBlazing
 * @LastEditTime: 2025-11-19 15:09:28
 * @Description: archive
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { IMAGE_EXTENSIONS } from '../config';
import { ArchiveLayout } from '../types';

export async function detectLayout(stagingPath: string): Promise<ArchiveLayout> {
  const markdownPath = await findFirstMarkdown(stagingPath);
  if (!markdownPath) {
    throw new Error('未找到 Markdown 文件，无法处理该压缩包');
  }
  const fileRaw = await fs.readFile(markdownPath, 'utf-8');
  const parsed = matter(fileRaw);
  const inferredTitle =
    typeof parsed.data?.title === 'string' && parsed.data.title.trim().length > 0
      ? parsed.data.title.trim()
      : path.basename(markdownPath, path.extname(markdownPath));
  const assetsDir = await findAssetsDir(markdownPath);
  return { markdownPath, assetsDir, inferredTitle };
}

async function findFirstMarkdown(dir: string): Promise<string | undefined> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      return fullPath;
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    const found = await findFirstMarkdown(fullPath);
    if (found) return found;
  }
  return undefined;
}

async function findAssetsDir(markdownPath: string): Promise<string | undefined> {
  const parent = path.dirname(markdownPath);
  const dirEntries = await fs.readdir(parent, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(parent, entry.name);
    if (await directoryContainsImages(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function directoryContainsImages(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && (await directoryContainsImages(fullPath))) {
      return true;
    }
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        return true;
      }
    }
  }
  return false;
}
