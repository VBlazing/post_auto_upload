/*
 * @Author: VBlazing
 * @Date: 2025-11-18 21:17:09
 * @LastEditors: VBlazing
 * @LastEditTime: 2025-11-19 15:40:39
 * @Description: cloud service
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { BLOG_API_BASE_URL, IMAGE_EXTENSIONS } from '../config';
import { ArticleRequestBody, UploadPostPayload, UploadPostResult } from '../types';

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
  return postRequestData(payload.requestData);
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

function ensureFetch(): typeof fetch {
  const fetchFn = globalThis.fetch;
  if (!fetchFn) {
    throw new Error('当前运行环境缺少 fetch，无法上传文章');
  }
  return fetchFn;
}

async function postRequestData(body: ArticleRequestBody): Promise<UploadPostResult> {
  const fetchFn = ensureFetch();

  const endpoint = new URL('/api/post', ensureTrailingSlash(BLOG_API_BASE_URL));
  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: body })
  });
  const payloadText = await response.text();
  if (!response.ok) {
    throw new Error(
      `上传失败(${response.status} ${response.statusText}): ${payloadText || '无响应内容'}`
    );
  }
  const parsed = safeJsonParse(payloadText);
  const remoteId = extractString(parsed?.id, body.slug);
  const remoteUrl = extractString(
    parsed?.url,
    `${trimTrailingSlash(BLOG_API_BASE_URL)}/posts/${body.slug}`
  );
  await delay(50);
  return { id: remoteId, url: remoteUrl };
}

function safeJsonParse(text: string): any {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractString(candidate: unknown, fallback: string): string {
  return typeof candidate === 'string' && candidate.trim().length
    ? candidate
    : fallback;
}

function ensureTrailingSlash(input: string): string {
  return input.endsWith('/') ? input : `${input}/`;
}

function trimTrailingSlash(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}
