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
      <div className="text-center py-24">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
          <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[#8E8E93]">タスクがありません</p>
        <p className="text-[13px] mt-1 text-[#AEAEB2]">＋ボタンから追加しましょう</p>
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
    <div className="space-y-6">
      {/* 未完了グループ */}
      {pending.length > 0 && (
        <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pending.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {pending.map(task => (
                <TaskItem key={task.id} task={task} userId={userId} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* 完了済みグループ */}
      {completed.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">
            完了済み · {completed.length}件
          </p>
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            {completed.map(task => (
              <TaskItem key={task.id} task={task} userId={userId} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
