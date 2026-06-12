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

export default function HistoryPage({ onBack }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTasks(data ?? []); setLoading(false) })
  }, [user?.id])

  const grouped = tasks.reduce((acc, task) => {
    const date = new Date(task.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(task)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-4 sticky top-0 z-10"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="max-w-lg md:max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold">完了履歴</h1>
            <p className="text-xs text-white/70">{tasks.length}件完了</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-30">🎉</div>
            <p className="text-sm text-gray-400 font-medium">完了したタスクがありません</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayTasks]) => (
            <div key={date} className="mb-6">
              <p className="text-xs font-semibold text-gray-400 mb-2 px-1">{date}</p>
              <div className="space-y-2">
                {dayTasks.map(task => {
                  const cat = CATEGORY_STYLES[task.category] ?? CATEGORY_STYLES['その他']
                  return (
                    <div key={task.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-3 opacity-70">
                      <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-violet-500" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-400 line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cat.bg} ${cat.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`}></span>
                            {task.category}
                          </span>
                          {task.due_date && (
                            <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">
                              {new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
