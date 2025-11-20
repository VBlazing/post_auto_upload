import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = process.cwd();
export const POSTS_DIR = path.resolve(ROOT_DIR, 'posts');
export const TEMP_DIR = path.resolve(ROOT_DIR, '.tmp');
export const SUPPORTED_ARCHIVE_EXTENSIONS = ['.zip'];
export const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.bmp',
  '.webp',
  '.avif'
]);
const ENV_PATH = path.resolve(ROOT_DIR, '.env');
hydrateEnv(ENV_PATH);

export const WATCH_DEBOUNCE_MS = 250;

const NODE_ENV = process.env.NODE_ENV?.trim() || 'development';
const PROD_FLAG = NODE_ENV === 'production';
const ENV_SUFFIX = PROD_FLAG ? 'prod' : 'dev';
export const MANIFEST_PATH = path.resolve(ROOT_DIR, `processed-posts.${ENV_SUFFIX}.json`);
export const UPLOAD_DATA_DIR = path.resolve(ROOT_DIR, 'upload_data', ENV_SUFFIX);

function pickEnvValue(): string {
  const prodValue = process.env.BLOG_API_URL?.trim();
  const devValue = process.env.BLOG_API_URL_DEV?.trim();
  if (PROD_FLAG) {
    if (!prodValue) {
      throw new Error('未配置 BLOG_API_URL，无法上传文章');
    }
    return prodValue;
  }
  if (devValue) {
    return devValue;
  }
  if (prodValue) {
    return prodValue;
  }
  throw new Error('未配置 BLOG_API_URL_DEV 或 BLOG_API_URL');
}

export const BLOG_API_BASE_URL = pickEnvValue();
export const COS_SECRET_ID = requireEnv('COS_SECRETID');
export const COS_SECRET_KEY = requireEnv('COS_SECRETKEY');
export const COS_BUCKET = requireEnv('COS_BUCKET');
export const COS_BUCKET_REGION = requireEnv('COS_BUCKET_REGION');
export const COS_UPLOAD_HOST = `${COS_BUCKET}.cos.${COS_BUCKET_REGION}.myqcloud.com`;
const DEFAULT_COS_BASE_URL = `https://${COS_UPLOAD_HOST}`;
export const COS_PUBLIC_BASE_URL =
  process.env.COS_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || DEFAULT_COS_BASE_URL;
export const COS_PROXY = readOptionalEnv('COS_PROXY');
if (!COS_PROXY) {
  ensureNoProxyForHost(COS_UPLOAD_HOST);
  ensureNoProxyForHost('.myqcloud.com');
  ensureNoProxyForHost('.tencentcos.cn');
}

function hydrateEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || key in process.env) {
      continue;
    }
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`缺少必要的环境变量：${key}`);
  }
  return value;
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length ? value : undefined;
}

function ensureNoProxyForHost(host: string): void {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) {
    return;
  }
  const current =
    process.env.NO_PROXY?.trim() || process.env.no_proxy?.trim() || '';
  if (current === '*') {
    return;
  }
  const segments = current
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const alreadyIncluded = segments.some(entry => matchesNoProxy(entry, normalizedHost));
  if (alreadyIncluded) {
    return;
  }
  segments.push(normalizedHost);
  const nextValue = segments.join(',');
  process.env.NO_PROXY = nextValue;
  process.env.no_proxy = nextValue;
}

function matchesNoProxy(entry: string, host: string): boolean {
  const normalizedEntry = entry.toLowerCase();
  if (!normalizedEntry) {
    return false;
  }
  if (normalizedEntry === host) {
    return true;
  }
  if (normalizedEntry.startsWith('.')) {
    return host.endsWith(normalizedEntry);
  }
  return false;
}
