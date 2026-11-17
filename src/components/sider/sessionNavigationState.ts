import { create } from 'zustand'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import { closeMobileSider } from './mobileSiderState.js'

/**
 * 快捷键切换会话时的待定高亮。
 * 按住 Ctrl/⌘ + ↑/↓ 只移动高亮，松手后稍等再真正加载会话，
 * 这样连续快速切换时不会每次都读取消息、重绘对话。
 */
type SessionNavigationState = { pendingId: string | null }

export const useSessionNavigation = create<SessionNavigationState>(() => ({ pendingId: null }))

/** 松手后等待的时间：只用来合并同一手势内的连按，尽量短，避免切换有明显延迟 */
const COMMIT_DELAY = 60
let commitTimer: ReturnType<typeof setTimeout> | undefined

const clearTimer = () => {
  if (commitTimer !== undefined) {
    clearTimeout(commitTimer)
    commitTimer = undefined
  }
}

const setPending = (pendingId: string | null) => useSessionNavigation.setState({ pendingId })

/** 取消已排队的提交，保留当前高亮（继续按键时调用） */
export const cancelSessionCommit = clearTimer

/** 移动高亮；新对话视作列表顶端，不能从最上面的会话向上切回新对话 */
export const moveSessionHighlight = (direction: -1 | 1) => {
  const { sessions, activeId } = useChatStore.getState()
  const current = useSessionNavigation.getState().pendingId ?? activeId
  if (current === null) {
    if (direction === 1 && sessions[0]) {
      setPending(sessions[0].id)
    }
    return
  }
  const index = sessions.findIndex((session) => session.id === current)
  if (index === -1) {
    return
  }
  const next = sessions[index + direction]
  if (next) {
    setPending(next.id)
  }
}

/** 真正切换到最后高亮的会话 */
export const commitSessionHighlight = () => {
  clearTimer()
  const { pendingId } = useSessionNavigation.getState()
  if (!pendingId) {
    return
  }
  setPending(null)
  selectSession(pendingId)
  closeMobileSider()
}

/** 松手后稍等再提交；连续按键会不断重置计时 */
export const scheduleSessionCommit = () => {
  clearTimer()
  if (!useSessionNavigation.getState().pendingId) {
    return
  }
  commitTimer = setTimeout(commitSessionHighlight, COMMIT_DELAY)
}

/** 放弃待定高亮（改为由别处切换会话时调用） */
export const cancelSessionHighlight = () => {
  clearTimer()
  setPending(null)
}

// 点击会话、搜索结果、新建对话都会改变 activeId：待定高亮随之失效
useChatStore.subscribe((state, previous) => {
  if (state.activeId !== previous.activeId) {
    cancelSessionHighlight()
  }
})
