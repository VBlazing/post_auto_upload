import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Content, Heading, Image, Root, Code } from 'mdast';
import { uploadImage } from '../services/cloud';
import { ArticleRequestBody } from '../types';

interface TransformResult {
  content: string;
  title: string;
  referencedImages: string[];
  requestBody: ArticleRequestBody;
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
  const tree = processor.parse(parsed.content) as Root;
  const { dataSectionNodes } = stripSpecialSections(tree);
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

  const processed = (await processor.run(tree)) as Root;
  const transformedContent = processor.stringify(processed as any);
  const normalizedContent = trimLeadingWhitespace(transformedContent);
  const requestBody = buildRequestBody(dataSectionNodes, normalizedContent);
  const finalMarkdown = matter.stringify(
    normalizedContent,
    parsed.data ?? undefined
  );
  const title =
    typeof parsed.data?.title === 'string' && parsed.data.title.trim().length
      ? parsed.data.title.trim()
      : path.basename(markdownPath, path.extname(markdownPath));

  return {
    content: finalMarkdown,
    title,
    referencedImages,
    requestBody
  };
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

function stripSpecialSections(root: Root) {
  const children = root.children as Content[];
  const filtered: Content[] = [];
  let removedHeading = false;
  let dataSectionNodes: Content[] | undefined;
  for (let i = 0; i < children.length; ) {
    const node = children[i];
    if (!removedHeading && isHeading(node, 1)) {
      removedHeading = true;
      i += 1;
      continue;
    }
    if (isTargetHeading(node, 2, '简介')) {
      i = findSectionEnd(children, i + 1, 2);
      continue;
    }
    if (isTargetHeading(node, 2, '数据')) {
      const end = findSectionEnd(children, i + 1, 2);
      dataSectionNodes = children.slice(i, end);
      i = end;
      continue;
    }
    filtered.push(node);
    i += 1;
  }
  root.children = filtered;
  return { dataSectionNodes };
}

function isHeading(node: Content, depth: number): node is Heading {
  return node.type === 'heading' && node.depth === depth;
}

function isTargetHeading(
  node: Content,
  depth: number,
  text: string
): node is Heading {
  if (!isHeading(node, depth)) return false;
  return extractHeadingText(node).trim().toLowerCase() === text.toLowerCase();
}

function extractHeadingText(node: Heading): string {
  return node.children
    .map(child => ('value' in child && typeof child.value === 'string' ? child.value : ''))
    .join('')
    .trim();
}

function findSectionEnd(
  children: Content[],
  startIndex: number,
  depth: number
): number {
  let cursor = startIndex;
  while (cursor < children.length) {
    const candidate = children[cursor];
    if (candidate.type === 'heading' && (candidate as Heading).depth <= depth) {
      break;
    }
    cursor += 1;
  }
  return cursor;
}

function buildRequestBody(
  sectionNodes: Content[] | undefined,
  content: string
): ArticleRequestBody {
  if (!sectionNodes) {
    throw new Error('未找到“数据”章节，无法构建请求数据');
  }
  const codeNode = sectionNodes
    .slice(1)
    .find(node => node.type === 'code') as Code | undefined;
  if (!codeNode || !codeNode.value.trim()) {
    throw new Error('“数据”章节中缺少 JSON 代码块');
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(codeNode.value);
  } catch {
    throw new Error('“数据”代码块 JSON 解析失败');
  }
  if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
    throw new Error('“数据”代码块 JSON 必须是对象');
  }
  const body: ArticleRequestBody = {
    ...(parsedJson as Record<string, unknown>),
    content
  };
  return body;
}

function trimLeadingWhitespace(value: string): string {
  return value.replace(/^\s+/, '');
}
