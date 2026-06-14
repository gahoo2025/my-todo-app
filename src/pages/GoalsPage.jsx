import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGoals } from '../hooks/useGoals'

const CATEGORY_TINTS = {
  '仕事':  { text: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
  '個人':  { text: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' },
  '買い物': { text: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
  '健康':  { text: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
  'その他': { text: 'text-[#8E8E93]', bg: 'bg-[#8E8E93]/10' },
}

const STATUS_CONFIG = {
  active:    { label: '進行中', color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10', dot: 'bg-[#007AFF]' },
  completed: { label: '達成',   color: 'text-[#34C759]', bg: 'bg-[#34C759]/10', dot: 'bg-[#34C759]' },
  paused:    { label: '保留中', color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10', dot: 'bg-[#FF9500]' },
}

function GoalModal({ goal, categories, onSave, onDelete, onClose }) {
  const isNew = !goal.id
  const [title, setTitle] = useState(goal.title ?? '')
  const [description, setDescription] = useState(goal.description ?? '')
  const [category, setCategory] = useState(goal.category ?? null)
  const [status, setStatus] = useState(goal.status ?? 'active')
  const [dueDate, setDueDate] = useState(goal.due_date ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setLoading(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      category,
      status,
      due_date: dueDate || null,
    })
    setLoading(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('この目標を削除しますか？')) return
    await onDelete()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-30" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{isNew ? '目標を追加' : '目標を編集'}</h2>
          <button
            onClick={handleSave}
            disabled={loading || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {loading ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* タイトル・説明 */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <input
              autoFocus
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              placeholder="目標タイトル"
            />
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="詳細・メモ（任意）"
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* ステータス・カテゴリ・期限 */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">ステータス</span>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              >
                <option value="active">進行中</option>
                <option value="completed">達成</option>
                <option value="paused">保留中</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">カテゴリ</span>
              <select
                value={category ?? ''}
                onChange={e => setCategory(e.target.value || null)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              >
                <option value="">なし</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">目標期限</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          {/* 削除ボタン（編集時のみ） */}
          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
            >
              目標を削除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function GoalCard({ goal, onEdit }) {
  const status = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.active
  const tints = CATEGORY_TINTS[goal.category] ?? { text: 'text-[#8E8E93]', bg: 'bg-[#8E8E93]/10' }
  const isOverdue = goal.due_date && goal.status !== 'completed' && new Date(goal.due_date) < new Date()
  const dueLabel = goal.due_date
    ? new Date(goal.due_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : null

  return (
    <button
      onClick={() => onEdit(goal)}
      className="w-full text-left ios-card px-4 py-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        {/* ステータスドット */}
        <div className={`mt-[3px] w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={`text-[16px] font-semibold leading-snug ${
              goal.status === 'completed' ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'
            }`}>
              {goal.title}
            </p>
          </div>

          {goal.description && (
            <p className="text-[13px] text-[#8E8E93] leading-relaxed line-clamp-2 mb-2">
              {goal.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
              {status.label}
            </span>
            {goal.category && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tints.text} ${tints.bg}`}>
                {goal.category}
              </span>
            )}
            {dueLabel && (
              <span className={`text-[11px] ${isOverdue ? 'text-[#FF3B30] font-medium' : 'text-[#8E8E93]'}`}>
                期限 {dueLabel}{isOverdue ? ' ⚠' : ''}
              </span>
            )}
          </div>
        </div>

        <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export default function GoalsPage({ embedded, categories = [], filterCategory, onFilterChange, onAddGoal }) {
  const { user } = useAuth()
  const { goals, loading, addGoal, updateGoal, deleteGoal } = useGoals(user?.id)
  const [modal, setModal] = useState(null) // null | { goal } — goal={} for new

  const activeFilter = filterCategory ?? 'すべて'
  const categoryNames = categories.map(c => c.name)

  const filteredGoals = activeFilter === 'すべて'
    ? goals
    : goals.filter(g => g.category === activeFilter)

  const activeGoals    = filteredGoals.filter(g => g.status === 'active')
  const pausedGoals    = filteredGoals.filter(g => g.status === 'paused')
  const completedGoals = filteredGoals.filter(g => g.status === 'completed')

  function openNew() {
    const defaultCategory = activeFilter !== 'すべて' ? activeFilter : null
    setModal({ goal: { status: 'active', category: defaultCategory } })
  }

  async function handleSave(data) {
    if (modal.goal.id) {
      await updateGoal(modal.goal.id, data)
    } else {
      await addGoal(data)
    }
  }

  async function handleDelete() {
    await deleteGoal(modal.goal.id)
  }

  function Section({ title, items }) {
    if (items.length === 0) return null
    return (
      <div className="mb-5">
        <p className="text-[12px] font-semibold text-[#8E8E93] mb-2 px-1">{title}</p>
        <div className="space-y-2">
          {items.map(g => <GoalCard key={g.id} goal={g} onEdit={g => setModal({ goal: g })} />)}
        </div>
      </div>
    )
  }

  const content = (
    <>
      {/* モバイル カテゴリピル */}
      {embedded && (
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
          {['すべて', ...categoryNames].map(cat => (
            <button
              key={cat}
              onClick={() => onFilterChange?.(cat)}
              className={`flex-shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-all duration-200 ${
                activeFilter === cat
                  ? 'bg-[#1C1C1E] text-white'
                  : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
      ) : filteredGoals.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#767680]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l1.9-5.7a8.5 8.5 0 1113.8 0L21 21M12 7v5m0 4h.01" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#8E8E93]">目標がありません</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンから目標を追加できます</p>
        </div>
      ) : (
        <>
          <Section title="進行中" items={activeGoals} />
          <Section title="保留中" items={pausedGoals} />
          <Section title="達成済み" items={completedGoals} />
        </>
      )}
    </>
  )

  return (
    <>
      {embedded ? (
        <div>
          <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
            {/* PC サイドバー */}
            <aside className="hidden md:block w-52 flex-shrink-0 sticky top-[60px]">
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">カテゴリ</p>
              <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
                {['すべて', ...categoryNames].map(cat => (
                  <button
                    key={cat}
                    onClick={() => onFilterChange?.(cat)}
                    className={`w-full flex items-center justify-between text-left px-4 py-2.5 text-[15px] transition-colors duration-150 ${
                      activeFilter === cat
                        ? 'text-[#007AFF] font-semibold bg-[#007AFF]/[0.06]'
                        : 'text-[#1C1C1E] hover:bg-black/[0.025] active:bg-black/5'
                    }`}
                  >
                    {cat}
                    {activeFilter === cat && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={openNew}
                className="w-full mt-4 py-2.5 rounded-[12px] bg-[#007AFF] text-white font-semibold text-[14px] active:opacity-70 transition-opacity shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
              >
                ＋ 新規目標
              </button>
            </aside>
            <div className="flex-1 min-w-0">{content}</div>
          </main>
          {/* モバイル FAB */}
          <button
            onClick={openNew}
            className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
            aria-label="目標を追加"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="min-h-screen">
          <main className="max-w-lg mx-auto px-4 py-4 pb-10">{content}</main>
        </div>
      )}

      {modal && (
        <GoalModal
          goal={modal.goal}
          categories={categories}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
