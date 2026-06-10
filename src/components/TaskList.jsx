import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskItem from './TaskItem'

export default function TaskList({ tasks, userId, onToggle, onDelete, onEdit, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  if (tasks.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4 opacity-30">📝</div>
        <p className="text-sm font-medium text-gray-400">タスクがありません</p>
        <p className="text-xs mt-1 text-gray-300">右下の＋ボタンで追加しましょう</p>
      </div>
    )
  }

  const pending = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(active.id, over.id)
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pending.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {pending.map(task => (
            <TaskItem key={task.id} task={task} userId={userId} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </SortableContext>
      </DndContext>

      {completed.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-3 pb-1">
            <div className="flex-1 h-px bg-gray-100" />
            <p className="text-xs font-medium text-gray-300">完了済み {completed.length}件</p>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {completed.map(task => (
            <TaskItem key={task.id} task={task} userId={userId} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </>
      )}
    </div>
  )
}
