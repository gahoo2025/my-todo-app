import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGoals } from '../hooks/useGoals'
import { useGoalActions } from '../hooks/useGoalActions'

const CATEGORY_TINTS = {
  '仕事':  { text: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
  '個人':  { text: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' },
  '買い物': { text: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
  '健康':  { text: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
  'その他': { text: 'text-[#8E8E93]', bg: 'bg-[#8E8E93]/10' },
}

const STATUS_CONFIG = {
  active:    { label: '進行中', color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10', dot: 'bg-[#007AFF]' },
  completed: { label: '完了',   color: 'text-[#34C759]', bg: 'bg-[#34C759]/10', dot: 'bg-[#34C759]' },
  paused:    { label: '保留',   color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10', dot: 'bg-[#FF9500]' },
}

// ── アクションパネル（目標詳細モーダル内に組み込む） ──
function ActionPanel({ goalId, userId }) {
  const { actions, loading, addAction, updateAction, deleteAction } = useGoalActions(goalId)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    await addAction({ title: newTitle.trim(), status: 'active', user_id: userId })
    setNewTitle('')
    setAdding(false)
  }

  return (
    <div>
      {loading ? (
        <p className="text-[13px] text-[#AEAEB2] py-2">読み込み中…</p>
      ) : (
        <div className="space-y-1 mb-3">
          {actions.map(action => (
            <ActionRow
              key={action.id}
              action={action}
              onUpdate={updates => updateAction(action.id, updates)}
              onDelete={() => deleteAction(action.id)}
            />
          ))}
          {actions.length === 0 && (
            <p className="text-[13px] text-[#AEAEB2] py-1">アクションがありません</p>
          )}
        </div>
      )}

      {/* 新規アクション入力 */}
      <form onSubmit={handleAdd} className="flex gap-2 items-center">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="アクションを追加…"
          className="flex-1 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none border-b border-black/10 py-1"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="flex-shrink-0 text-[13px] font-semibold text-[#007AFF] px-2 py-1 disabled:opacity-30 active:opacity-50 transition-opacity"
        >
          追加
        </button>
      </form>
    </div>
  )
}

function ActionRow({ action, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(action.title)
  const [status, setStatus] = useState(action.status)
  const [dueDate, setDueDate] = useState(action.due_date ?? '')
  const [saving, setSaving] = useState(false)
  const cfg = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.active
  const isOverdue = action.due_date && action.status !== 'completed'
    && new Date(action.due_date) < new Date()

  async function handleSave() {
    setSaving(true)
    await onUpdate({ title: title.trim() || action.title, status, due_date: dueDate || null })
    setSaving(false)
    setEditing(false)
  }

  async function cycleStatus() {
    const order = ['active', 'completed', 'paused']
    const next = order[(order.indexOf(action.status) + 1) % order.length]
    await onUpdate({ status: next })
  }

  if (editing) {
    return (
      <div className="rounded-[10px] bg-black/[0.03] px-3 py-2.5 space-y-2">
        <input
          autoFocus
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-[14px] text-[#1C1C1E] bg-transparent focus:outline-none border-b border-black/10 pb-1"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="text-[13px] text-[#8E8E93] bg-transparent focus:outline-none"
          >
            <option value="active">進行中</option>
            <option value="completed">完了</option>
            <option value="paused">保留</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="text-[13px] text-[#8E8E93] bg-transparent focus:outline-none"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setEditing(false)} className="text-[13px] text-[#8E8E93] active:opacity-50">キャンセル</button>
          <button
            onClick={onDelete}
            className="text-[13px] text-[#FF3B30] active:opacity-50"
          >削除</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[13px] font-semibold text-[#007AFF] disabled:opacity-30 active:opacity-50"
          >{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* ステータスドット（タップで切り替え） */}
      <button
        onClick={cycleStatus}
        className={`flex-shrink-0 w-3 h-3 rounded-full ${cfg.dot} active:scale-90 transition-transform`}
        title="ステータスを切り替え"
      />
      <div className="flex-1 min-w-0">
        <span className={`text-[14px] leading-snug ${
          action.status === 'completed' ? 'line-through text-[#AEAEB2]' : 'text-[#1C1C1E]'
        }`}>
          {action.title}
        </span>
        {action.due_date && (
          <span className={`ml-2 text-[11px] ${isOverdue ? 'text-[#FF3B30] font-medium' : 'text-[#8E8E93]'}`}>
            {new Date(action.due_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
            {isOverdue ? ' ⚠' : ''}
          </span>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[#C7C7CC] hover:text-[#8E8E93] active:opacity-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  )
}

// ── 目標の追加・編集モーダル ──
function GoalModal({ goal, categories, userId, onSave, onDelete, onClose }) {
  const isNew = !goal.id
  const [title, setTitle] = useState(goal.title ?? '')
  const [description, setDescription] = useState(goal.description ?? '')
  const [category, setCategory] = useState(goal.category ?? null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      category,
    })
    setSaving(false)
    if (isNew) onClose()
  }

  async function handleDelete() {
    if (!window.confirm('この目標を削除しますか？\n関連するアクションもすべて削除されます。')) return
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
          <button onClick={onClose} className="ios-toolbar-btn">
            {isNew ? 'キャンセル' : '閉じる'}
          </button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">
            {isNew ? '目標を追加' : '目標を編集'}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* タイトル・説明 */}
          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              placeholder="目標タイトル"
            />
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="詳細・メモ（任意）"
              className="w-full px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* カテゴリ */}
          <div className="ios-card overflow-hidden">
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
          </div>

          {/* アクション一覧（編集時のみ） */}
          {!isNew && (
            <div className="ios-card px-4 py-3">
              <p className="text-[13px] font-semibold text-[#8E8E93] mb-3">アクション</p>
              <ActionPanel goalId={goal.id} userId={userId} />
            </div>
          )}

          {/* 削除（編集時のみ） */}
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

// ── 目標カード ──
function GoalCard({ goal, onOpen }) {
  const tints = CATEGORY_TINTS[goal.category] ?? { text: 'text-[#8E8E93]', bg: 'bg-[#8E8E93]/10' }

  return (
    <button
      onClick={() => onOpen(goal)}
      className="w-full text-left ios-card px-4 py-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-[#1C1C1E] leading-snug mb-1">{goal.title}</p>
          {goal.description && (
            <p className="text-[13px] text-[#8E8E93] leading-relaxed line-clamp-2 mb-2">
              {goal.description}
            </p>
          )}
          {goal.category && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tints.text} ${tints.bg}`}>
              {goal.category}
            </span>
          )}
        </div>
        <svg className="w-4 h-4 text-[#C7C7CC] flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

export default function GoalsPage({ embedded, categories = [], filterCategory, onFilterChange }) {
  const { user } = useAuth()
  const { goals, loading, addGoal, updateGoal, deleteGoal } = useGoals(user?.id)
  const [modal, setModal] = useState(null)

  const activeFilter = filterCategory ?? 'すべて'
  const categoryNames = categories.map(c => c.name)

  const filteredGoals = activeFilter === 'すべて'
    ? goals
    : goals.filter(g => g.category === activeFilter)

  function openNew() {
    const defaultCategory = activeFilter !== 'すべて' ? activeFilter : null
    setModal({ goal: { category: defaultCategory } })
  }

  async function handleSave(data) {
    if (modal.goal.id) {
      await updateGoal(modal.goal.id, data)
    } else {
      const created = await addGoal(data)
      // 新規追加後、すぐアクションを追加できるよう編集モードへ
      if (created) setModal({ goal: created })
      return
    }
  }

  async function handleDelete() {
    await deleteGoal(modal.goal.id)
  }

  const content = (
    <>
      {/* モバイル カテゴリピル */}
      {embedded && (
        <div className="md:hidden sticky top-[44px] z-[5] -mx-4 px-4 pt-2 pb-2.5 bg-[#F2F2F7]/85 backdrop-blur-xl flex gap-2 overflow-x-auto">
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l1.9-5.7a8.5 8.5 0 1113.8 0L21 21" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#8E8E93]">目標がありません</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">＋ボタンから目標を追加できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGoals.map(g => (
            <GoalCard key={g.id} goal={g} onOpen={g => setModal({ goal: g })} />
          ))}
        </div>
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
          userId={user?.id}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
