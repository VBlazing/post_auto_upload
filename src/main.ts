import chokidar from 'chokidar';
import path from 'node:path';
import { POSTS_DIR, UPLOAD_DATA_DIR, WATCH_DEBOUNCE_MS } from './config';
import {
  cleanupTemp,
  ensureDir,
  extractArchive,
  hashFile,
  listArchives,
  writeJSON
} from './utils/fs';
import { detectLayout } from './services/archive';
import { uploadAssets, uploadPost } from './services/cloud';
import { peekRequestData, transformMarkdown } from './utils/markdown';
import { tracker } from './services/tracker';

let processing = false;
let shouldRerun = false;

async function triggerProcessing(reason: string) {
  console.log(`触发处理：${reason}`);
  if (processing) {
    shouldRerun = true;
    return;
  }
  processing = true;
  try {
    await processLatestArchive();
  } catch (error) {
    console.error('处理最新文章失败：', error);
  } finally {
    processing = false;
    if (shouldRerun) {
      shouldRerun = false;
      await triggerProcessing('队列中的后续任务');
    }
  }
}

async function processLatestArchive() {
  const archives = await listArchives();
  if (!archives.length) {
    console.log('posts 目录中还没有可用的压缩文件');
    return;
  }
  const latest = archives[archives.length - 1];
  const hash = await hashFile(latest.path);
  if (await tracker.isProcessed(latest.name, hash)) {
    console.log(`[skip] ${latest.name} 已处理，跳过`);
    return;
  }

  console.log(`[process] 开始处理 ${latest.name}`);
  const extraction = await extractArchive(latest.path, hash);
  try {
    const layout = await detectLayout(extraction.stagingPath);
    const requestMeta = await peekRequestData(layout.markdownPath);
    const assetMap = await uploadAssets(
      layout.assetsDir,
      path.dirname(layout.markdownPath),
      requestMeta.slug
    );
    const transformed = await transformMarkdown(layout.markdownPath, assetMap);
    const title = transformed.title || layout.inferredTitle;
    const requestFilePath = buildRequestFilePath(transformed.requestBody.slug);
    await writeJSON(requestFilePath, transformed.requestBody);
    const remote = await uploadPost({
      title,
      body: transformed.content,
      requestData: transformed.requestBody
    });
    await tracker.markProcessed({
      archiveName: latest.name,
      hash,
      remoteId: remote.id,
      remoteUrl: remote.url,
      title,
      uploadedAt: new Date().toISOString()
    });
    console.log(`[success] ${title} 已上传，地址：${remote.url}`);
  } finally {
    await cleanupTemp(extraction.stagingPath);
  }
}

async function bootstrap() {
  await ensureDir(POSTS_DIR);
  await ensureDir(UPLOAD_DATA_DIR);
  console.log(`监听目录：${POSTS_DIR}`);
  const watcher = chokidar.watch(POSTS_DIR, {
    ignoreInitial: false,
    depth: 0,
    usePolling: true,
    interval: 1000,
    binaryInterval: 2000
  });
  const debounced = debounce(() => triggerProcessing('文件变化'), WATCH_DEBOUNCE_MS);
  watcher.on('add', () => debounced());
  watcher.on('change', () => debounced());
  watcher.on('ready', () => debounced());
  watcher.on('error', error => console.error('监听器异常', error));
}

function debounce(fn: () => void, delayMs: number) {
  let timer: NodeJS.Timeout | null = null;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(fn, delayMs);
  };
}

function buildRequestFilePath(slug: string): string {
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, '-');
  return path.join(UPLOAD_DATA_DIR, `${safeSlug}.json`);
}

bootstrap().catch(error => {
  console.error('初始化失败:', error);
  process.exitCode = 1;
});
