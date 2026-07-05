import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'

const CATEGORY_TINTS = {
  '仕事':  'text-[#007AFF]',
  '個人':  'text-[#AF52DE]',
  '買い物': 'text-[#34C759]',
  '健康':  'text-[#FF3B30]',
  'その他': 'text-[#8E8E93]',
}

export default function HistoryPage({ onBack, initialCategory }) {
  const { user } = useAuth()
  const { categories } = useCategories()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState(initialCategory ?? 'すべて')

  const categoryNames = categories.map(c => c.name)

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

  async function restoreTask(id) {
    const { error } = await supabase.from('tasks').update({ completed: false }).eq('id', id)
    if (!error) setTasks(tasks.filter(t => t.id !== id))
  }

  const filteredTasks = filterCategory === 'すべて'
    ? tasks
    : tasks.filter(t => t.category === filterCategory)

  const grouped = filteredTasks.reduce((acc, task) => {
    const date = new Date(task.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(task)
    return acc
  }, {})

  return (
    <div className="min-h-screen">
      <header className="safe-top sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4">
          <div className="flex items-center h-11">
            <button onClick={onBack} className="flex items-center text-[#007AFF] active:opacity-50 transition-opacity -ml-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[16px]">戻る</span>
            </button>
          </div>
          <div className="pb-3 pt-1">
            <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] leading-tight">完了履歴</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-10">
        {/* カテゴリピル */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
          {['すべて', ...categoryNames].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-all duration-200 ${
                filterCategory === cat
                  ? 'bg-[#1C1C1E] text-white'
                  : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center text-3xl">🎉</div>
            <p className="text-[15px] font-medium text-[#8E8E93]">完了したタスクがありません</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayTasks]) => (
            <div key={date} className="mb-6">
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">{date}</p>
              <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
                {dayTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-[#007AFF] flex items-center justify-center">
                      <svg className="w-[11px] h-[11px] text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6.2l2.8 2.8L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-[#AEAEB2] line-through truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[12px] font-medium ${CATEGORY_TINTS[task.category] ?? 'text-[#8E8E93]'} opacity-60`}>
                          {task.category}
                        </span>
                        {task.due_date && (
                          <span className="text-[12px] text-[#AEAEB2]">
                            期限 {new Date(task.due_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreTask(task.id)}
                      className="flex-shrink-0 text-[14px] text-[#007AFF] font-medium px-3 py-1.5 rounded-full bg-[#007AFF]/[0.08] active:opacity-50 transition-opacity"
                    >
                      戻す
                    </button>
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
