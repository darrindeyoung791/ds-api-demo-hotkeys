import clsx from 'clsx'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import {
  collectHistoryIndex,
  searchHistory,
  type HistoryIndex,
  type HistorySearchHit,
} from '../../services/chat/search.js'
import { selectSession } from '../../services/chat/store.js'
import { useSettings } from '../../services/settings.js'
import {
  IconChatOutline16,
  IconCloseOutline16,
  IconSearchOutline16,
  IconUserOutline16,
} from '../base/icons.js'
import { IconButton } from '../base/IconButton.js'
import { closeMobileSider } from '../sider/mobileSiderState.js'
import { closeHistorySearch, useHistorySearch } from './historySearchState.js'
import styles from './HistorySearch.module.css'

/** 历史对话搜索：Ctrl+K 打开，输入关键词检索全部会话的提问与回答 */
export const HistorySearch = () => {
  const open = useHistorySearch((state) => state.open)
  return open ? <HistorySearchPanel /> : null
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 高亮关键词：按捕获组拆分文本，奇数位即命中片段 */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const parts = useMemo(() => {
    const keyword = query.trim()
    if (!keyword) {
      return [text]
    }
    return text.split(new RegExp(`(${escapeRegExp(keyword)})`, 'gi'))
  }, [text, query])
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className={styles.match}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

/** 输入停顿后再搜索，与官方默认的 200ms 一致，避免每个按键都重排一次结果 */
const SEARCH_DEBOUNCE_MS = 200

const HistorySearchPanel = () => {
  const t = useTranslate()
  const locale = useSettings((state) => state.locale)
  const [index, setIndex] = useState<HistoryIndex | null>(null)
  /** 输入框里的实时内容；query 是防抖后真正用于搜索的关键词 */
  const [value, setValue] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const composingRef = useRef(false)

  // 每次打开读取一次全部会话；关闭后丢弃，下次打开能包含期间新增的对话
  useEffect(() => {
    let cancelled = false
    collectHistoryIndex()
      .then((value) => {
        if (!cancelled) {
          setIndex(value)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIndex({ messages: [], sessions: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    return () => clearTimeout(timerRef.current)
  }, [])

  const scheduleQuery = (text: string) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setQuery(text), SEARCH_DEBOUNCE_MS)
  }

  const hits = useMemo(() => (index ? searchHistory(index, query) : []), [index, query])

  // 换关键词后回到第一条
  useEffect(() => {
    setActive(0)
  }, [query])

  // 键盘移动选中项时保持在可视区域
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [hits, active])

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale]
  )
  const fullDateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale]
  )
  const thisYear = new Date().getFullYear()
  const formatDate = (time: number) => {
    const date = new Date(time)
    return (date.getFullYear() === thisYear ? dateFormat : fullDateFormat).format(date)
  }

  const openHit = (hit: HistorySearchHit) => {
    selectSession(hit.sessionId)
    closeMobileSider()
    closeHistorySearch()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Ctrl / ⌘ 组合交给全局快捷键（切换会话、开关设置），浮层只处理单独按键
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) {
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeHistorySearch()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) {
        return
      }
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + delta + hits.length) % hits.length)
      return
    }
    if (event.key === 'Enter') {
      // 防抖未到就回车时，用输入框里的最新内容重新匹配，避免选中上一次关键词的结果
      const keyword = value
      const results = index ? searchHistory(index, keyword) : hits
      if (keyword !== query) {
        clearTimeout(timerRef.current)
        setQuery(keyword)
      }
      const hit = results[active] ?? results[0]
      if (hit) {
        event.preventDefault()
        openHit(hit)
      }
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && closeHistorySearch()}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('historySearchTitle')}
        onKeyDown={onKeyDown}
      >
        <div className={styles.header}>
          <span className={styles.searchIcon}>
            <IconSearchOutline16 />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            value={value}
            placeholder={t('historySearchPlaceholder')}
            aria-label={t('historySearchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              const text = event.target.value
              setValue(text)
              // 输入法组词期间先不搜索，等 compositionend 提交，避免用拼音匹配正文
              if (!composingRef.current) {
                scheduleQuery(text)
              }
            }}
            onCompositionStart={() => {
              composingRef.current = true
            }}
            onCompositionEnd={(event) => {
              composingRef.current = false
              const text = event.currentTarget.value
              setValue(text)
              scheduleQuery(text)
            }}
          />
          <IconButton
            icon={<IconCloseOutline16 />}
            aria-label={t('close')}
            onClick={closeHistorySearch}
          />
        </div>
        <div
          ref={listRef}
          className={styles.list}
          role="listbox"
          aria-label={t('historySearchTitle')}
        >
          {index === null ? (
            <div className={styles.empty}>{t('historySearchLoading')}</div>
          ) : hits.length === 0 ? (
            <div className={styles.empty}>
              {query.trim() ? t('historySearchEmpty') : t('historySearchNoSessions')}
            </div>
          ) : (
            hits.map((hit, position) => (
              <button
                key={hit.key}
                type="button"
                role="option"
                aria-selected={position === active}
                data-active={position === active}
                className={clsx(styles.item, position === active && styles.itemActive)}
                onMouseMove={() => setActive(position)}
                onClick={() => openHit(hit)}
              >
                <span className={styles.itemIcon}>
                  {hit.role === 'assistant' ? <IconChatOutline16 /> : <IconUserOutline16 />}
                </span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTop}>
                    <span className={styles.itemTitle}>
                      <Highlight text={hit.title || t('untitledChat')} query={query} />
                    </span>
                    <span className={styles.itemDate}>{formatDate(hit.createdAt)}</span>
                  </span>
                  <span className={styles.itemSnippet}>
                    <Highlight text={hit.snippet} query={query} />
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
