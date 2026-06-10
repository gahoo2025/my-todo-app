import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MemoSection({ task }) {
  const [memo, setMemo] = useState(task.memo ?? '')
  const [editing, setEditing] = useState(!task.memo)
  const [saving, setSaving] = useState(false)

  async function saveMemo() {
    setSaving(true)
    await supabase.from('tasks').update({ memo: memo || null }).eq('id', task.id)
    task.memo = memo || null
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">メモ</span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-violet-500 hover:text-violet-600 font-medium"
          >
            編集
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={3}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="メモを入力..."
            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white resize-none leading-relaxed"
          />
          <div className="flex gap-2">
            <button
              onClick={saveMemo}
              disabled={saving}
              className="flex-1 py-1.5 text-xs text-white rounded-lg font-semibold disabled:opacity-50 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => { setMemo(task.memo ?? ''); setEditing(false) }}
              className="px-4 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg font-semibold"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : memo ? (
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{memo}</p>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-300 hover:text-violet-400 transition-colors"
        >
          ＋ メモを追加
        </button>
      )}
    </div>
  )
}
