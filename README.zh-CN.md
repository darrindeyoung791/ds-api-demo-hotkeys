# DS API Demo with Hot Keys

[English](README.md) | 简体中文

本项目修改自 DeepSeek [原版 Chat Demo](https://github.com/deepseek-ai/chat-demo)，在功能上进行一定补全。支持原官方网页端的快捷键和历史对话搜索功能。

基于 DeepSeek API 的静态聊天示例，无需应用后端，浏览器直接请求配置的 API 服务。使用前，请在设置中填写 API Key。

>[!CAUTION]
>
> 本项目并非 DeepSeek 官方产品或服务，也不代表 DeepSeek 的立场。请不要依赖本项目的 GitHub Pages，页面可能不经通知随时关闭或更改地址。

## 特点功能

>[!CAUTION]
>
> 下列功能如有 Bug，请在本项目提 issue 或者 PR，不要去官方 chat demo 存储库请求修改

- 支持 [官方网页端](https://chat.deepseek.com/) 中的快捷键:
  - `Ctrl`+`J` 开启新对话
  - `Ctrl`+`K` 搜索历史对话（并非官方原版实现，行为上存在差异）
- 支持一部分官方没有的快捷键：
  - `Ctrl`+`,` 开启设置
  - `Ctrl` + `↑` / `↓` 上下切换对话（如果在设置中，则上下切换设置标签页）
- 支持多选对话处理（并非官方原版实现，行为上存在差异）
- 移动端竖屏支持手势：从左边缘向右滑动展开侧边栏，在侧边栏内向左滑动收起
- 支持在设置 → 通用设置中选择模型：`deepseek-flash`、`deepseek-v4-pro`，或填写自定义模型名（如果本项目停更而新模型推出的话会有用）

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/darrindeyoung791/ds-api-demo-hotkeys.git
cd ds-api-demo-hotkeys
pnpm install
pnpm dev
```

打开 http://localhost:8090 。

生成静态产物：

```sh
pnpm build
```

产物位于 `dist/`，可部署到静态服务器，也可直接打开 `dist/index.html`。直接打开时，浏览器和 API 服务需允许 `file://` 页面的存储与跨域请求。

## 数据

>[!CAUTION]
>
> 虽然本项目没有恶意，但您也不应当轻信任何自称安全的陌生项目，尤其是需要您提供 API Key 的项目。请始终审计源码（包括本项目）确保您的安全。

API Key 和设置保存在浏览器 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令          | 用途                |
| ------------- | ------------------- |
| `pnpm dev`    | 启动开发服务器      |
| `pnpm build`  | 构建到 `dist/`      |
| `pnpm type`   | TypeScript 类型检查 |
| `pnpm lint`   | oxlint 检查         |
| `pnpm format` | oxfmt 格式化        |

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理。

聊天默认使用 `deepseek-flash`（可在设置中切换模型或填写自定义模型名），通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
