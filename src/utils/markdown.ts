import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Image } from 'mdast';
import { uploadImage } from '../services/cloud';

interface TransformResult {
  content: string;
  title: string;
  referencedImages: string[];
}

export async function transformMarkdown(
  markdownPath: string,
  assetMap: Map<string, string>
): Promise<TransformResult> {
  const raw = await fs.readFile(markdownPath, 'utf-8');
  const parsed = matter(raw);
  const markdownDir = path.dirname(markdownPath);
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify, { fences: true, bullet: '-', listItemIndent: 'one' });
  const tree = processor.parse(parsed.content);
  const imageNodes: Image[] = [];
  visit(tree as any, 'image', node => {
    imageNodes.push(node as Image);
  });
  const referencedImages: string[] = [];
  for (const node of imageNodes) {
    const originalUrl = node.url ? String(node.url) : '';
    if (!originalUrl || isRemoteUrl(originalUrl)) {
      continue;
    }
    const normalizedKey = normalizeMarkdownPath(originalUrl);
    let remoteUrl = assetMap.get(normalizedKey);
    if (!remoteUrl) {
      remoteUrl = await tryUploadFromDisk(markdownDir, originalUrl, assetMap);
    }
    if (remoteUrl) {
      node.url = remoteUrl;
      referencedImages.push(remoteUrl);
    } else {
      console.warn(`无法找到图片: ${originalUrl}`);
    }
  }

  const processed = (await processor.run(tree)) as any;
  const transformedContent = processor.stringify(processed as any);
  const finalMarkdown = matter.stringify(
    transformedContent,
    parsed.data ?? undefined
  );
  const title =
    typeof parsed.data?.title === 'string' && parsed.data.title.trim().length
      ? parsed.data.title.trim()
      : path.basename(markdownPath, path.extname(markdownPath));

  return { content: finalMarkdown, title, referencedImages };
}

function isRemoteUrl(url: string): boolean {
  return /^([a-z]+:)?\/\//i.test(url);
}

function normalizeMarkdownPath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function tryUploadFromDisk(
  markdownDir: string,
  referencePath: string,
  assetMap: Map<string, string>
): Promise<string | undefined> {
  const absolute = path.resolve(markdownDir, referencePath);
  try {
    await fs.access(absolute);
  } catch {
    return undefined;
  }
  const uploaded = await uploadImage(absolute);
  const normalized = normalizeMarkdownPath(
    path.relative(markdownDir, absolute).replace(/\\/g, '/')
  );
  assetMap.set(normalized, uploaded);
  return uploaded;
}
