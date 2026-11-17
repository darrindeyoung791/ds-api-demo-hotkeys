import { useEffect } from 'react'
import { isModalOpen } from '../components/base/Modal.js'
import {
  closeHistorySearch,
  toggleHistorySearch,
} from '../components/historySearch/historySearchState.js'
import { openSettings } from '../components/settings/settingsDialogState.js'
import { closeMobileSider } from '../components/sider/mobileSiderState.js'
import { newChat, selectSession, useChatStore } from '../services/chat/store.js'

/**
 * 切换上一条 / 下一条会话。列表按更新时间倒序，新对话视作最顶端：
 * 新对话只能向下进入第一条会话，最上面的会话也不能向上切回新对话。
 */
const switchSession = (direction: -1 | 1) => {
  const { sessions, activeId } = useChatStore.getState()
  if (activeId === null) {
    if (direction === 1 && sessions[0]) {
      selectSession(sessions[0].id)
      closeMobileSider()
    }
    return
  }
  const index = sessions.findIndex((session) => session.id === activeId)
  if (index === -1) {
    return
  }
  const next = sessions[index + direction]
  if (next) {
    selectSession(next.id)
    closeMobileSider()
  }
}

/**
 * 全局快捷键，行为与官方网页端对齐：
 * - Ctrl / ⌘ + J：开启新对话
 * - Ctrl / ⌘ + K：搜索历史对话（再按一次收起）
 * - Ctrl / ⌘ + ,：打开设置
 * - Ctrl / ⌘ + ↑ / ↓：切换会话
 * 带 Shift / Alt 的组合留给浏览器，弹窗打开时不响应，避免在弹窗之上再叠一层界面。
 */
export const useShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.shiftKey) {
        return
      }
      if (!event.ctrlKey && !event.metaKey) {
        return
      }
      if (isModalOpen()) {
        return
      }
      switch (event.key.toLowerCase()) {
        case 'j':
          event.preventDefault()
          closeHistorySearch()
          newChat()
          closeMobileSider()
          return
        case 'k':
          event.preventDefault()
          toggleHistorySearch()
          return
        case ',':
          event.preventDefault()
          closeHistorySearch()
          openSettings('general')
          return
        case 'arrowup':
        case 'arrowdown':
          event.preventDefault()
          closeHistorySearch()
          switchSession(event.key === 'ArrowUp' ? -1 : 1)
          return
        default:
          return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
