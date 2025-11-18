# 项目概览

该工具基于 Node.js 与 TypeScript，监听 `posts/` 目录的压缩包变动，自动完成解压、图片上传、Markdown 内容替换以及文章发布，并通过本地清单文件记录已处理的文章，保证重复运行时能够跳过旧文件。

# 目录结构

```
post_auto_upload/
  package.json            # pnpm 脚本与依赖定义
  pnpm-lock.yaml         # pnpm 锁定文件
  tsconfig.json          # TypeScript 编译配置
  requirement.md         # 原始需求描述
  design.md              # 设计方案
  doc.md                 # 目录与功能说明（本文档）
  posts/                 # 待监听的压缩包目录
  dist/                  # tsc 构建后的 JavaScript
  src/                   # 核心 TypeScript 源码
    main.ts              # chokidar 监听入口与任务调度
    config.ts            # 路径、扩展名等全局配置
    types.ts             # 归档、上传、清单等类型定义
    services/
      archive.ts         # 识别解压结果、推断 Markdown 与资源目录
      cloud.ts           # 图片与正文上传的占位实现
      tracker.ts         # 已处理文章的本地清单读写
    utils/
      fs.ts              # 目录创建、解压、清单持久化等 FS 工具
      markdown.ts        # 使用 unified/remark 替换 Markdown 中的图片链接
```

# 功能介绍

- **监听与调度（src/main.ts）**：启动 chokidar 监视 `posts/`，任何新增或更新都会触发去扫描最新压缩包。通过防抖与串行执行机制，保证多次触发时顺序处理且不会漏掉任务。
- **归档处理（src/utils/fs.ts + src/services/archive.ts）**：列出并按修改时间排序压缩包，解压到 `.tmp` 临时目录，自动定位 Markdown 文件与可能存在的图片目录，同时计算 ZIP 的 SHA-256 用于去重。
- **图片上传与 Markdown 重写（src/services/cloud.ts + src/utils/markdown.ts）**：先批量上传解压目录中的图片，构建“本地路径 → 云端 URL”映射；随后借助 unified/remark 遍历 Markdown 中的 `image` 节点，将本地引用替换成真实的 CDN 链接，必要时补充上传遗漏的图片。
- **文章上传（src/services/cloud.ts）**：在示例代码中以占位实现模拟上传，返回远端 ID 与 URL；替换真实使用场景时可接入 OSS/S3 及博客平台 API。
- **处理记录（src/services/tracker.ts）**：使用 `processed-posts.json` 记录每个压缩包的文件名、哈希、上传时间及远端信息。再次运行时会先对比哈希，若相同则直接跳过，保证幂等。
- **构建与运行**：开发阶段执行 `pnpm dev` 直接以 ts-node 运行监听器；生产前运行 `pnpm run build` 产出 `dist/`，再由 `node dist/main.js` 常驻执行。
