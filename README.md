# dsh-tree-explorer

A DeepSeek Harness plugin bundle (组合包). Installs two plugin entries:

| 插件 | 作用 |
|---|---|
| `tree-panel` | 侧边栏底部的目录树按钮，打开**右侧停靠**的面板，浏览当前会话工作区的**文件与目录**（host 端 `/tree-fs` 服务） |
| `tree-fs` | host 端文件/Git JSON 服务（`/tree-fs/*` 路由），面板的数据源 |

## 安装

前提：`dsh` CLI 已安装，且系统里有 `pnpm`（`dsh plugin` 内部调用 pnpm）。

```sh
# 从 npm 注册表（推荐，发布后）
dsh plugin --profile web add dsh-tree-explorer

# 或从本地目录
dsh plugin --profile web add /path/to/dsh-tree-explorer

# 或从 GitHub（会运行 prepare 构建，需按提示授权 allowBuilds）
dsh plugin --profile web add github:rainghj/dsh-tree-explorer#v0.1.0

# 或 tarball
pnpm pack
dsh plugin --profile web add ./dsh-tree-explorer-0.1.0.tgz
```

然后重启：`dsh web`（浏览器硬刷新 Ctrl+Shift+R）。侧边栏底部会出现目录树按钮。

卸载：

```sh
dsh plugin --profile web remove dsh-tree-explorer
```

## 开发

```sh
node build.mjs          # 打包浏览器端 bundle → dist/client.js
node verify-bundle.mjs  # 无头验证 bundle（load/factory/apply/render）
```

客户端 bundle 是 `dsh web` **启动时**组装的：改客户端代码后必须重新 build 并重启 `dsh web`。

## 布局

```
lib/index.js        服务端桩（让插件出现在 Loader 诊断里；浏览器端通过 dsh.client 分发）
lib/tree-fs.js      host 文件/Git 服务（webServer 路由 /tree-fs/*）
src/client/         浏览器端源码（CJS，build.mjs 零依赖打包）
dist/client.js      浏览器端 bundle（构建产物）
cordis.patch.yml    本包的 patch 层：插入上述两个插件行
```

## 安全说明（M1）

`/tree-fs/*` 是 host 上的 JSON 接口，服务于本地浏览器。当前实现：
- ✅ 校验 `path` 必须绝对路径、禁止 `..` 目录穿越
- ✅ 列表上限 2000 项 / 读取上限 1 MiB
- ⚠️ 待加固：Origin/Host 校验（按 trustedHosts）、把可访问范围限制到工作区根目录、Windows 隐藏属性识别

## 路线图

- [x] M1 文件浏览（目录+文件、目录优先、面包屑、隐藏开关）
- [ ] M2 文件查看（点击文件 → 文本预览，`/tree-fs/read` 已就绪）
- [ ] M3 Git 状态徽标（`/tree-fs/git/status` 已就绪）
- [ ] M4 单文件 diff 视图（`/tree-fs/git/diff` 已就绪）
- [ ] 拖拽调宽面板

## 许可

MIT
