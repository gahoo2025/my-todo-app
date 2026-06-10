import TaskItem from './TaskItem'

export default function TaskList({ tasks, onToggle, onDelete, onEdit }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-20 text-gray-300">
        <div className="text-6xl mb-4 opacity-50">📝</div>
        <p className="text-sm font-medium text-gray-400">タスクがありません</p>
        <p className="text-xs mt-1 text-gray-300">右下の＋ボタンで追加しましょう</p>
      </div>
    )
  }

  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="space-y-2">
      {pending.map(task => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
      ))}
      {completed.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-3 pb-1">
            <div className="flex-1 h-px bg-gray-100" />
            <p className="text-xs font-medium text-gray-300">完了済み {completed.length}件</p>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {completed.map(task => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </>
      )}
    </div>
  )
}
