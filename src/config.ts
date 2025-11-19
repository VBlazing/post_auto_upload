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
export const WATCH_DEBOUNCE_MS = 250;
