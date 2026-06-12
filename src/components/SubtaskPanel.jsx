import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SubtaskPanel({ task, userId }) {
  const [subtasks, setSubtasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setSubtasks(data ?? []); setLoading(false) })
  }, [task.id])

  async function addSubtask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('subtasks')
      .insert([{ task_id: task.id, user_id: userId, title: newTitle.trim(), completed: false }])
      .select().single()
    if (!error) { setSubtasks([...subtasks, data]); setNewTitle('') }
    setAdding(false)
  }

  async function toggleSubtask(id, completed) {
    const { data, error } = await supabase
      .from('subtasks').update({ completed: !completed }).eq('id', id).select().single()
    if (!error) setSubtasks(subtasks.map(s => s.id === id ? data : s))
  }

  async function deleteSubtask(id) {
    const { error } = await supabase.from('subtasks').delete().eq('id', id)
    if (!error) setSubtasks(subtasks.filter(s => s.id !== id))
  }

  const done = subtasks.filter(s => s.completed).length

  return (
    <div className="pt-1">
      {/* 進捗バー */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex-1 h-[4px] bg-[#767680]/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
              style={{ width: `${(done / subtasks.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-[#8E8E93] font-medium tabular-nums flex-shrink-0">
            {done}/{subtasks.length}
          </span>
        </div>
      )}

      {/* 小タスク一覧 */}
      {loading ? (
        <p className="text-[12px] text-[#AEAEB2] py-1">読み込み中…</p>
      ) : (
        <div className="space-y-0.5 mb-2">
          {subtasks.map(s => (
            <div key={s.id} className="flex items-center gap-2.5 py-1 group">
              <button
                onClick={() => toggleSubtask(s.id, s.completed)}
                className={`flex-shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                  s.completed
                    ? 'bg-[#007AFF] border-[#007AFF]'
                    : 'border-[#C7C7CC] hover:border-[#007AFF] active:scale-90'
                }`}
              >
                {s.completed && (
                  <svg className="w-[9px] h-[9px] text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5.2l2.3 2.3 4.7-4.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-[13px] ${s.completed ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'}`}>
                {s.title}
              </span>
              <button
                onClick={() => deleteSubtask(s.id)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[#C7C7CC] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 active:opacity-60 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 追加フォーム */}
      <form onSubmit={addSubtask} className="flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="小タスクを追加…"
          className="flex-1 text-[13px] px-3 py-1.5 rounded-full bg-[#767680]/10 text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#007AFF] text-white active:opacity-70 disabled:opacity-30 transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      </form>
    </div>
  )
}
