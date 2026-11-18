# DS API Demo with Hot Keys

English | [简体中文](README.zh-CN.md)

This project is modified from DeepSeek's [original Chat Demo](https://github.com/deepseek-ai/chat-demo) with some feature additions. It supports the keyboard shortcuts and chat history search of the official web client.

A static chat demo powered by the DeepSeek API. No application backend is required: the browser connects directly to the configured API service. Enter your API key in Settings before your first chat.

>[!CAUTION]
>
> This project is **NOT** an official DeepSeek product or service, and does not represent DeepSeek's positions. Do not rely on this project's GitHub Pages; the page may be shut down or moved without notice.

## Features

>[!CAUTION]
>
> If any of the features below has a bug, please open an issue or PR in this project instead of asking the upstream chat demo repository for changes.

- Supports the shortcuts from the [official web client](https://chat.deepseek.com/):
  - `Ctrl`+`J` starts a new chat
  - `Ctrl`+`K` searches chat history (not the official implementation; behavior differs)
- Supports some shortcuts the official client does not have:
  - `Ctrl`+`,` opens Settings
  - `Ctrl` + `↑` / `↓` switches chats (switches between settings tabs while Settings is open)
- Supports multi-selecting chats for bulk actions (not the official implementation; behavior differs)
- Mobile portrait gestures: swipe in from the left edge to open the sidebar, swipe left inside it to close
- Choose the model in Settings → General: `deepseek-flash`, `deepseek-v4-pro`, or enter a custom model name (might be useful when new models are released while this project doesn't catch up)

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/darrindeyoung791/ds-api-demo-hotkeys.git
cd ds-api-demo-hotkeys
pnpm install
pnpm dev
```

Open http://localhost:8090.

To build the static site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to a static web server or open `dist/index.html` directly. Opening the file directly requires the browser and the API service to allow storage and cross-origin requests for `file://` pages.

## Data

>[!CAUTION]
>
> This project is not malicious. However you should never blindly trust any unfamiliar project that claims to be safe, especially one that asks you for an API key. Always review the source code to keep yourself safe.

Your API key and settings are stored in the browser's localStorage. Conversations and original attachments are stored in IndexedDB. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and other settings are preserved; files already uploaded to the API service are not affected.

## Development

| Command       | Description                  |
| ------------- | ---------------------------- |
| `pnpm dev`    | Start the development server |
| `pnpm build`  | Build into `dist/`           |
| `pnpm type`   | Run TypeScript type checks   |
| `pnpm lint`   | Lint with oxlint             |
| `pnpm format` | Format with oxfmt            |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default (switch models or enter a custom model name in Settings) and communicates through Anthropic-compatible Messages / Files APIs. Speech features use ASR / TTS endpoints. Requests include extensions such as search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
