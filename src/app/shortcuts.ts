import { useEffect } from 'react'
import { isModalOpen } from '../components/base/Modal.js'
import {
  closeHistorySearch,
  toggleHistorySearch,
} from '../components/historySearch/historySearchState.js'
import { openSettings } from '../components/settings/settingsDialogState.js'
import {
  cancelSessionCommit,
  cancelSessionHighlight,
  commitSessionHighlight,
  moveSessionHighlight,
  scheduleSessionCommit,
} from '../components/sider/sessionNavigationState.js'
import { closeMobileSider } from '../components/sider/mobileSiderState.js'
import { newChat } from '../services/chat/store.js'

const isArrow = (event: KeyboardEvent) => event.key === 'ArrowUp' || event.key === 'ArrowDown'

/**
 * 全局快捷键，行为与官方网页端对齐：
 * - Ctrl / ⌘ + J：开启新对话
 * - Ctrl / ⌘ + K：搜索历史对话（再按一次收起）
 * - Ctrl / ⌘ + ,：打开设置
 * - Ctrl / ⌘ + ↑ / ↓：切换会话，按住时只移动高亮，松手后才加载选中的会话
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
          cancelSessionHighlight()
          newChat()
          closeMobileSider()
          return
        case 'k':
          event.preventDefault()
          cancelSessionHighlight()
          toggleHistorySearch()
          return
        case ',':
          event.preventDefault()
          closeHistorySearch()
          cancelSessionHighlight()
          openSettings('general')
          return
        case 'arrowup':
        case 'arrowdown':
          event.preventDefault()
          closeHistorySearch()
          // 连续按键（含长按自动重复）只移动高亮，等松手后再加载会话
          cancelSessionCommit()
          moveSessionHighlight(event.key === 'ArrowUp' ? -1 : 1)
          return
        default:
          return
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      // 松开方向键或 Ctrl / ⌘ 都视为一次切换结束；之后的短暂停顿用来合并连按
      if (isArrow(event) || event.key === 'Control' || event.key === 'Meta') {
        scheduleSessionCommit()
      }
    }
    // 切走窗口时可能收不到 keyup，直接把最后的高亮切换掉
    const onWindowBlur = () => commitSessionHighlight()
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])
}
