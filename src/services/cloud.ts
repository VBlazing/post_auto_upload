/*
 * @Author: VBlazing
 * @Date: 2025-11-18 21:17:09
 * @LastEditors: VBlazing
 * @LastEditTime: 2025-11-20 14:31:26
 * @Description: cloud service
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import COS from 'cos-nodejs-sdk-v5';
import {
  BLOG_API_BASE_URL,
  COS_BUCKET,
  COS_BUCKET_REGION,
  COS_PUBLIC_BASE_URL,
  COS_PROXY,
  COS_SECRET_ID,
  COS_SECRET_KEY,
  IMAGE_EXTENSIONS
} from '../config';
import { ArticleRequestBody, UploadPostPayload, UploadPostResult } from '../types';

const cosClient = new COS({
  SecretId: COS_SECRET_ID,
  SecretKey: COS_SECRET_KEY,
  AutoSwitchHost: false,
  ...(COS_PROXY ? { Proxy: COS_PROXY } : {})
});

export async function uploadImage(localPath: string, slug: string): Promise<string> {
  const fileContent = await fs.readFile(localPath);
  const filename = path.basename(localPath);
  const sanitizedName = stripWhitespace(filename);
  const key = buildCosObjectKey(slug, sanitizedName);
  await putObjectToCos(key, fileContent);
  return buildCosFileUrl(key);
}

export async function uploadAssets(
  assetsDir: string | undefined,
  markdownDir: string,
  slug: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!assetsDir) return result;
  const exists = await pathExistsSafe(assetsDir);
  if (!exists) return result;
  const files = await collectAssetFiles(assetsDir);
  for (const file of files) {
    const remoteUrl = await uploadImage(file, slug);
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
  console.log('body: ', body.labels)
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

function buildCosObjectKey(slug: string, filename: string): string {
  const safeSlug = sanitizeSlug(slug);
  const encodedFile = encodeURIComponent(filename);
  const key = `${safeSlug}/${encodedFile}`;
  return key.replace(/^\/+/, '');
}

function sanitizeSlug(slug: string): string {
  const trimmed = slug.trim().replace(/^\/*|\/*$/g, '');
  return trimmed || 'post';
}

function putObjectToCos(key: string, body: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    cosClient.putObject(
      {
        Bucket: COS_BUCKET,
        Region: COS_BUCKET_REGION,
        Key: key,
        Body: body,
        ContentLength: body.length
      },
      (error, data) => {
        if (error) {
          const reason = extractCosErrorReason(error);
          reject(new Error(`上传图片到 COS 失败，key=${key}，原因：${reason}`));
          return;
        }
        resolve();
      }
    );
  });
}

function buildCosFileUrl(key: string): string {
  return `${COS_PUBLIC_BASE_URL}/${key}`.replace(/([^:]\/)\/+/g, '$1');
}

function extractCosErrorReason(error: unknown): string {
  if (!error) {
    return '未知错误';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  const message =
    (error as { error?: { Message?: string }; message?: string }).error?.Message ??
    (error as { message?: string }).message;
  return message || '未知错误';
}

function stripWhitespace(filename: string): string {
  const noWhitespace = filename.replace(/\s+/g, '');
  return noWhitespace.length ? noWhitespace : filename;
}
