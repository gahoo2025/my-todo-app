const CATEGORY_COLORS = {
  '仕事': 'bg-blue-100 text-blue-700',
  '個人': 'bg-purple-100 text-purple-700',
  '買い物': 'bg-green-100 text-green-700',
  '健康': 'bg-red-100 text-red-700',
  'その他': 'bg-gray-100 text-gray-600',
}

export default function TaskItem({ task, onToggle, onDelete }) {
  const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date()
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    : null

  return (
    <div className={`bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 transition-opacity ${task.completed ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onToggle(task.id, task.completed)}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.completed
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-gray-300 hover:border-indigo-400'
        }`}
        aria-label={task.completed ? '未完了に戻す' : '完了にする'}
      >
        {task.completed && <span className="text-white text-xs">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS['その他']}`}>
            {task.category}
          </span>
          {dueLabel && (
            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {isOverdue ? '⚠️ ' : '📅 '}{dueLabel}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors p-1"
        aria-label="削除"
      >
        🗑
      </button>
    </div>
  )
}
