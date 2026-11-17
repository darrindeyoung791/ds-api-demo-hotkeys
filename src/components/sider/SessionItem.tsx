import clsx from 'clsx'
import { memo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCheckOutline16,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { renameSession, selectSession } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

/**
 * 会话项：点击打开会话；多选状态下点击切换选中，行尾的勾选框也可以直接开始多选。
 */
export const SessionItem = memo(function SessionItem({
  session,
  active,
  selectionMode,
  selected,
  onToggleSelect,
  onDelete,
}: {
  session: SessionSummary
  active: boolean
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const displayTitle = session.title || t('untitledChat')

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <div
      className={clsx(
        styles.item,
        active && styles.active,
        selected && styles.selected,
        selectionMode && styles.selecting
      )}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect()
          return
        }
        selectSession(session.id)
        closeMobileSider()
      }}
    >
      <div className={styles.title}>{displayTitle}</div>
      <div className={styles.controls} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={t('selectSession')}
          className={clsx(styles.checkbox, selected && styles.checkboxChecked)}
          onClick={onToggleSelect}
        >
          {selected ? <IconCheckOutline16 /> : null}
        </button>
        {selectionMode ? null : (
          <div className={styles.action}>
            <Menu
              options={[
                {
                  key: 'rename',
                  label: t('sessionItemMenuRenameOption'),
                  icon: <IconEditOutline16 />,
                  onSelect: () => setEditing(true),
                },
                {
                  key: 'delete',
                  label: t('delete'),
                  icon: <IconTrashOutline16 />,
                  danger: true,
                  onSelect: onDelete,
                },
              ]}
            >
              {({ toggle }) => (
                <IconButton
                  icon={<IconEllipsisOutline16 />}
                  aria-label={t('more')}
                  onClick={toggle}
                />
              )}
            </Menu>
          </div>
        )}
      </div>
    </div>
  )
})
