import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useEvents } from '../hooks/useEvents'
import TaskForm from '../components/TaskForm'
import TaskList from '../components/TaskList'
import CalendarView from '../components/CalendarView'
import EditTaskModal from '../components/EditTaskModal'
import EventForm from '../components/EventForm'
import DayScheduleView from '../components/DayScheduleView'
import HistoryPage from './HistoryPage'
import TrashPage from './TrashPage'
import CategoryPage from './CategoryPage'
import NotesPage from './NotesPage'

export default function TodoPage() {
  const { user, signOut } = useAuth()
  const { categories, loading: catLoading, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories()
  const { events, addEvent, updateEvent, deleteEvent } = useEvents(user?.id)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventFormDate, setEventFormDate] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
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

  if (page === 'notes') return <NotesPage onBack={() => setPage('todo')} />
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
    <div className="min-h-screen">
      {/* ナビゲーションバー（すりガラス） */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg md:max-w-5xl mx-auto px-4">
          {/* ツールバー */}
          <div className="flex items-center justify-between h-11">
            {/* セグメンテッドコントロール */}
            <div className="flex bg-[#767680]/15 rounded-[9px] p-0.5">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1 px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all duration-200 ${
                  view === 'list' ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#8E8E93]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden md:inline">リスト</span>
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-1 px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all duration-200 ${
                  view === 'calendar' ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#8E8E93]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:inline">カレンダー</span>
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              <button onClick={() => setPage('notes')} className="ios-icon-btn text-[#007AFF]" title="メモ">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4m4 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button onClick={() => setPage('category')} className="ios-icon-btn text-[#007AFF]" title="カテゴリ管理">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </button>
              <button onClick={() => setPage('history')} className="ios-icon-btn text-[#007AFF] relative" title="完了履歴">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {completedCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#FF3B30] text-white text-[10px] font-semibold rounded-full">
                    {completedCount}
                  </span>
                )}
              </button>
              <button onClick={() => setPage('trash')} className="ios-icon-btn text-[#007AFF]" title="ゴミ箱">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button onClick={signOut} className="ios-toolbar-btn ml-2 text-[13px]">
                ログアウト
              </button>
            </div>
          </div>

          {/* ラージタイトル */}
          <div className="pb-3 pt-1">
            <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1C1C1E] leading-tight">
              マイタスク
            </h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">
              {pending > 0 ? `残り${pending}件` : 'すべて完了 🎉'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
        {/* カテゴリサイドバー（PC・リストビュー時のみ） */}
        <aside className={`${view === 'list' ? 'hidden md:block' : 'hidden'} w-52 flex-shrink-0 sticky top-[120px]`}>
          <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">カテゴリ</p>
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            {['すべて', ...categoryNames].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-[15px] transition-colors duration-150 ${
                  filterCategory === cat
                    ? 'text-[#007AFF] font-semibold bg-[#007AFF]/[0.06]'
                    : 'text-[#1C1C1E] hover:bg-black/[0.025] active:bg-black/5'
                }`}
              >
                {cat}
                {filterCategory === cat && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity duration-150 shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
          >
            ＋ 新規タスク
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          {/* カテゴリフィルター（モバイル・リストビュー時のみ） */}
          <div className={`${view === 'list' ? 'md:hidden' : 'hidden'} flex gap-2 overflow-x-auto pb-3 -mx-4 px-4`}>
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

          {fetchError && (
            <div className="ios-card px-4 py-3 mb-4 text-[13px] text-[#FF3B30]">
              ⚠️ {fetchError}
            </div>
          )}

          {loading || catLoading ? (
            <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中...</div>
          ) : view === 'calendar' ? (
            <CalendarView
              tasks={tasks}
              events={events}
              categories={categories}
              onEdit={setEditingTask}
              onDayPress={date => setSelectedDay(date)}
              onAddEvent={date => { setEventFormDate(date); setShowEventForm(true) }}
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

      {/* FAB（モバイル） */}
      <button
        onClick={() => setShowForm(true)}
        className="md:hidden fixed bottom-7 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform duration-150 z-20"
        aria-label="タスクを追加"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
        </svg>
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
          userId={user.id}
          onSave={updateTask}
          onClose={() => setEditingTask(null)}
        />
      )}
      {showEventForm && (
        <EventForm
          initialDate={eventFormDate}
          onSave={addEvent}
          onClose={() => { setShowEventForm(false); setEventFormDate(null) }}
        />
      )}
      {editingEvent && (
        <EventForm
          event={editingEvent}
          onSave={(updates) => updateEvent(editingEvent.id, updates)}
          onDelete={deleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
      {selectedDay && (
        <DayScheduleView
          date={selectedDay}
          tasks={tasks}
          events={events}
          onEditTask={task => { setSelectedDay(null); setEditingTask(task) }}
          onEditEvent={event => { setSelectedDay(null); setEditingEvent(event) }}
          onAddEvent={date => { setSelectedDay(null); setEventFormDate(date); setShowEventForm(true) }}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
