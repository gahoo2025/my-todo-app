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
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-400 rounded-full transition-all"
              style={{ width: `${(done / subtasks.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">{done}/{subtasks.length}</span>
        </div>
      )}

      {/* Subtask list */}
      {loading ? (
        <p className="text-xs text-gray-300 py-1">読み込み中...</p>
      ) : (
        <div className="space-y-1 mb-2">
          {subtasks.map(s => (
            <div key={s.id} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleSubtask(s.id, s.completed)}
                className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  s.completed ? 'bg-violet-400 border-violet-400' : 'border-gray-200 hover:border-violet-300'
                }`}
              >
                {s.completed && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-xs ${s.completed ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                {s.title}
              </span>
              <button
                onClick={() => deleteSubtask(s.id)}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-400 transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add subtask */}
      <form onSubmit={addSubtask} className="flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="小タスクを追加..."
          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:bg-white"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-violet-100 text-violet-500 hover:bg-violet-200 disabled:opacity-40 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </form>
    </div>
  )
}
