/**
 * PWA Service Worker。
 *
 * 构建时由 CopyRspackPlugin 原样复制到 dist 根目录：GitHub Pages 无法设置
 * Service-Worker-Allowed 响应头，只有放在站点根目录才能拿到覆盖整个应用的默认作用域。
 *
 * 这里刻意用「运行时缓存」而不是构建期生成的预缓存清单：
 * 1. 产物文件名带 contenthash，旧文件不会被复用，不需要按构建版本清理缓存；
 * 2. 懒加载 chunk（Prism 语言包、Mermaid、KaTeX）体积大，不适合首屏一次性预缓存；
 * 3. 导航请求走 network-first，部署后用户总能拿到最新 HTML，不会被旧缓存锁死。
 */

const CACHE_PREFIX = 'chat-demo-'
const CACHE_NAME = `${CACHE_PREFIX}static-v1`
/** 缓存条目上限：条目只增不减会无限增长，用数量上限兜底 */
const MAX_ENTRIES = 200
const SHELL_URL = './index.html'

/** 相对 Service Worker 的作用域解析绝对地址，站点部署在子路径下同样适用 */
const scopeUrl = (path) => new URL(path, self.registration.scope).href

/** 逐个写入：单个文件取不到时不应该让整个安装失败 */
const precacheShell = async () => {
  const cache = await caches.open(CACHE_NAME)
  await Promise.all(
    [scopeUrl('./'), scopeUrl(SHELL_URL)].map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' })
        if (response.ok) {
          await cache.put(url, response)
        }
      } catch {
        // 安装阶段网络不可用时跳过，首次在线导航会重新缓存外壳
      }
    })
  )
}

/** keys() 按写入顺序返回，超限时删除最旧的条目 */
const trimCache = async (cache) => {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ENTRIES
  if (excess <= 0) {
    return
  }
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

/** 导航：优先网络，保证部署后立刻拿到最新 HTML；离线时回退到最近一次成功加载的外壳 */
const handleNavigation = async (request) => {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const copy = response.clone()
      void cache.put(request, copy).then(() => trimCache(cache))
    }
    return response
  } catch {
    const cached =
      (await cache.match(request)) ??
      (await cache.match(scopeUrl(SHELL_URL))) ??
      (await cache.match(scopeUrl('./')))
    // 完全没有缓存时返回网络错误，由浏览器显示自己的离线提示
    return cached ?? Response.error()
  }
}

/** 后台重新验证：非哈希文件（清单、图标）改动后最多旧一次 */
const revalidate = async (request, cache) => {
  try {
    const response = await fetch(request, { cache: 'no-cache' })
    if (response.ok) {
      await cache.put(request, response)
      await trimCache(cache)
    }
  } catch {
    // 后台更新失败时继续使用旧副本
  }
}

/** 静态资源：缓存优先（文件名带 hash，内容不会变），未命中时取网络并回填 */
const handleAsset = async (request) => {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) {
    void revalidate(request, cache)
    return cached
  }
  const response = await fetch(request)
  if (response.ok) {
    const copy = response.clone()
    void cache.put(request, copy).then(() => trimCache(cache))
  }
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell()
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          // 只清理本应用的缓存：github.io 上其他仓库与本应用共享 origin
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // 只接管同源 GET：跨域请求（含 SSE 流式回复）交给浏览器直连，不影响流式与重传
  if (request.method !== 'GET') {
    return
  }
  if (new URL(request.url).origin !== self.location.origin) {
    return
  }
  // Range 请求需要完整文件，无法用缓存副本响应（例如音视频拖动）
  if (request.headers.has('range')) {
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }
  event.respondWith(handleAsset(request))
})
