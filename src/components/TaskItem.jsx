import { useState } from 'react'
import SubtaskPanel from './SubtaskPanel'

const CATEGORY_STYLES = {
  '仕事':  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400' },
  '個人':  { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400' },
  '買い物':{ bg: 'bg-emerald-50',text: 'text-emerald-600',dot: 'bg-emerald-400' },
  '健康':  { bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-400' },
  'その他':{ bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400' },
}

export default function TaskItem({ task, userId, onToggle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)

  const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date()
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    : null
  const cat = CATEGORY_STYLES[task.category] ?? { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' }

  return (
    <div className={`bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 transition-opacity ${task.completed ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id, task.completed)}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-violet-500 border-violet-500 shadow-sm shadow-violet-200'
              : 'border-gray-200 hover:border-violet-400'
          }`}
        >
          {task.completed && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`}></span>
              {task.category}
            </span>
            {dueLabel && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                isOverdue ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'
              }`}>
                {isOverdue ? '⚠ ' : ''}{dueLabel}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Subtask toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              expanded ? 'bg-violet-100 text-violet-500' : 'text-gray-300 hover:text-violet-400 hover:bg-violet-50'
            }`}
            aria-label="小タスクを表示"
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {!task.completed && (
            <button
              onClick={() => onEdit(task)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtask panel */}
      {expanded && <SubtaskPanel task={task} userId={userId} />}
    </div>
  )
}
