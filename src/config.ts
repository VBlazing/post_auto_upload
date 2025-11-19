import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = process.cwd();
export const POSTS_DIR = path.resolve(ROOT_DIR, 'posts');
export const TEMP_DIR = path.resolve(ROOT_DIR, '.tmp');
export const MANIFEST_PATH = path.resolve(ROOT_DIR, 'processed-posts.json');
export const UPLOAD_DATA_DIR = path.resolve(ROOT_DIR, 'upload_data');
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
