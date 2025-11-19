export interface ArchiveInfo {
  name: string;
  path: string;
  mtime: number;
}

export interface ExtractionResult {
  stagingPath: string;
  hash: string;
  archiveName: string;
}

export interface ArchiveLayout {
  markdownPath: string;
  assetsDir?: string;
  inferredTitle: string;
}

export type ArticleRequestBody = Record<string, unknown> & {
  slug: string;
  content: string;
};

export interface UploadPostPayload {
  title: string;
  body: string;
  requestData: ArticleRequestBody;
}

export interface UploadPostResult {
  id: string;
  url: string;
}

export interface ProcessedRecord {
  archiveName: string;
  hash: string;
  remoteId: string;
  remoteUrl: string;
  title: string;
  uploadedAt: string;
}

export type ProcessedManifest = Record<string, ProcessedRecord>;
