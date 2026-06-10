import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import TaskForm from '../components/TaskForm'
import TaskList from '../components/TaskList'

const CATEGORIES = ['仕事', '個人', '買い物', '健康', 'その他']

export default function TodoPage() {
  const { user, signOut } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('すべて')

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data ?? [])
    } catch (err) {
      console.error('タスク取得エラー:', err.message)
      setFetchError(err.message)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  async function addTask(task) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...task, user_id: user.id }])
      .select()
      .single()
    if (error) {
      console.error('タスク追加エラー:', error.message, error.code)
      alert('タスクの保存に失敗しました: ' + error.message)
      return
    }
    setTasks([data, ...tasks])
    setShowForm(false)
  }

  async function toggleTask(id, completed) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ completed: !completed })
      .eq('id', id)
      .select()
      .single()
    if (!error) setTasks(tasks.map(t => t.id === id ? data : t))
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) setTasks(tasks.filter(t => t.id !== id))
  }

  const filtered = filterCategory === 'すべて'
    ? tasks
    : tasks.filter(t => t.category === filterCategory)

  const pending = tasks.filter(t => !t.completed).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">✅ My Todo</h1>
            <p className="text-xs text-indigo-200">{pending}件のタスクが残っています</p>
          </div>
          <button
            onClick={signOut}
            className="text-xs bg-indigo-700 px-3 py-1.5 rounded-lg active:bg-indigo-800"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 pb-24">
        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {['すべて', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 break-all">
            ⚠️ エラー: {fetchError}
          </div>
        )}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <TaskList
            tasks={filtered}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:bg-indigo-700 transition-colors z-20"
        aria-label="タスクを追加"
      >
        +
      </button>

      {/* Add Task Modal */}
      {showForm && (
        <TaskForm
          categories={CATEGORIES}
          onAdd={addTask}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
