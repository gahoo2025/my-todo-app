import { useState } from 'react'

const CATEGORY_COLORS = {
  '仕事': 'bg-blue-100 text-blue-700',
  '個人': 'bg-purple-100 text-purple-700',
  '買い物': 'bg-green-100 text-green-700',
  '健康': 'bg-red-100 text-red-700',
  'その他': 'bg-gray-100 text-gray-600',
}

const CATEGORIES = ['仕事', '個人', '買い物', '健康', 'その他']

export default function EditTaskModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState(task.category)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onSave(task.id, { title: title.trim(), category, due_date: dueDate || null })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-30" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-6 max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">タスクを編集</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
            <input
              autoFocus
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base bg-white"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base disabled:opacity-50 active:bg-indigo-700 transition-colors"
          >
            {loading ? '保存中...' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  )
}
