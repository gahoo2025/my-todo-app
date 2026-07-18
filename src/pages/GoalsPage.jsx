import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useGoals } from '../hooks/useGoals'
import { useGoalActions } from '../hooks/useGoalActions'
import { useDrinkTracker } from '../hooks/useDrinkTracker'
import { useWeightTracker } from '../hooks/useWeightTracker'

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

// ── 飲酒量トラッカー（プランのサブ機能） ──
const DRINK_PRESETS = [
  { id: 'beer',     label: 'ビール',    sub: '缶350ml',   grams: 14 },
  { id: 'beerL',    label: 'ビール',    sub: '中瓶500ml', grams: 20 },
  { id: 'chuhai',   label: 'チューハイ', sub: '350ml/7%',  grams: 20 },
  { id: 'sake',     label: '日本酒',    sub: '1合',       grams: 22 },
  { id: 'wine',     label: 'ワイン',    sub: 'グラス1杯', grams: 12 },
  { id: 'highball', label: 'ハイボール', sub: '1杯',       grams: 10 },
  { id: 'shochu',   label: '焼酎',      sub: '水割り1杯', grams: 16 },
]

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const isWeekendDate = d => [0, 6].includes(d.getDay())
function dKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function lastNDays(n) {
  const out = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getTime() - i * DAY_MS))
  return out
}

