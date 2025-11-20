# post-auto-upload

## 项目简介
自动监听 `posts/` 目录的文章压缩包，完成解压、图片上传、Markdown 链接替换与发布请求生成，并记录处理历史以避免重复上传。适合将本地稿件（含图片）批量同步到远端博客或存储服务。

## 快速开始
1) 安装依赖：`pnpm install`（使用 pnpm 对应锁文件）。  
2) 配置环境变量，新增 `.env`：
```
COS_SECRETID=xxx
COS_SECRETKEY=xxx
COS_BUCKET=your-bucket
COS_BUCKET_REGION=ap-xxx
BLOG_API_URL_DEV=https://example.dev/api   # 开发环境
# BLOG_API_URL=https://example.com/api     # 生产环境
# COS_PUBLIC_BASE_URL=https://cdn.example.com  # 可选
```
3) 准备稿件：将包含 Markdown 与图片的 `.zip` 放入 `posts/`，常见结构示例：
```
archive.zip
  article.md
  assets/
    cover.png
    imgs/figure1.jpg
```
4) 本地开发运行：`pnpm run dev`，日志显示处理进度，生成的上传请求写入 `upload_data/dev/`，已处理清单写入 `processed-posts.dev.json`。  
5) 生产运行：`pnpm run online`（内部会先 `pnpm run build`），使用 `NODE_ENV=production`、写入 `upload_data/prod/` 与 `processed-posts.prod.json`。

## 目录与产物
- `src/`：TypeScript 源码；`main.ts` 负责监听与调度，`services/` 负责归档识别、COS 上传与处理记录，`utils/` 提供 FS/Markdown 工具。
- `.tmp/`：解压与中间处理的临时目录（运行时生成）。
- `upload_data/<env>/`：生成的发布请求 JSON（按 slug 命名）。
- `dist/`：`pnpm run build` 的输出；不要手动编辑。

## 使用要点
- 稿件按照修改时间排序，始终处理最新的压缩包；若同名压缩包内容未变（哈希一致）会被跳过。
- Markdown 内的本地图片路径会被替换成上传后的公网地址；确保图片随压缩包一起提交。
- 变更前可先在开发模式验证生成的请求体与链接，再切换生产模式上线。***
