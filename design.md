**Guide Overview**
- Goal: build a Node/TypeScript tool that watches `posts/`, automatically extracts the newest archive, uploads any assets, updates image URLs in the markdown, publishes the post, and marks it as processed so reruns skip it (`requirement.md`).
- Stack: TypeScript + pnpm. We’ll rely on chokidar for FS watching, adm-zip (or unzipper) for extraction, gray-matter/remark for markdown edits, a stub cloud uploader, and a JSON manifest for processed posts.

**Step‑By‑Step Plan**
1. **Bootstrap project** – `pnpm init -y`, `pnpm add typescript ts-node @types/node chokidar adm-zip gray-matter unified remark-parse remark-stringify remark-html uuid`, `pnpm add -D tsconfig-paths`.
2. **Define structure**
   - `src/config.ts`: paths, temp dirs, manifest path, cloud endpoints.
   - `src/types.ts`: PostStatus, UploadResult, ArchiveLayout, etc.
   - `src/utils/fs.ts`: helpers (`ensureDir`, `readJSON`, `writeJSON`, `listArchives`, `extractLatestArchive`).
   - `src/utils/markdown.ts`: parse markdown, swap image URLs after upload.
   - `src/services/cloud.ts`: placeholder upload methods (images + markdown).
   - `src/services/archive.ts`: unzip to temp staging, detect layout (single markdown vs markdown + assets folder).
   - `src/services/tracker.ts`: read/write processed manifest keyed by archive filename.
   - `src/main.ts`: chokidar watcher, orchestrates extraction → upload → tracking with logging.

3. **Watching flow**
   - Watch `posts/*.zip` (or other extensions) with chokidar `add` + `change`.
   - When triggered, re-scan archives, pick newest by mtime, skip if manifest already contains it.
   - Extract into `tmp/<archiveName>/`.
   - Detect markdown file path and (optionally) `assets/` dir with images referenced inside the markdown.
   - Upload images first; maintain a map plainPath→cdnUrl returned by `cloud.uploadImage`.
   - Run markdown transformer replacing `![](relative)` with CDN URLs.
   - Upload article via `cloud.uploadPost` returning remote ID/URL.
   - Update manifest (`processed-posts.json`) with archive name, hash, uploadedAt, remoteId.

4. **Image handling**
   - Parse markdown AST with `unified().use(remarkParse)`; locate nodes `type==='image'`.
   - For each node, resolve the file path relative to extracted folder; upload; swap `node.url`.
   - After transform, `remarkStringify` to string, write to temp file before uploading.

5. **Marking processed posts**
   - Manifest structure example:
     ```json
     {
       "example.zip": {
         "hash": "sha256...",
         "uploadedAt": "2024-05-29T10:00:00Z",
         "remoteId": "post_123"
       }
     }
     ```
   - Update after successful upload; guard writes with `fs.promises.writeFile` and `JSON.stringify(..., null, 2)`.

**Executable Sample (`src/main.ts`)**
```ts
import chokidar from 'chokidar';
import path from 'node:path';
import { listArchives, extractLatestArchive, cleanupTemp } from './utils/fs';
import { detectLayout } from './services/archive';
import { uploadAssets, uploadPost } from './services/cloud';
import { transformMarkdown } from './utils/markdown';
import { tracker } from './services/tracker';

async function processLatestArchive() {
  const archives = await listArchives();
  const latest = archives.at(-1);
  if (!latest) return;

  if (tracker.isProcessed(latest.name)) {
    console.log(`[skip] ${latest.name} already processed`);
    return;
  }

  const staging = await extractLatestArchive(latest.path);
  try {
    const layout = await detectLayout(staging);
    const assetMap = await uploadAssets(layout.assetsDir);
    const transformedMd = await transformMarkdown(layout.markdownPath, assetMap);
    const remote = await uploadPost({
      title: layout.title,
      body: transformedMd,
    });
    tracker.markProcessed(latest.name, remote);
    console.log(`[done] Uploaded ${layout.title} → ${remote.url}`);
  } finally {
    await cleanupTemp(staging);
  }
}

function startWatcher() {
  const watcher = chokidar.watch(path.resolve('posts'), {
    ignored: /(^|[/\\])\../,
    ignoreInitial: false,
    depth: 0,
  });
  const run = () => processLatestArchive().catch(err => console.error(err));
  watcher.on('add', run).on('change', run);
  console.log('Watching posts/ for new archives...');
}

startWatcher();
```

**Supporting Modules (highlights)**
- `utils/fs.ts`: uses `fs.promises`, `crypto.createHash` for archive hash, `AdmZip` to extract into `tmp/uuid`.
- `services/cloud.ts`:
  ```ts
  export async function uploadImage(localPath: string): Promise<string> {
    // TODO: replace with real SDK call
    await delay(200);
    return `https://cdn.example.com/${path.basename(localPath)}`;
  }
  export async function uploadPost(post: { title: string; body: string }) {
    await delay(300);
    return { id: randomUUID(), url: `https://blog.example.com/${slug(post.title)}` };
  }
  ```
- `utils/markdown.ts`: parse remark AST, replace `node.url` via provided map or by uploading on the fly, then stringify.

**Command-Line Walkthrough**
1. `cd /path/to/post_auto_upload`
2. Initialize: `pnpm init -y`
3. Install deps: `pnpm add chokidar adm-zip gray-matter unified remark-parse remark-stringify remark-gfm ts-node uuid` and dev deps `pnpm add -D typescript @types/node ts-node`
4. Create `tsconfig.json`:
   ```json
   { "compilerOptions": { "target": "ES2020", "module": "CommonJS", "outDir": "dist", "esModuleInterop": true, "strict": true }, "include": ["src"] }
   ```
5. Add scripts in `package.json`:
   ```json
   "scripts": { "dev": "ts-node src/main.ts", "build": "tsc" }
   ```
6. Run watcher: `pnpm dev`
   - Drop a `.zip` into `posts/`.
   - Console shows extraction + uploads + manifest update.

**Explanation & Principles**
- **Latest-only guarantee**: on every FS event, re-read `posts` sorted by mtime; skip if manifest already contains top entry.
- **Idempotence**: manifest prevents reprocessing the same zip; hash checks optional to catch mutated archives.
- **Atomicity**: mark processed only after cloud upload succeeds; cleanup staging folder in `finally` to avoid clutter.
- **Extensibility**: swap `services/cloud.ts` with actual SDK (e.g., AWS S3 + blog API) without touching watcher logic.
- **Safety**: `ignoreInitial:false` ensures the first run processes existing archives once; chokidar handles macOS/Linux differences.

**Next Steps**
1. Flesh out real upload adapters (S3, OSS, etc.) and configure credentials securely.
2. Add unit tests for layout detection and markdown transforms.
3. Consider CLI flags for dry-run mode and verbose logging.
