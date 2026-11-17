import { getVisibleMessages } from './branches.js'
import * as db from './db.js'
import { getReplyText } from './reply.js'
import { useChatStore } from './store.js'
import type { Message, Session } from './types.js'

/**
 * 历史对话搜索索引。文本在建立索引时折叠空白，摘要窗口与命中判断都基于同一份字符串；
 * 索引只在打开搜索浮层时构建一次，输入时只在内存中匹配。
 */

export type HistoryMessageEntry = {
  messageId: string
  sessionId: string
  title: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
}

/** 会话级记录：空搜索时的「最近对话」，以及只命中标题时的结果 */
export type HistorySessionEntry = {
  sessionId: string
  title: string
  /** 最近一条提问的正文；没有提问时为空串 */
  preview: string
  updatedAt: number
}

export type HistoryIndex = {
  messages: HistoryMessageEntry[]
  sessions: HistorySessionEntry[]
}

export type HistorySearchHit = {
  /** 列表 key：消息命中按消息去重，标题命中按会话去重 */
  key: string
  sessionId: string
  title: string
  role: 'user' | 'assistant'
  createdAt: number
  snippet: string
}

/** 结果条数上限，避免长历史一次渲染过多行 */
const RESULT_LIMIT = 50
/** 空搜索时展示的最近对话数 */
const RECENT_LIMIT = 20
/** 摘要窗口：命中位置前后保留的字符数 */
const SNIPPET_BEFORE = 24
const SNIPPET_AFTER = 96

/** 折叠换行与连续空白：结果行是单行文本，命中位置也要与展示文本一致 */
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

const messageText = (message: Message) =>
  normalize(message.role === 'user' ? message.content : getReplyText(message))

const sessionEntry = (session: HistorySessionEntry): HistorySearchHit => ({
  key: `session:${session.sessionId}`,
  sessionId: session.sessionId,
  title: session.title,
  role: 'user',
  createdAt: session.updatedAt,
  snippet: session.preview,
})

/**
 * 读取全部会话的正文构建索引：已打开的会话用内存中的最新版本，其余逐条从 IndexedDB 读取。
 * 单个会话读取失败时跳过，不影响其他会话的结果。
 */
export const collectHistoryIndex = async (): Promise<HistoryIndex> => {
  const { sessions, sessionCache } = useChatStore.getState()
  const messages: HistoryMessageEntry[] = []
  const entries: HistorySessionEntry[] = []

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

    let preview = ''
    for (const message of getVisibleMessages(session)) {
      const text = messageText(message)
      if (message.role === 'user' && !preview) {
        preview = text
      }
      if (!text) {
        continue
      }
      messages.push({
        messageId: message.id,
        sessionId: summary.id,
        title: summary.title,
        role: message.role,
        text,
        createdAt: message.createdAt,
      })
    }
    entries.push({
      sessionId: summary.id,
      title: summary.title,
      preview,
      updatedAt: summary.updatedAt,
    })
  }

  return { messages, sessions: entries }
}

/** 命中位置前后各取一段，被截断时补省略号 */
const buildSnippet = (text: string, at: number, length: number) => {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(text.length, at + length + SNIPPET_AFTER)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/** 正文逐条匹配；正文没命中的会话再按标题匹配。结果按时间倒序。 */
export const searchHistory = (index: HistoryIndex, rawQuery: string): HistorySearchHit[] => {
  const query = normalize(rawQuery)
  if (!query) {
    return index.sessions.slice(0, RECENT_LIMIT).map(sessionEntry)
  }

  const needle = query.toLowerCase()
  const hits: HistorySearchHit[] = []
  const matched = new Set<string>()
  for (const entry of index.messages) {
    const at = entry.text.toLowerCase().indexOf(needle)
    if (at < 0) {
      continue
    }
    matched.add(entry.sessionId)
    hits.push({
      key: `message:${entry.messageId}`,
      sessionId: entry.sessionId,
      title: entry.title,
      role: entry.role,
      createdAt: entry.createdAt,
      snippet: buildSnippet(entry.text, at, query.length),
    })
  }

  for (const session of index.sessions) {
    if (matched.has(session.sessionId) || !session.title.toLowerCase().includes(needle)) {
      continue
    }
    hits.push(sessionEntry(session))
  }

  return hits.sort((a, b) => b.createdAt - a.createdAt).slice(0, RESULT_LIMIT)
}
