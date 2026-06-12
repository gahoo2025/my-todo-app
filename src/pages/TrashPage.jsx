import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORY_TINTS = {
  '仕事':  'text-[#007AFF]',
  '個人':  'text-[#AF52DE]',
  '買い物': 'text-[#34C759]',
  '健康':  'text-[#FF3B30]',
  'その他': 'text-[#8E8E93]',
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
    <div className="min-h-screen">
      {/* ナビゲーションバー */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-11">
            <button onClick={onBack} className="flex items-center text-[#007AFF] active:opacity-50 transition-opacity -ml-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[16px]">戻る</span>
            </button>
            {tasks.length > 0 && (
              <button
                onClick={emptyTrash}
                disabled={clearing}
                className="text-[15px] text-[#FF3B30] font-medium active:opacity-50 disabled:opacity-40 transition-opacity"
              >
                {clearing ? '削除中…' : 'すべて削除'}
              </button>
            )}
          </div>
          <div className="pb-3 pt-1">
            <h1 className="text-[28px] font-bold tracking-tight text-[#1C1C1E] leading-tight">ゴミ箱</h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">{tasks.length}件</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-2xl mx-auto px-4 py-4 pb-10">
        {loading ? (
          <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-[#8E8E93]">ゴミ箱は空です</p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-[#8E8E93] mb-2 px-3 leading-relaxed">
              「復元」で一覧に戻します。「すべて削除」で完全に消去します。
            </p>
            <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-[#AEAEB2] line-through truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[12px] font-medium ${CATEGORY_TINTS[task.category] ?? 'text-[#8E8E93]'} opacity-60`}>
                        {task.category}
                      </span>
                      <span className="text-[12px] text-[#AEAEB2]">
                        {new Date(task.deleted_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}に削除
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => restoreTask(task.id)}
                    className="flex-shrink-0 text-[14px] text-[#007AFF] font-medium px-3 py-1.5 rounded-full bg-[#007AFF]/[0.08] active:opacity-50 transition-opacity"
                  >
                    復元
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
