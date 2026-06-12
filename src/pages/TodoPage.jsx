import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import TaskForm from '../components/TaskForm'
import TaskList from '../components/TaskList'
import CalendarView from '../components/CalendarView'
import EditTaskModal from '../components/EditTaskModal'
import HistoryPage from './HistoryPage'
import TrashPage from './TrashPage'
import CategoryPage from './CategoryPage'

export default function TodoPage() {
  const { user, signOut } = useAuth()
  const { categories, loading: catLoading, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [page, setPage] = useState('todo')
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [filterCategory, setFilterCategory] = useState('すべて')

  useEffect(() => {
    if (user && page === 'todo') fetchTasks()
  }, [user?.id, page])

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('user_id', user.id)
        .is('deleted_at', null).order('position', { ascending: true }).order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data ?? [])
    } catch (err) {
      setFetchError(err.message)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function addTask(task) {
    const minPosition = tasks.length > 0 ? Math.min(...tasks.map(t => t.position ?? 0)) - 1 : 0
    const { data, error } = await supabase
      .from('tasks').insert([{ ...task, user_id: user.id, position: minPosition }]).select().single()
    if (error) { alert('タスクの保存に失敗しました: ' + error.message); return }
    setTasks([data, ...tasks])
    setShowForm(false)
  }

  async function reorderTasks(activeId, overId) {
    const oldIndex = tasks.findIndex(t => t.id === activeId)
    const newIndex = tasks.findIndex(t => t.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...tasks]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    // 楽観的UI更新
    setTasks(reordered)

    // DB に position を一括保存
    const updates = reordered.map((t, i) => ({ id: t.id, position: i }))
    await Promise.all(
      updates.map(({ id, position }) =>
        supabase.from('tasks').update({ position }).eq('id', id)
      )
    )
  }

  async function updateTask(id, updates) {
    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', id).select().single()
    if (error) { alert('更新に失敗しました: ' + error.message); return }
    setTasks(tasks.map(t => t.id === id ? data : t))
    setEditingTask(null)
  }

  async function toggleTask(id, completed) {
    const { data, error } = await supabase
      .from('tasks').update({ completed: !completed }).eq('id', id).select().single()
    if (!error) setTasks(tasks.map(t => t.id === id ? data : t))
  }

  async function trashTask(id) {
    const { error } = await supabase
      .from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (!error) setTasks(tasks.filter(t => t.id !== id))
  }

  if (page === 'history') return <HistoryPage onBack={() => setPage('todo')} />
  if (page === 'trash') return <TrashPage onBack={() => setPage('todo')} />
  if (page === 'category') return (
    <CategoryPage
      categories={categories}
      onAdd={addCategory}
      onUpdate={updateCategory}
      onDelete={deleteCategory}
      onReorder={reorderCategories}
      onBack={() => setPage('todo')}
    />
  )

  const categoryNames = categories.map(c => c.name)
  const filtered = filterCategory === 'すべて'
    ? tasks : tasks.filter(t => t.category === filterCategory)
  const pending = tasks.filter(t => !t.completed).length
  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="text-white px-4 py-4 sticky top-0 z-10"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="max-w-lg md:max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2 md:mb-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <h1 className="text-lg font-bold tracking-wide">My Todo</h1>
              <p className="hidden md:block text-white/80 text-xs font-medium ml-4">
                {pending > 0 ? `${pending}件のタスクが残っています` : 'すべてのタスクが完了しています 🎉'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {/* ビュー切り替え */}
              <div className="flex bg-white/20 rounded-xl p-0.5">
                <button
                  onClick={() => setView('list')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${view === 'list' ? 'bg-white text-violet-600' : 'text-white/80 hover:text-white'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-white text-violet-600' : 'text-white/80 hover:text-white'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <button onClick={() => setPage('category')}
                className="flex items-center justify-center gap-1 w-8 md:w-auto h-8 md:px-3 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-sm transition-colors text-xs font-medium"
                title="カテゴリ管理">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="hidden md:inline">カテゴリ</span>
              </button>
              <button onClick={() => setPage('history')}
                className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl backdrop-blur-sm transition-colors font-medium">
                📋<span className="hidden md:inline">履歴</span>{completedCount > 0 && <span className="bg-white/30 px-1.5 rounded-full">{completedCount}</span>}
              </button>
              <button onClick={() => setPage('trash')}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl backdrop-blur-sm transition-colors font-medium">
                🗑<span className="hidden md:inline ml-1">ゴミ箱</span>
              </button>
              <button onClick={signOut}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl backdrop-blur-sm transition-colors font-medium">
                ログアウト
              </button>
            </div>
          </div>
          <p className="md:hidden text-white/80 text-xs font-medium">
            {pending > 0 ? `${pending}件のタスクが残っています` : 'すべてのタスクが完了しています 🎉'}
          </p>
        </div>
      </header>

      <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-8 md:flex md:gap-6 md:items-start">
        {/* Category sidebar (desktop) — リストビュー時のみ表示 */}
        <aside className={`${view === 'list' ? 'hidden md:block' : 'hidden'} w-48 flex-shrink-0 sticky top-20`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">カテゴリ</p>
          <div className="space-y-1">
            {['すべて', ...categoryNames].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterCategory === cat
                    ? 'text-white shadow-md shadow-violet-200'
                    : 'bg-white text-gray-500 border border-gray-100 shadow-sm hover:border-violet-200'
                }`}
                style={filterCategory === cat ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 py-2.5 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-violet-200"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            ＋ タスクを追加
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Category filter (mobile) — リストビュー時のみ */}
          <div className={`${view === 'list' ? 'md:hidden' : 'hidden'} flex gap-2 overflow-x-auto pb-2 mb-4`}>
            {['すべて', ...categoryNames].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filterCategory === cat
                    ? 'text-white shadow-md shadow-violet-200'
                    : 'bg-white text-gray-500 border border-gray-100 shadow-sm'
                }`}
                style={filterCategory === cat ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}}
              >
                {cat}
              </button>
            ))}
          </div>

          {fetchError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 text-sm text-red-500">
              ⚠️ {fetchError}
            </div>
          )}

          {loading || catLoading ? (
            <div className="text-center py-16 text-gray-300 text-sm">読み込み中...</div>
          ) : view === 'calendar' ? (
            <CalendarView
              tasks={tasks}
              categories={categories}
              onEdit={setEditingTask}
            />
          ) : (
            <TaskList
              tasks={filtered}
              userId={user.id}
              onToggle={toggleTask}
              onDelete={trashTask}
              onEdit={setEditingTask}
              onReorder={reorderTasks}
            />
          )}
        </div>
      </main>

      {/* FAB (mobile) */}
      <button
        onClick={() => setShowForm(true)}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 text-white rounded-2xl shadow-lg shadow-violet-300 text-2xl flex items-center justify-center transition-all active:scale-95 z-20"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        +
      </button>

      {showForm && (
        <TaskForm
          categories={categories}
          defaultCategory={filterCategory !== 'すべて' ? filterCategory : undefined}
          onAdd={addTask}
          onClose={() => setShowForm(false)}
        />
      )}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          categories={categories}
          onSave={updateTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
