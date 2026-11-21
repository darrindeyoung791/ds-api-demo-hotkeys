# PWA 资源

- `sw.js`：Service Worker 源文件，构建时由 `CopyRspackPlugin` 原样复制为 `dist/sw.js`，必须位于站点根目录。
- `icons/`：安装图标与页签图标，构建时整体复制到 `dist/icons/`。

## 图标来源与署名

图标使用的是**鲸鱼娘（whale girl）**插画，来自
<https://github.com/AATINF/deepseek-whale-girl-assets>，版权归原作者所有。

这处署名是使用条件的一部分。替换图标时请同步更新：

- [README.md](../../README.md) 与 [README.zh-CN.md](../../README.zh-CN.md) 的「图片来源 / Credits」；
- 设置 → 关于：文案键 `aboutWhaleGirlLink`，链接常量 `WHALE_GIRL_ART_URL`（在 `src/services/links.ts`）。

## 尺寸与格式

| 文件                   | 尺寸    | 用途                                                             |
| ---------------------- | ------- | ---------------------------------------------------------------- |
| `icon-192.png`         | 192×192 | 清单图标，安装提示用                                             |
| `icon-512.png`         | 512×512 | 清单图标，启动画面与应用列表用；同时声明 `purpose: any maskable` |
| `apple-touch-icon.png` | 180×180 | iOS「添加到主屏幕」                                              |
| `favicon.png`          | 64×64   | 浏览器标签页，只取头部，缩到 16~32px 才看得清                    |

几个踩过的坑：

- **必须是 PNG**：Chrome 的安装条件不接受 JPEG，会报 `manifest-missing-suitable-icon`，即使图标尺寸正确。
- **512 同时充当 maskable**：插画是满幅构图，边缘本身就是画面内容；另做一张四周留白的 maskable 会在裁切处露出插画的硬边。
- **256 色量化**：这张彩色插画用全彩 PNG 时 512 尺寸约 550KB，量化到 256 色（带抖动）后约 138KB，图标尺寸下看不出差别。
