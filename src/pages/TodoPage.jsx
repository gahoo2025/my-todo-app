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

// ボトムタブアイコン
function TabIcon({ tab, active }) {
  const cls = `w-6 h-6 transition-transform duration-150 ${active ? 'scale-110' : ''}`
  if (tab === 'tasks') return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
  if (tab === 'calendar') return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  if (tab === 'notes') return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

const TABS = [
  { id: 'tasks',    label: 'タスク' },
  { id: 'calendar', label: 'カレンダー' },
  { id: 'notes',   label: 'メモ' },
]

const TAB_TITLES = {
  tasks:    'タスク',
  calendar: 'カレンダー',
  notes:    'メモ',
}

export default function TodoPage() {
  const { user, signOut } = useAuth()
  const { categories, loading: catLoading, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories()
  const { events, addEvent, updateEvent, deleteEvent } = useEvents(user?.id)

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [tab, setTab] = useState('tasks')     // 'tasks' | 'calendar' | 'notes'
  const [page, setPage] = useState(null)      // null | 'history' | 'trash' | 'category'
  const [filterCategory, setFilterCategory] = useState('すべて')

  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventFormDate, setEventFormDate] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    if (user) fetchTasks()
  }, [user?.id])

  // サブページから戻ったときも再取得
  useEffect(() => {
    if (!page && user) fetchTasks()
  }, [page])

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('user_id', user.id)
        .is('deleted_at', null)
        .eq('completed', false)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
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
    setTasks(reordered)
    await Promise.all(
      reordered.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id))
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

  // サブページ
  if (page === 'history') return (
    <HistoryPage onBack={() => { setPage(null); setTab('tasks') }} initialCategory={filterCategory} />
  )
  if (page === 'trash') return (
    <TrashPage onBack={() => setPage(null)} />
  )
  if (page === 'category') return (
    <CategoryPage
      categories={categories}
      onAdd={addCategory}
      onUpdate={updateCategory}
      onDelete={deleteCategory}
      onReorder={reorderCategories}
      onBack={() => setPage(null)}
    />
  )

  const categoryNames = categories.map(c => c.name)
  const filteredTasks = filterCategory === 'すべて'
    ? tasks : tasks.filter(t => t.category === filterCategory)
  const pending = tasks.length

  return (
    <div className="min-h-screen flex flex-col">

      {/* ===== ナビゲーションバー ===== */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg md:max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-11">
            {/* ラージタイトル（インライン） */}
            <span className="text-[17px] font-bold text-[#1C1C1E] tracking-tight">
              {TAB_TITLES[tab]}
              {tab === 'tasks' && (
                <span className="ml-2 text-[13px] font-normal text-[#8E8E93]">
                  {pending > 0 ? `残り${pending}件` : '完了 🎉'}
                </span>
              )}
            </span>

            {/* 右側アイコン群 */}
            <div className="flex items-center gap-0.5">
              {/* 全タブ共通 */}
              {(tab === 'tasks' || tab === 'calendar' || tab === 'notes') && (
                <button onClick={() => setPage('category')} className="ios-icon-btn text-[#007AFF]" title="カテゴリ">
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </button>
              )}
              {tab === 'tasks' && (
                <>
                  <button onClick={() => setPage('history')} className="ios-icon-btn text-[#007AFF]" title="完了履歴">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button onClick={() => setPage('trash')} className="ios-icon-btn text-[#007AFF]" title="ゴミ箱">
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
              <button onClick={signOut} className="ios-toolbar-btn ml-1 text-[13px]">
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== メインコンテンツ ===== */}
      <div className="flex-1">

        {/* ── タスクタブ ── */}
        {tab === 'tasks' && (
          <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
            {/* PCサイドバー */}
            <aside className="hidden md:block w-52 flex-shrink-0 sticky top-[60px]">
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
                className="w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
              >
                ＋ 新規タスク
              </button>
            </aside>

            <div className="flex-1 min-w-0">
              {/* モバイル カテゴリピル */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
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
                <div className="ios-card px-4 py-3 mb-4 text-[13px] text-[#FF3B30]">⚠️ {fetchError}</div>
              )}
              {loading || catLoading ? (
                <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中...</div>
              ) : (
                <TaskList
                  tasks={filteredTasks}
                  userId={user.id}
                  onToggle={toggleTask}
                  onDelete={trashTask}
                  onEdit={setEditingTask}
                  onReorder={reorderTasks}
                />
              )}
            </div>
          </main>
        )}

        {/* ── カレンダータブ ── */}
        {tab === 'calendar' && (
          <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
            {/* PCサイドバー */}
            <aside className="hidden md:block w-52 flex-shrink-0 sticky top-[60px]">
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
            </aside>

            <div className="flex-1 min-w-0">
              {/* モバイル カテゴリピル */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
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

              {loading || catLoading ? (
                <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中...</div>
              ) : (
                <CalendarView
                  tasks={filteredTasks}
                  events={events}
                  categories={categories}
                  onEdit={setEditingTask}
                  onDayPress={date => setSelectedDay(date)}
                  onAddEvent={date => { setEventFormDate(date); setShowEventForm(true) }}
                />
              )}
            </div>
          </main>
        )}

        {/* ── メモタブ ── */}
        {tab === 'notes' && (
          <NotesPage
            embedded
            categories={categories}
            filterCategory={filterCategory}
            onFilterChange={setFilterCategory}
          />
        )}
      </div>

      {/* ===== ボトムタブバー ===== */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#F2F2F7]/90 backdrop-blur-xl border-t border-black/[0.08] safe-area-bottom">
        <div className="max-w-lg md:max-w-2xl mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150 ${
                tab === t.id ? 'text-[#007AFF]' : 'text-[#8E8E93]'
              }`}
            >
              <TabIcon tab={t.id} active={tab === t.id} />
              <span className={`text-[10px] font-medium ${tab === t.id ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== FAB（モバイル、タスク/カレンダータブ） ===== */}
      {tab === 'tasks' && (
        <button
          onClick={() => setShowForm(true)}
          className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
          aria-label="タスクを追加"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      )}
      {tab === 'calendar' && (
        <button
          onClick={() => { setEventFormDate(new Date()); setShowEventForm(true) }}
          className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
          aria-label="予定を追加"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      )}

      {/* ===== モーダル群 ===== */}
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
          onSwitchToList={() => setTab('tasks')}
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
          tasks={filteredTasks}
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
