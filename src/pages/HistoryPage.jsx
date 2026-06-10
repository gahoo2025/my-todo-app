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
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTasks(data ?? [])
        setLoading(false)
      })
  }, [user?.id])

  const grouped = tasks.reduce((acc, task) => {
    const date = new Date(task.created_at).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(task)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={onBack} className="text-white text-xl leading-none p-1">←</button>
          <div>
            <h1 className="text-lg font-bold">完了履歴</h1>
            <p className="text-xs text-indigo-200">{tasks.length}件のタスクを完了</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-sm">完了したタスクがありません</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayTasks]) => (
            <div key={date} className="mb-6">
              <p className="text-xs font-semibold text-gray-400 mb-2">{date}</p>
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-xl px-4 py-3 shadow-sm opacity-80">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-500 text-sm">✓</span>
                      <p className="text-sm text-gray-500 line-through flex-1 truncate">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS['その他']}`}>
                        {task.category}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400">
                          📅 {new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