function DrinkTracker({ userId }) {
  const { entries, goal, loading, addDrink, removeLastToday, markSober, updateGoals } = useDrinkTracker(userId)
  const [customAmt, setCustomAmt] = useState('')

  const todayKey = dKey(new Date())
  const todayIsWeekend = isWeekendDate(new Date())
  const todayGoal = todayIsWeekend ? Number(goal.weekend_grams) : Number(goal.weekday_grams)

  const totalsByDate = useMemo(() => {
    const map = {}
    for (const e of entries) {
      map[e.entry_date] = (map[e.entry_date] ?? 0) + Number(e.grams)
    }
    return map
  }, [entries])

  const todayTotal = totalsByDate[todayKey] ?? 0
  const todayCount = entries.filter(e => e.entry_date === todayKey).length

  const week = useMemo(() => lastNDays(7), [])
  const weekTotals = useMemo(() => week.map(d => {
    const key = dKey(d)
    return { date: d, key, total: totalsByDate[key] ?? 0, weekend: isWeekendDate(d) }
  }), [week, totalsByDate])

  const soberStreak = useMemo(() => {
    let streak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = dKey(d)
      if ((totalsByDate[key] ?? 0) === 0) streak++
      else break
    }
    return streak
  }, [totalsByDate])

  const weekdayAvg = useMemo(() => {
    const wd = weekTotals.filter(d => !d.weekend)
    if (!wd.length) return 0
    return wd.reduce((s, d) => s + d.total, 0) / wd.length
  }, [weekTotals])

  const weekendAvg = useMemo(() => {
    const we = weekTotals.filter(d => d.weekend)
    if (!we.length) return 0
    return we.reduce((s, d) => s + d.total, 0) / we.length
  }, [weekTotals])

  const maxTotal = Math.max(1, ...weekTotals.map(d => d.total), Number(goal.weekday_grams), Number(goal.weekend_grams))

  function addCustom() {
    const v = parseFloat(customAmt)
    if (!v || v <= 0) return
    addDrink({ grams: v, label: '手入力' })
    setCustomAmt('')
  }

  if (loading) {
    return <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
  }

  return (
    <div className="space-y-4">
      {/* 今日のカード */}
      <div className="ios-card px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#8E8E93]">
            今日・{WEEKDAY_LABELS[new Date().getDay()]}曜日（{todayIsWeekend ? '休日' : '平日'}）
          </p>
          <p className={`text-[13px] font-medium ${todayTotal > todayGoal ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>
            目安 {todayGoal}g
          </p>
        </div>

        <div className="flex items-end gap-2 mt-1">
          <span className="text-[40px] font-bold text-[#1C1C1E] leading-none tabular-nums">{todayTotal}</span>
          <span className="text-[14px] text-[#8E8E93] pb-1">g 純アルコール</span>
        </div>

        <div className="mt-3 h-2 rounded-full bg-[#767680]/15 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${todayTotal > todayGoal ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`}
            style={{ width: `${Math.min(100, (todayTotal / todayGoal) * 100)}%` }}
          />
        </div>

        {/* プリセットボタン */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {DRINK_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => addDrink({ grams: p.grams, label: `${p.label}(${p.sub})` })}
              className="text-left px-3 py-2.5 rounded-[10px] bg-black/[0.03] active:bg-black/[0.06] transition-colors"
            >
              <p className="text-[14px] font-semibold text-[#1C1C1E]">{p.label}</p>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">{p.sub} ・ {p.grams}g</p>
            </button>
          ))}
        </div>

        {/* 手入力 */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            inputMode="decimal"
            value={customAmt}
            onChange={e => setCustomAmt(e.target.value)}
            placeholder="純アルコール量(g)を直接入力"
            className="flex-1 px-3 py-2.5 rounded-[10px] bg-black/[0.03] text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
          />
          <button
            onClick={addCustom}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold active:opacity-70 transition-opacity"
          >
            追加
          </button>
        </div>

        {/* 取り消し・休肝日 */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={removeLastToday}
            disabled={todayCount === 0}
            className="flex-1 py-2 rounded-[10px] text-[13px] text-[#1C1C1E] bg-black/[0.03] disabled:text-[#C7C7CC] active:opacity-70 transition-opacity"
          >
            直前の記録を取り消す
          </button>
          <button
            onClick={markSober}
            className="flex-1 py-2 rounded-[10px] text-[13px] font-medium text-[#34C759] bg-[#34C759]/10 active:opacity-70 transition-opacity"
          >
            休肝日にする
          </button>
        </div>
      </div>

      {soberStreak > 0 && (
        <p className="text-center text-[13px] text-[#34C759] font-medium">
          🎉 休肝日が {soberStreak} 日続いています
        </p>
      )}

      {/* 週チャート */}
      <div className="ios-card px-4 py-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] mb-3">直近7日間</p>
        <div className="flex items-end gap-2 h-[110px]">
          {weekTotals.map(d => {
            const g = d.weekend ? Number(goal.weekend_grams) : Number(goal.weekday_grams)
            const h = Math.max(3, (d.total / maxTotal) * 96)
            const barColor = d.total === 0
              ? 'bg-[#E5E5EA]'
              : d.total > g
                ? 'bg-[#FF3B30]'
                : d.weekend
                  ? 'bg-[#FF9500]'
                  : 'bg-[#007AFF]'
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#AEAEB2] tabular-nums">{d.total || ''}</span>
                <div className="w-full h-24 flex items-end relative">
                  <div
                    className="absolute w-full border-t border-dashed border-[#C7C7CC]"
                    style={{ bottom: `${Math.min(100, (g / maxTotal) * 100)}%` }}
                  />
                  <div className={`w-full rounded-[3px] ${barColor}`} style={{ height: `${h}px` }} />
                </div>
                <span className={`text-[10px] ${d.weekend ? 'text-[#FF9500] font-medium' : 'text-[#8E8E93]'}`}>
                  {WEEKDAY_LABELS[d.date.getDay()]}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-[#8E8E93] flex-wrap">
          <span><span className="text-[#007AFF]">■</span> 平日</span>
          <span><span className="text-[#FF9500]">■</span> 休日</span>
          <span><span className="text-[#FF3B30]">■</span> 目安超過</span>
          <span>- - - 目安ライン</span>
        </div>
      </div>

      {/* 平均 */}
      <div className="flex gap-3">
        <div className="flex-1 ios-card px-4 py-3">
          <p className="text-[12px] text-[#8E8E93]">平日 平均</p>
          <p className="text-[22px] font-bold text-[#1C1C1E] mt-0.5 tabular-nums">{weekdayAvg.toFixed(0)}g</p>
        </div>
        <div className="flex-1 ios-card px-4 py-3">
          <p className="text-[12px] text-[#8E8E93]">休日 平均</p>
          <p className="text-[22px] font-bold text-[#1C1C1E] mt-0.5 tabular-nums">{weekendAvg.toFixed(0)}g</p>
        </div>
      </div>

      {/* 目安量設定 */}
      <div className="ios-card px-4 py-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] mb-3">1日あたりの目安量</p>
        <div className="flex gap-3">
          <label className="flex-1 text-[12px] text-[#8E8E93]">
            平日 (g)
            <input
              type="number"
              value={goal.weekday_grams}
              onChange={e => updateGoals({ weekday_grams: Number(e.target.value) || 0 })}
              className="block w-full mt-1.5 px-3 py-2 rounded-[8px] bg-black/[0.03] text-[14px] text-[#1C1C1E] focus:outline-none"
            />
          </label>
          <label className="flex-1 text-[12px] text-[#8E8E93]">
            休日 (g)
            <input
              type="number"
              value={goal.weekend_grams}
              onChange={e => updateGoals({ weekend_grams: Number(e.target.value) || 0 })}
              className="block w-full mt-1.5 px-3 py-2 rounded-[8px] bg-black/[0.03] text-[14px] text-[#1C1C1E] focus:outline-none"
            />
          </label>
        </div>
        <p className="text-[11px] text-[#AEAEB2] mt-3 leading-relaxed">
          参考: 厚生労働省の指針では、生活習慣病のリスクを高める飲酒量は男性で1日あたり純アルコール40g以上とされています。まずは無理のない目安から始めるのがおすすめです。
        </p>
      </div>
    </div>
  )
}

// ── 体重トラッカー（プランのサブ機能） ──
function WeightTracker({ userId }) {
  const { entries, goal, loading, recordToday, deleteEntry, updateGoal } = useWeightTracker(userId)
  const [input, setInput] = useState('')
  const [targetInput, setTargetInput] = useState('')

  const todayKey = dKey(new Date())
  const todayEntry = entries.find(e => e.entry_date === todayKey)
  const sorted = useMemo(() => [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date)), [entries])
  const latest = sorted[sorted.length - 1] ?? null
  const chartEntries = sorted.slice(-30)

  const weekAgoEntry = useMemo(() => {
    const target = new Date()
    target.setDate(target.getDate() - 7)
    const targetKey = dKey(target)
    // 7日前以前で最も近い記録
    const candidates = sorted.filter(e => e.entry_date <= targetKey)
    return candidates[candidates.length - 1] ?? null
  }, [sorted])

  const weekDiff = latest && weekAgoEntry ? Number(latest.weight_kg) - Number(weekAgoEntry.weight_kg) : null
  const targetKg = goal.target_kg != null ? Number(goal.target_kg) : null
  const targetDiff = latest && targetKg != null ? Number(latest.weight_kg) - targetKg : null

  function handleRecord() {
    const v = parseFloat(input || todayEntry?.weight_kg)
    if (!v || v <= 0) return
    recordToday(v)
    setInput('')
  }

  function handleSetTarget() {
    const v = parseFloat(targetInput)
    if (!v || v <= 0) return
    updateGoal(v)
    setTargetInput('')
  }

  // 折れ線グラフ用の座標計算
  const chart = useMemo(() => {
    if (chartEntries.length < 2) return null
    const values = chartEntries.map(e => Number(e.weight_kg))
    const min = Math.min(...values, targetKg ?? Infinity)
    const max = Math.max(...values, targetKg ?? -Infinity)
    const pad = Math.max(0.5, (max - min) * 0.15)
    const lo = min - pad
    const hi = max + pad
    const w = 100
    const h = 100
    const points = chartEntries.map((e, i) => {
      const x = chartEntries.length === 1 ? 0 : (i / (chartEntries.length - 1)) * w
      const y = h - ((Number(e.weight_kg) - lo) / (hi - lo)) * h
      return { x, y, e }
    })
    const targetY = targetKg != null ? h - ((targetKg - lo) / (hi - lo)) * h : null
    return { points, targetY }
  }, [chartEntries, targetKg])

  if (loading) {
    return <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
  }

  return (
    <div className="space-y-4">
      {/* 記録カード */}
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] text-[#8E8E93]">今日の体重</p>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-[40px] font-bold text-[#1C1C1E] leading-none tabular-nums">
            {latest ? Number(latest.weight_kg).toFixed(1) : '—'}
          </span>
          <span className="text-[14px] text-[#8E8E93] pb-1">kg{latest && latest.entry_date !== todayKey ? `（${latest.entry_date.slice(5).replace('-', '/')}時点）` : ''}</span>
        </div>

        {(weekDiff != null || targetDiff != null) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {weekDiff != null && (
              <span className={`text-[12px] font-medium ${weekDiff > 0 ? 'text-[#FF3B30]' : weekDiff < 0 ? 'text-[#34C759]' : 'text-[#8E8E93]'}`}>
                7日前比 {weekDiff > 0 ? '+' : ''}{weekDiff.toFixed(1)}kg
              </span>
            )}
            {targetDiff != null && (
              <span className={`text-[12px] font-medium ${targetDiff > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>
                目標まで {targetDiff > 0 ? `+${targetDiff.toFixed(1)}kg` : `達成 (${Math.abs(targetDiff).toFixed(1)}kg 超過達成)`}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={todayEntry ? `${Number(todayEntry.weight_kg).toFixed(1)}（今日記録済み）` : '体重(kg)を入力'}
            className="flex-1 px-3 py-2.5 rounded-[10px] bg-black/[0.03] text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
          />
          <button
            onClick={handleRecord}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold active:opacity-70 transition-opacity"
          >
            {todayEntry ? '更新' : '記録'}
          </button>
        </div>
      </div>

      {/* 推移グラフ */}
      <div className="ios-card px-4 py-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] mb-3">
          推移（直近{chartEntries.length}件）
        </p>
        {!chart ? (
          <p className="text-[13px] text-[#AEAEB2] py-6 text-center">記録が2件以上になるとグラフが表示されます</p>
        ) : (
          <div className="relative h-[140px]">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              {chart.targetY != null && (
                <line x1="0" y1={chart.targetY} x2="100" y2={chart.targetY}
                  stroke="#C7C7CC" strokeWidth="0.6" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
              )}
              <polyline
                fill="none"
                stroke="#007AFF"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chart.points.map(p => `${p.x},${p.y}`).join(' ')}
              />
              {chart.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.4" fill="#007AFF" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
        )}
        {chartEntries.length > 0 && (
          <div className="flex items-center justify-between mt-2 text-[10px] text-[#AEAEB2]">
            <span>{chartEntries[0].entry_date.slice(5).replace('-', '/')}</span>
            <span>{chartEntries[chartEntries.length - 1].entry_date.slice(5).replace('-', '/')}</span>
          </div>
        )}
      </div>

      {/* 目標体重設定 */}
      <div className="ios-card px-4 py-4">
        <p className="text-[12px] font-semibold text-[#8E8E93] mb-3">目標体重</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            placeholder={targetKg != null ? `${targetKg.toFixed(1)} kg` : '目標体重(kg)を入力'}
            className="flex-1 px-3 py-2.5 rounded-[10px] bg-black/[0.03] text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none"
          />
          <button
            onClick={handleSetTarget}
            className="flex-shrink-0 px-4 py-2.5 rounded-[10px] bg-[#007AFF] text-white text-[14px] font-semibold active:opacity-70 transition-opacity"
          >
            設定
          </button>
        </div>
      </div>
    </div>
  )
}

const GOAL_SUB_FEATURES = [
  { id: 'goals',  label: '目標' },
  { id: 'drinks', label: '🍺 飲酒' },
  { id: 'weight', label: '⚖️ 体重' },
]

export default function GoalsPage({ embedded, categories = [], filterCategory, onFilterChange }) {
  const { user } = useAuth()
  const { goals, loading, addGoal, updateGoal, deleteGoal } = useGoals(user?.id)
  const [modal, setModal] = useState(null)
  const [sub, setSub] = useState('goals')

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

  const subNav = (
    <div className="flex gap-2 mb-3">
      {GOAL_SUB_FEATURES.map(f => (
        <button
          key={f.id}
          onClick={() => setSub(f.id)}
          className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-colors duration-150 ${
            sub === f.id
              ? 'bg-[#1C1C1E] text-white'
              : 'bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )

  const goalsContent = (
    <>
      {/* モバイル カテゴリピル */}
      {embedded && (
        <div className="md:hidden sticky top-below-header z-[5] -mx-4 px-4 pt-2 pb-2.5 bg-[#F2F2F7]/85 backdrop-blur-xl flex gap-2 overflow-x-auto">
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

  const content = (
    <>
      {subNav}
      {sub === 'drinks' ? <DrinkTracker userId={user?.id} />
        : sub === 'weight' ? <WeightTracker userId={user?.id} />
        : goalsContent}
    </>
  )

  return (
    <>
      {embedded ? (
        <div>
          <main className="max-w-lg md:max-w-5xl mx-auto px-4 py-4 pb-28 md:pb-10 md:flex md:gap-8 md:items-start">
            {/* PC サイドバー */}
            {sub === 'goals' && (
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
            )}
            <div className="flex-1 min-w-0">{content}</div>
          </main>
          {/* モバイル FAB */}
          {sub === 'goals' && (
          <button
            onClick={openNew}
            className="md:hidden fixed bottom-20 right-5 w-[54px] h-[54px] bg-[#007AFF] text-white rounded-full shadow-[0_4px_16px_rgba(0,122,255,0.4)] flex items-center justify-center active:scale-90 transition-transform z-30"
            aria-label="目標を追加"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
            </svg>
          </button>
          )}
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
