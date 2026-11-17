import { create } from 'zustand'

/** 历史对话搜索浮层：Ctrl+K 打开，再按一次或选中结果后关闭 */
type HistorySearchState = { open: boolean }

export const useHistorySearch = create<HistorySearchState>(() => ({ open: false }))

export const openHistorySearch = () => useHistorySearch.setState({ open: true })

export const closeHistorySearch = () => useHistorySearch.setState({ open: false })

export const toggleHistorySearch = () =>
  useHistorySearch.setState((state) => ({ open: !state.open }))
