import { useState } from 'react'

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-30" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-6 max-w-lg mx-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">タスクを編集</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 text-lg">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">タイトル</label>
            <input
              autoFocus
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white text-base transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 text-base text-gray-700"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">期限</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 text-base text-gray-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3.5 text-white rounded-xl font-bold text-base disabled:opacity-50 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {loading ? '保存中...' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  )
}
