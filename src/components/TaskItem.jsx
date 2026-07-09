import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SubtaskPanel from './SubtaskPanel'
import MemoSection from './MemoSection'
import { formatSchedule } from '../lib/schedule'

const CATEGORY_TINTS = {
  '仕事':  'text-[#007AFF]',
  '個人':  'text-[#AF52DE]',
  '買い物': 'text-[#34C759]',
  '健康':  'text-[#FF3B30]',
  'その他': 'text-[#8E8E93]',
}

export default function TaskItem({ task, userId, onToggle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: task.completed })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date()
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
    : null
  const scheduleLabel = formatSchedule(task)
  const isOngoing = !task.completed && task.start_at && task.end_at
    && new Date(task.start_at) <= new Date() && new Date() <= new Date(task.end_at)
  const tint = CATEGORY_TINTS[task.category] ?? 'text-[#8E8E93]'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white transition-shadow duration-200 ${
        isDragging ? 'shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-[14px] relative' : ''
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* ドラッグハンドル */}
        {!task.completed && (
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 text-[#D1D1D6] hover:text-[#AEAEB2] cursor-grab active:cursor-grabbing touch-none -ml-1.5 p-1"
            aria-label="並び替え"
          >
            <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
              <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
              <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
            </svg>
          </button>
        )}

        {/* チェックボックス（iOSリマインダー風） */}
        <button
          onClick={() => onToggle(task.id, task.completed)}
          className={`flex-shrink-0 w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
            task.completed
              ? 'bg-[#007AFF] border-[#007AFF]'
              : 'border-[#C7C7CC] hover:border-[#007AFF] active:scale-90'
          }`}
          aria-label={task.completed ? '未完了に戻す' : '完了にする'}
        >
          {task.completed && (
            <svg className="w-[11px] h-[11px] text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6.2l2.8 2.8L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* 本文 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left"
        >
          <p className={`text-[15px] leading-snug truncate ${
            task.completed ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'
          }`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.is_shopping && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[#34C759]/15 text-[#248A3D]">
                🛒 買い物
              </span>
            )}
            {task.issue_registered && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[#007AFF]/12 text-[#007AFF]">
                📋 登録済
              </span>
            )}
            <span className={`text-[12px] font-medium ${tint}`}>{task.category}</span>
            {dueLabel && (
              <span className={`text-[12px] ${isOverdue ? 'text-[#FF3B30] font-medium' : 'text-[#8E8E93]'}`}>
                期限 {dueLabel}{isOverdue ? ' ⚠' : ''}
              </span>
            )}
            {scheduleLabel && (
              <span className={`text-[12px] ${isOngoing ? 'text-[#FF9500] font-medium' : 'text-[#8E8E93]'}`}>
                {isOngoing ? '▶ ' : ''}{scheduleLabel}
              </span>
            )}
            {(task.memo) && (
              <svg className="w-3 h-3 text-[#C7C7CC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
          </div>
        </button>

        {/* アクション */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="ios-icon-btn"
            aria-label="編集"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="ios-icon-btn hover:text-[#FF3B30]"
            aria-label="削除"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ios-icon-btn -mr-1.5"
            aria-label="詳細"
          >
            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 展開エリア */}
      {expanded && (
        <div className="px-4 pb-3 pl-[52px]">
          <MemoSection task={task} />
          <SubtaskPanel task={task} userId={userId} />
        </div>
      )}
    </div>
  )
}
