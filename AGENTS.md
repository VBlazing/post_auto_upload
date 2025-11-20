# Repository Guidelines

## Project Structure & Module Organization
- `src/main.ts` watches `posts/` for new archives, orchestrates extraction, markdown transform, and upload logging.
- `src/services/` handles archive layout detection, Tencent COS uploads, and the processed-manifest tracker; `src/utils/` covers FS helpers and markdown parsing.
- Runtime data stays outside the source tree: drop `.zip` inputs into `posts/`, temporary work goes to `.tmp/`, request payloads live in `upload_data/<env>/`, and processed manifests sit in `processed-posts.<env>.json`.
- Built output is emitted to `dist/` via `tsc`; keep edits in `src/` and refresh builds before production runs.

## Build, Test, and Development Commands
- `pnpm install` – install dependencies (pnpm is expected since the lockfile is pnpm-based).
- `pnpm run dev` – run the watcher in development mode (`NODE_ENV=development`), writing upload payloads under `upload_data/dev/`.
- `pnpm run build` – type-check and compile TypeScript to `dist/`.
- `pnpm run online` – production path: build, then execute `dist/main.js` with `NODE_ENV=production`, reading `.env` and writing manifests under `upload_data/prod/`.

## Coding Style & Naming Conventions
- TypeScript with `strict` mode; prefer 2-space indentation and single quotes to match existing files.
- Use camelCase for variables/functions, PascalCase for types/interfaces; keep filenames lowercase with hyphens or single words (`config.ts`, `tracker.ts`).
- Favor small, pure helpers in `src/utils/`; keep side effects centralized in `src/main.ts` or `src/services/*`.

## Testing Guidelines
- No framework is preset; when adding tests, prefer Node's built-in `node --test` after building, or run TypeScript tests via `ts-node` in development.
- Place specs alongside code under `src/**/__tests__/` and name them `*.test.ts`.
- Cover new parsing rules, slug handling, and upload request shaping; include fixtures under `posts/` or a dedicated `fixtures/` directory and clean up temp artifacts.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commit style (`feat: …`, `style: …`, etc.) seen in `git log`.
- PRs should summarize behavior changes, list key commands run (`pnpm run build`, tests), and link related issues/tasks. Include logs or sample processed titles/URLs when touching upload flows.
- Keep diffs focused and avoid committing generated artifacts (`dist/`, `node_modules/`, runtime manifests, or uploaded payloads).

## Security & Configuration
- Required environment keys: `BLOG_API_URL`/`BLOG_API_URL_DEV`, `COS_SECRETID`, `COS_SECRETKEY`, `COS_BUCKET`, `COS_BUCKET_REGION`; optional `COS_PUBLIC_BASE_URL` or `COS_PROXY`.
- Load secrets via `.env` (not committed). The app updates `NO_PROXY` entries for COS hosts; avoid overriding this unless necessary.
- Verify credentials using non-production archives before running `pnpm run online` to prevent accidental uploads.
