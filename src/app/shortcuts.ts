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

/** 长按方向键时自带的重复节奏：首次停顿后按固定间隔移动，不受系统按键重复延迟影响 */
const REPEAT_DELAY = 320
const REPEAT_INTERVAL = 60

/**
 * 全局快捷键，行为与官方网页端对齐：
 * - Ctrl / ⌘ + J：开启新对话
 * - Ctrl / ⌘ + K：搜索历史对话（再按一次收起）
 * - Ctrl / ⌘ + ,：打开设置
 * - Ctrl / ⌘ + ↑ / ↓：切换会话；按住时高亮持续移动、列表跟随滚动，松手后才加载会话
 * 带 Shift / Alt 的组合留给浏览器，弹窗打开时不响应，避免在弹窗之上再叠一层界面。
 */
export const useShortcuts = () => {
  useEffect(() => {
    const heldArrows = new Set<string>()
    let repeatDelay: ReturnType<typeof setTimeout> | undefined
    let repeatTimer: ReturnType<typeof setInterval> | undefined

    const stopRepeat = () => {
      clearTimeout(repeatDelay)
      clearInterval(repeatTimer)
      repeatDelay = undefined
      repeatTimer = undefined
    }

    /** 长按后按固定间隔继续移动，避免依赖系统按键重复的首次延迟 */
    const startRepeat = (direction: -1 | 1) => {
      stopRepeat()
      repeatDelay = setTimeout(() => {
        repeatTimer = setInterval(() => moveSessionHighlight(direction), REPEAT_INTERVAL)
      }, REPEAT_DELAY)
    }

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
        case 'arrowdown': {
          event.preventDefault()
          closeHistorySearch()
          // 系统按键重复只作为回退：已经有自己的重复节奏时忽略，避免一次按键移动两格；
          // 非 repeat 的重复 keydown 说明上一次 keyup 丢了，按新的按下处理。
          if (heldArrows.has(event.key) && event.repeat) {
            return
          }
          heldArrows.add(event.key)
          cancelSessionCommit()
          moveSessionHighlight(event.key === 'ArrowUp' ? -1 : 1)
          startRepeat(event.key === 'ArrowUp' ? -1 : 1)
          return
        }
        default:
          return
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!heldArrows.delete(event.key)) {
        return
      }
      if (heldArrows.size === 0) {
        stopRepeat()
        // 松手后稍等再加载，合并连按；等待时间尽量短，避免切换有明显延迟
        scheduleSessionCommit()
      }
    }
    // 切走窗口时可能收不到 keyup：停止重复，并把最后的高亮切换掉
    const onWindowBlur = () => {
      heldArrows.clear()
      stopRepeat()
      commitSessionHighlight()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      stopRepeat()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [])
}
