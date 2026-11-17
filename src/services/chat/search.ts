import { getVisibleMessages } from './branches.js'
import * as db from './db.js'
import { getReplyText } from './reply.js'
import { useChatStore } from './store.js'
import type { Message, Session } from './types.js'

/**
 * 历史对话搜索索引。文本在建立索引时折叠空白，摘要窗口与命中判断都基于同一份字符串；
 * 索引只在打开搜索浮层时构建一次，输入时只在内存中匹配。
 *
 * 与官方一致：只匹配消息正文（不单独匹配标题），关键词为空时没有结果。
 */

export type HistoryMessageEntry = {
  messageId: string
  sessionId: string
  title: string
  role: 'user' | 'assistant'
  text: string
  /** 预先转成小写的副本：每次按键都要匹配全部消息，避免重复分配字符串 */
  search: string
  createdAt: number
}

export type HistoryIndex = {
  messages: HistoryMessageEntry[]
}

export type HistorySearchHit = {
  /** 列表 key：按消息去重 */
  key: string
  sessionId: string
  title: string
  role: 'user' | 'assistant'
  createdAt: number
  snippet: string
}

/** 结果条数上限，避免长历史一次渲染过多行 */
const RESULT_LIMIT = 50
/** 摘要窗口：命中位置前后保留的字符数 */
const SNIPPET_BEFORE = 24
const SNIPPET_AFTER = 96

/** 折叠换行与连续空白：结果行是单行文本，命中位置也要与展示文本一致 */
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

const messageText = (message: Message) =>
  normalize(message.role === 'user' ? message.content : getReplyText(message))

/**
 * 读取全部会话的正文构建索引：已打开的会话用内存中的最新版本，其余逐条从 IndexedDB 读取。
 * 单个会话读取失败时跳过，不影响其他会话的结果。
 */
export const collectHistoryIndex = async (): Promise<HistoryIndex> => {
  const { sessions, sessionCache } = useChatStore.getState()
  const messages: HistoryMessageEntry[] = []

  for (const summary of sessions) {
    let session: Session | undefined = Object.hasOwn(sessionCache, summary.id)
      ? sessionCache[summary.id]
      : undefined
    if (!session) {
      try {
        session = await db.loadSession(summary.id)
      } catch {
        continue
      }
    }
    if (!session) {
      continue
    }

    for (const message of getVisibleMessages(session)) {
      const text = messageText(message)
      if (!text) {
        continue
      }
      messages.push({
        messageId: message.id,
        sessionId: summary.id,
        title: summary.title,
        role: message.role,
        text,
        search: text.toLowerCase(),
        createdAt: message.createdAt,
      })
    }
  }

  return { messages }
}

/** 命中位置前后各取一段，被截断时补省略号 */
const buildSnippet = (text: string, at: number, length: number) => {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(text.length, at + length + SNIPPET_AFTER)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/** 正文逐条匹配，结果按时间倒序；关键词为空时返回空列表（与官方一致，不展示最近对话） */
export const searchHistory = (index: HistoryIndex, rawQuery: string): HistorySearchHit[] => {
  const query = normalize(rawQuery)
  if (!query) {
    return []
  }

  const needle = query.toLowerCase()
  const hits: HistorySearchHit[] = []
  for (const entry of index.messages) {
    const at = entry.search.indexOf(needle)
    if (at < 0) {
      continue
    }
    hits.push({
      key: `message:${entry.messageId}`,
      sessionId: entry.sessionId,
      title: entry.title,
      role: entry.role,
      createdAt: entry.createdAt,
      snippet: buildSnippet(entry.text, at, query.length),
    })
  }

  return hits.sort((a, b) => b.createdAt - a.createdAt).slice(0, RESULT_LIMIT)
}
