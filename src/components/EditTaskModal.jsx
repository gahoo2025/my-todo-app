import { useState } from 'react'
import ScheduleFields from './ScheduleFields'
import SubtaskPanel from './SubtaskPanel'
import { buildScheduleUpdates, toLocalDateInput, toLocalDateTimeInput } from '../lib/schedule'

export default function EditTaskModal({ task, categories, userId, onSave, onClose, onSwitchToList }) {
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState(task.category)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [memo, setMemo] = useState(task.memo ?? '')
  const [schedule, setSchedule] = useState({
    allDay: task.all_day ?? false,
    startDate: toLocalDateInput(task.start_at),
    startTime: toLocalDateTimeInput(task.start_at),
    endDate: toLocalDateInput(task.end_at),
    endTime: toLocalDateTimeInput(task.end_at),
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onSave(task.id, {
      title: title.trim(),
      category,
      due_date: dueDate || null,
      memo: memo || null,
      ...buildScheduleUpdates(schedule),
    })
    setLoading(false)
  }

  async function toggleComplete() {
    setLoading(true)
    const nextCompleted = !task.completed
    await onSave(task.id, {
      title: title.trim() || task.title,
      category,
      due_date: dueDate || null,
      memo: memo || null,
      ...buildScheduleUpdates(schedule),
      completed: nextCompleted,
    })
    setLoading(false)
    // 未完了に戻した場合、日付がないタスクはカレンダーに表示されないのでリストへ切り替える
    if (!nextCompleted) {
      const hasDates = !!(dueDate || schedule.startDate || schedule.endDate)
      if (!hasDates && onSwitchToList) onSwitchToList()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-30"
      onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* シートヘッダー */}
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">タスクを編集</h2>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {loading ? '保存中…' : '保存'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 完了ボタン */}
          <button
            type="button"
            onClick={toggleComplete}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-[15px] font-semibold active:opacity-70 disabled:opacity-40 transition-opacity ${
              task.completed
                ? 'bg-[#767680]/15 text-[#8E8E93]'
                : 'bg-[#34C759] text-white shadow-[0_2px_8px_rgba(52,199,89,0.3)]'
            }`}
          >
            {task.completed ? (
              <>
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" />
                </svg>
                未完了に戻す
              </>
            ) : (
              <>
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                タスクを完了にする
              </>
            )}
          </button>

          {/* タイトル・メモのグループ */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <input
              autoFocus
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              placeholder="タイトル"
            />
            <textarea
              rows={3}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="メモ"
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* カテゴリ・期限のグループ */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">カテゴリ</span>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              >
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">期限</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          <ScheduleFields value={schedule} onChange={setSchedule} />
        </form>

        {/* 小タスク（form の外に置く：内部に追加フォームを持つため入れ子にしない） */}
        <div className="px-4 pb-4">
          <div className="ios-card overflow-hidden px-4 py-3">
            <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">小タスク</p>
            <SubtaskPanel task={task} userId={userId} />
          </div>
        </div>
      </div>
    </div>
  )
}
