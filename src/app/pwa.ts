/**
 * 注册 Service Worker，让站点可以安装到桌面/主屏，并在离线时仍能打开。
 *
 * 只在生产构建的 http(s) 页面上注册：开发服务器带 HMR，Service Worker 缓存会干扰热更新；
 * `file://` 无法使用 Service Worker，因此直接双击打开 `dist/index.html` 已不再是支持目标。
 */
export const setupPwa = (): void => {
  if (!__PRODUCTION__ || !('serviceWorker' in navigator)) {
    return
  }
  if (location.protocol !== 'https:' && location.protocol !== 'http:') {
    return
  }
  // 相对 document.baseURI 解析：部署在仓库子路径下时同样能定位到站点根目录的 sw.js
  const scriptUrl = new URL('sw.js', document.baseURI).href
  navigator.serviceWorker.register(scriptUrl, { scope: './', updateViaCache: 'none' }).catch(() => {
    // 注册失败（隐私模式、企业策略禁用）不影响应用本身的使用
  })
}
