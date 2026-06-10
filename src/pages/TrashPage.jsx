import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORY_COLORS = {
  '仕事': 'bg-blue-100 text-blue-700',
  '個人': 'bg-purple-100 text-purple-700',
  '買い物': 'bg-green-100 text-green-700',
  '健康': 'bg-red-100 text-red-700',
  'その他': 'bg-gray-100 text-gray-600',
}

export default function TrashPage({ onBack }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchTrash()
  }, [user?.id])

  async function fetchTrash() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setTasks(data ?? [])
    setLoading(false)
  }

  async function restoreTask(id) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single()
    if (!error) setTasks(tasks.filter(t => t.id !== id))
  }

  async function emptyTrash() {
    if (!window.confirm(`ゴミ箱の${tasks.length}件を完全に削除しますか？この操作は元に戻せません。`)) return
    setClearing(true)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
    if (!error) setTasks([])
    setClearing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-700 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-white text-xl leading-none p-1">←</button>
            <div>
              <h1 className="text-lg font-bold">🗑 ゴミ箱</h1>
              <p className="text-xs text-gray-300">{tasks.length}件</p>
            </div>
          </div>
          {tasks.length > 0 && (
            <button
              onClick={emptyTrash}
              disabled={clearing}
              className="text-xs bg-red-500 px-3 py-1.5 rounded-lg active:bg-red-600 disabled:opacity-50"
            >
              {clearing ? '削除中...' : 'ゴミ箱を空にする'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🗑</div>
            <p className="text-sm">ゴミ箱は空です</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3">ゴミ箱内のタスクは復元またはゴミ箱を空にすることで完全削除できます。</p>
            {tasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 opacity-70">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 line-through truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS['その他']}`}>
                      {task.category}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-gray-400">
                        📅 {new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <span className="text-xs text-gray-300">
                      {new Date(task.deleted_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}削除
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => restoreTask(task.id)}
                  className="flex-shrink-0 text-xs bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg active:bg-indigo-200 font-medium"
                >
                  復元
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
