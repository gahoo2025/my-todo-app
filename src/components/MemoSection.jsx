import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from './Markdown'

export default function MemoSection({ task }) {
  const [memo, setMemo] = useState(task.memo ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function saveMemo() {
    setSaving(true)
    await supabase.from('tasks').update({ memo: memo || null }).eq('id', task.id)
    task.memo = memo || null
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="pt-1 pb-2">
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={3}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="メモを入力…"
            className="w-full text-[13px] px-3 py-2 rounded-[10px] bg-[#767680]/10 text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 resize-none leading-relaxed"
          />
          <div className="flex gap-2">
            <button
              onClick={saveMemo}
              disabled={saving}
              className="px-4 py-1.5 text-[13px] font-semibold text-white bg-[#007AFF] rounded-full active:opacity-70 disabled:opacity-40 transition-opacity"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              onClick={() => { setMemo(task.memo ?? ''); setEditing(false) }}
              className="px-4 py-1.5 text-[13px] font-medium text-[#8E8E93] bg-[#767680]/10 rounded-full active:opacity-70 transition-opacity"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : task.memo ? (
        <div onClick={() => setEditing(true)} className="text-left w-full cursor-pointer">
          <Markdown>{task.memo}</Markdown>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-[13px] text-[#AEAEB2] hover:text-[#007AFF] transition-colors"
        >
          ＋ メモを追加
        </button>
      )}
    </div>
  )
}
