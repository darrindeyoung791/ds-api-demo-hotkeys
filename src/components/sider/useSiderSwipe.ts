import { useEffect } from 'react'
import { isModalOpen } from '../base/Modal.js'
import { useHistorySearch } from '../historySearch/historySearchState.js'
import { useSearchPanel } from '../search/searchPanelState.js'
import { closeMobileSider, openMobileSider, useMobileSider } from './mobileSiderState.js'

/** 从左边缘起手的横向范围：更靠右的横滑留给内容（代码块、表格等），避免抢走它们的滚动 */
const EDGE_WIDTH = 32
/** 抬手时判定为滑动的最小位移，短于此距离视为点击或手指抖动 */
const MIN_DISTANCE = 64
/** 快速轻扫：短时间内的较小位移也生效，贴近原生手势手感 */
const FLICK_DISTANCE = 32
const FLICK_DURATION = 250
/** 首次位移超过该值才锁定方向，过滤按下瞬间的抖动 */
const DIRECTION_SLOP = 10
/** 抬手时水平位移至少是垂直位移的这么多倍，斜向滚动不触发 */
const HORIZONTAL_RATIO = 1.5
/** 锁定方向时垂直位移超过水平位移的该比例即判定为纵向滚动 */
const VERTICAL_RATIO = 1.2

/** 只在小屏竖屏启用：横屏时内容更宽，边缘手势容易和横向滚动冲突 */
const portrait = window.matchMedia('(orientation: portrait)')

/** 有浮层时手势不作数：设置等弹窗、历史对话搜索、搜索结果面板都会盖住或接管屏幕 */
const overlayOpen = () =>
  isModalOpen() || useHistorySearch.getState().open || useSearchPanel.getState().entry !== null

/** 长按选词或选中文字后拖动时不应切换抽屉 */
const hasTextSelection = () => {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed && selection.toString() !== ''
}

const isEditable = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])') !== null

/**
 * 触摸点落在可横向滚动的容器内，且该容器还能朝手势方向继续滚动时，把手势让给容器。
 * 手指向右（deltaX > 0）时内容跟着右移，只有还能往回滚（scrollLeft > 0）才算可滚动。
 */
const scrollsHorizontally = (target: EventTarget | null, deltaX: number) => {
  for (
    let element = target instanceof Element ? target : null;
    element && element !== document.body;
    element = element.parentElement
  ) {
    if (element.scrollWidth <= element.clientWidth) {
      continue
    }
    if (!/auto|scroll/.test(getComputedStyle(element).overflowX)) {
      continue
    }
    const max = element.scrollWidth - element.clientWidth
    if (deltaX > 0 ? element.scrollLeft > 0 : element.scrollLeft < max - 1) {
      return true
    }
  }
  return false
}

const findTouch = (touches: TouchList, identifier: number) => {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index)
    if (touch && touch.identifier === identifier) {
      return touch
    }
  }
  return null
}

type Gesture = {
  identifier: number
  startX: number
  startY: number
  startTime: number
  /** 按下时的抽屉状态：打开还是收起，锁定后不再改判 */
  mode: 'open' | 'close'
  /** 方向锁定结果；abandoned 表示本次手势已被排除（纵向滚动、方向不对、容器可横滑） */
  locked: 'horizontal' | 'abandoned' | null
  target: EventTarget | null
}

/**
 * 移动端竖屏的侧边栏滑动手势：左边缘右滑打开抽屉，抽屉内左滑收起。
 * 手势只在抬手时按位移阈值判定，监听全部 passive，不调用 preventDefault，
 * 以免干扰原生滚动、回弹与双指缩放；斜向滚动、文字选择、可横滑容器和浮层都会让手势作废。
 */
export const useSiderSwipe = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return
    }
    let gesture: Gesture | null = null

    const onTouchStart = (event: TouchEvent) => {
      gesture = null
      if (!portrait.matches || event.touches.length !== 1 || overlayOpen()) {
        return
      }
      const touch = event.touches.item(0)
      if (!touch) {
        return
      }
      const target = event.target
      if (isEditable(target) || hasTextSelection()) {
        return
      }
      const mode = useMobileSider.getState().open ? 'close' : 'open'
      // 收起只认抽屉面板内的起手，遮罩上的滑动留给「点空白关闭」的既有行为
      if (mode === 'open') {
        if (touch.clientX > EDGE_WIDTH) {
          return
        }
      } else if (!(target instanceof Element && target.closest('[data-mobile-sider]'))) {
        return
      }
      gesture = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        mode,
        locked: null,
        target,
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture) {
        return
      }
      // 手势中途落下第二根手指（缩放）时不再当作滑动
      if (event.touches.length > 1) {
        gesture = null
        return
      }
      const touch = findTouch(event.touches, gesture.identifier)
      if (!touch) {
        gesture = null
        return
      }
      if (gesture.locked === 'abandoned') {
        return
      }
      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY
      if (gesture.locked === null) {
        if (Math.abs(deltaX) < DIRECTION_SLOP && Math.abs(deltaY) < DIRECTION_SLOP) {
          return
        }
        if (Math.abs(deltaX) < Math.abs(deltaY) * VERTICAL_RATIO) {
          gesture.locked = 'abandoned'
          return
        }
        // 方向不对的横滑同样放弃：向右滑不能收起，向左滑不能打开
        if (gesture.mode === 'open' ? deltaX <= 0 : deltaX >= 0) {
          gesture.locked = 'abandoned'
          return
        }
        if (scrollsHorizontally(gesture.target, deltaX)) {
          gesture.locked = 'abandoned'
          return
        }
        gesture.locked = 'horizontal'
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      const current = gesture
      gesture = null
      if (!current || current.locked !== 'horizontal') {
        return
      }
      const touch = findTouch(event.changedTouches, current.identifier)
      if (!touch || overlayOpen() || hasTextSelection()) {
        return
      }
      const deltaX = touch.clientX - current.startX
      const deltaY = touch.clientY - current.startY
      if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_RATIO) {
        return
      }
      if (current.mode === 'open' ? deltaX <= 0 : deltaX >= 0) {
        return
      }
      const distance = Math.abs(deltaX)
      const elapsed = Date.now() - current.startTime
      const flicked = distance >= FLICK_DISTANCE && elapsed <= FLICK_DURATION
      if (distance < MIN_DISTANCE && !flicked) {
        return
      }
      // 手势期间抽屉可能已被其它入口改过状态，按当前状态再确认一次
      const open = useMobileSider.getState().open
      if (current.mode === 'open' ? !open : open) {
        if (current.mode === 'open') {
          openMobileSider()
        } else {
          closeMobileSider()
        }
      }
    }

    const onTouchCancel = () => {
      gesture = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled])
}
