import TaskItem from './TaskItem'

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">📝</div>
        <p className="text-sm">タスクがありません</p>
        <p className="text-xs mt-1">右下の＋ボタンで追加しましょう</p>
      </div>
    )
  }

  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="space-y-2">
      {pending.map(task => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
      {completed.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 pt-2 pb-1">完了済み ({completed.length})</p>
          {completed.map(task => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </>
      )}
    </div>
  )
}
