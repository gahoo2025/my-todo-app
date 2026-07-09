import { useState } from 'react'
import ScheduleFields from './ScheduleFields'
import ToggleRow from './ToggleRow'
import { buildScheduleUpdates } from '../lib/schedule'

export default function TaskForm({ categories, defaultCategory, onAdd, onClose }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(defaultCategory ?? categories[0]?.name ?? '')
  const [dueDate, setDueDate] = useState('')
  const [memo, setMemo] = useState('')
  const [isShopping, setIsShopping] = useState(false)
  const [issueRegistered, setIssueRegistered] = useState(false)
  const [schedule, setSchedule] = useState({
    allDay: false,
    startDate: '', startTime: '', endDate: '', endTime: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onAdd({
      title: title.trim(),
      category,
      due_date: dueDate || null,
      memo: memo || null,
      completed: false,
      is_shopping: isShopping,
      issue_registered: category === '仕事' ? issueRegistered : false,
      ...buildScheduleUpdates(schedule),
    })
    setLoading(false)
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
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">新規タスク</h2>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {loading ? '追加中…' : '追加'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
              rows={2}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="メモ（Markdown / 表に対応）"
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

          {/* フラグ */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <ToggleRow label="買い物リスト" icon="🛒" checked={isShopping} onChange={setIsShopping} />
            {category === '仕事' && (
              <ToggleRow label="課題登録済み" icon="📋" checked={issueRegistered} onChange={setIssueRegistered} />
            )}
          </div>

          <ScheduleFields value={schedule} onChange={setSchedule} />
        </form>
      </div>
    </div>
  )
}
