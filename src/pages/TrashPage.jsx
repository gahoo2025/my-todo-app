import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORY_STYLES = {
  '仕事':  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400' },
  '個人':  { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400' },
  '買い物':{ bg: 'bg-emerald-50',text: 'text-emerald-600',dot: 'bg-emerald-400' },
  '健康':  { bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-400' },
  'その他':{ bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400' },
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
      .from('tasks').select('*').eq('user_id', user.id)
      .not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    setTasks(data ?? [])
    setLoading(false)
  }

  async function restoreTask(id) {
    const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', id)
    if (!error) setTasks(tasks.filter(t => t.id !== id))
  }

  async function emptyTrash() {
    if (!window.confirm(`ゴミ箱の${tasks.length}件を完全に削除しますか？\nこの操作は元に戻せません。`)) return
    setClearing(true)
    const { error } = await supabase.from('tasks').delete().eq('user_id', user.id).not('deleted_at', 'is', null)
    if (!error) setTasks([])
    setClearing(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gray-700 text-white px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">🗑 ゴミ箱</h1>
              <p className="text-xs text-gray-300">{tasks.length}件</p>
            </div>
          </div>
          {tasks.length > 0 && (
            <button onClick={emptyTrash} disabled={clearing}
              className="text-xs bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors font-medium">
              {clearing ? '削除中...' : 'すべて削除'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-30">🗑</div>
            <p className="text-sm text-gray-400 font-medium">ゴミ箱は空です</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-3 px-1">「復元」で一覧に戻します。「すべて削除」で完全に消去します。</p>
            {tasks.map(task => {
              const cat = CATEGORY_STYLES[task.category] ?? CATEGORY_STYLES['その他']
              return (
                <div key={task.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 line-through truncate">{task.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`}></span>
                        {task.category}
                      </span>
                      <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">
                        {new Date(task.deleted_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}削除
                      </span>
                    </div>
                  </div>
                  <button onClick={() => restoreTask(task.id)}
                    className="flex-shrink-0 text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 px-3 py-1.5 rounded-xl font-semibold transition-colors">
                    復元
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
