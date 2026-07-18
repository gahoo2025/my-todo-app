import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useExerciseTracker } from '../hooks/useExerciseTracker'

function dKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return dKey(new Date()) }

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${wd})`
}

// ── メニュー項目 追加・編集モーダル ──
function MenuItemModal({ item, onSave, onDelete, onClose }) {
  const isNew = !item.id
  const [name, setName] = useState(item.name ?? '')
  const [targetValue, setTargetValue] = useState(item.target_value ?? '')
  const [unit, setUnit] = useState(item.unit ?? '回')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      target_value: targetValue !== '' ? Number(targetValue) : null,
      unit: unit.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm('このメニューを削除しますか？（過去の実施記録は残ります）')) return
    await onDelete()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{isNew ? 'メニューを追加' : 'メニューを編集'}</h2>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="ios-card overflow-hidden">
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="種目名（例: 腕立て伏せ、ランニング）"
              className="w-full px-4 py-3 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
            />
          </div>

          <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">目標値</span>
              <input
                type="number"
                inputMode="decimal"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="未設定"
                className="w-24 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[15px] text-[#1C1C1E]">単位</span>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="回・分・kmなど"
                className="w-24 min-w-0 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none text-right"
              />
            </div>
          </div>

          {!isNew && (
            <button
              onClick={handleDelete}
              className="w-full py-3 rounded-[12px] text-[#FF3B30] text-[15px] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
            >
              メニューを削除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 実施記録の入力（メニュー行から開く軽量モーダル） ──
function LogModal({ menuItem, onSave, onClose }) {
  const [value, setValue] = useState(menuItem.target_value ?? '')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({
      menuItemId: menuItem.id,
      name: menuItem.name,
      value: value !== '' ? Number(value) : null,
      unit: menuItem.unit,
      logDate: todayStr(),
      memo: memo.trim(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-end md:items-center md:justify-center z-40" onClick={onClose}>
      <div
        className="w-full bg-[#F2F2F7] rounded-t-[16px] md:rounded-[16px] max-w-lg mx-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#F2F2F7]/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-black/5 rounded-t-[16px]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <h2 className="text-[16px] font-semibold text-[#1C1C1E]">{menuItem.name}を記録</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ios-toolbar-btn font-semibold disabled:opacity-30"
          >
            {saving ? '保存中…' : '記録'}
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="ios-card overflow-hidden flex items-center justify-between px-4 py-3">
            <span className="text-[15px] text-[#1C1C1E]">実施量</span>
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-24 min-w-0 text-[18px] font-semibold text-[#1C1C1E] bg-transparent focus:outline-none text-right"
              />
              <span className="text-[14px] text-[#8E8E93]">{menuItem.unit}</span>
            </div>
          </div>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="メモ（任意）"
            rows={2}
            className="w-full px-4 py-3 rounded-[10px] bg-black/[0.03] text-[14px] text-[#1C1C1E] placeholder:text-[#AEAEB2] focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  )
}

function MenuRow({ item, todayValue, onLog, onEdit }) {
  const done = item.target_value != null && todayValue >= Number(item.target_value)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
        <p className="text-[15px] font-medium text-[#1C1C1E]">{item.name}</p>
        <p className="text-[12px] text-[#8E8E93] mt-0.5">
          {item.target_value != null ? `目標 ${item.target_value}${item.unit ?? ''}` : (item.unit ?? '目標未設定')}
          {todayValue > 0 && (
            <span className={`ml-2 font-medium ${done ? 'text-[#34C759]' : 'text-[#007AFF]'}`}>
              今日 {todayValue}{item.unit ?? ''}{done ? ' ✓' : ''}
            </span>
          )}
        </p>
      </button>
      <button
        onClick={() => onLog(item)}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center active:opacity-70 transition-opacity"
        aria-label="記録"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>
    </div>
  )
}

export default function ExerciseTracker() {
  const { user } = useAuth()
  const { menuItems, logs, loading, addMenuItem, updateMenuItem, deleteMenuItem, addLog, deleteLog } = useExerciseTracker(user?.id)
  const [menuModal, setMenuModal] = useState(null)
  const [logModalItem, setLogModalItem] = useState(null)

  const todayTotals = useMemo(() => {
    const map = {}
    const today = todayStr()
    for (const l of logs) {
      if (l.log_date !== today || !l.menu_item_id) continue
      map[l.menu_item_id] = (map[l.menu_item_id] ?? 0) + Number(l.value ?? 0)
    }
    return map
  }, [logs])

  const groupedHistory = useMemo(() => {
    const groups = {}
    for (const l of logs) {
      (groups[l.log_date] ??= []).push(l)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [logs])

  async function handleSaveMenu(data) {
    if (menuModal.item.id) await updateMenuItem(menuModal.item.id, data)
    else await addMenuItem(data)
  }

  if (loading) {
    return <div className="text-center py-20 text-[#AEAEB2] text-[13px]">読み込み中…</div>
  }

  return (
    <div className="space-y-4">
      {/* 今日のメニュー */}
      <div className="ios-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-[13px] font-semibold text-[#8E8E93]">今日のメニュー</p>
          <button
            onClick={() => setMenuModal({ item: {} })}
            className="text-[13px] font-medium text-[#007AFF] active:opacity-50 transition-opacity"
          >
            ＋ メニュー追加
          </button>
        </div>
        {menuItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[#AEAEB2]">
            まだメニューがありません。「＋ メニュー追加」から登録できます。
          </p>
        ) : (
          <div className="divide-y divide-black/[0.04] mt-1">
            {menuItems.map(item => (
              <MenuRow
                key={item.id}
                item={item}
                todayValue={todayTotals[item.id] ?? 0}
                onLog={setLogModalItem}
                onEdit={item => setMenuModal({ item })}
              />
            ))}
          </div>
        )}
      </div>

      {/* 履歴 */}
      <div className="ios-card px-4 py-4">
        <p className="text-[13px] font-semibold text-[#8E8E93] mb-2">実施履歴</p>
        {groupedHistory.length === 0 ? (
          <p className="text-[13px] text-[#AEAEB2] py-4 text-center">まだ記録がありません</p>
        ) : (
          <div className="space-y-3">
            {groupedHistory.map(([date, items]) => (
              <div key={date}>
                <p className="text-[12px] font-medium text-[#8E8E93] mb-1">{formatDateLabel(date)}</p>
                <div className="space-y-1">
                  {items.map(l => (
                    <div key={l.id} className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-[#1C1C1E]">
                        {l.name}
                        {l.value != null && <span className="text-[#8E8E93] ml-1.5">{l.value}{l.unit ?? ''}</span>}
                        {l.memo && <span className="text-[#AEAEB2] ml-1.5">（{l.memo}）</span>}
                      </span>
                      <button
                        onClick={() => deleteLog(l.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[#C7C7CC] hover:text-[#FF3B30] active:opacity-60 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {menuModal && (
        <MenuItemModal
          item={menuModal.item}
          onSave={handleSaveMenu}
          onDelete={() => deleteMenuItem(menuModal.item.id)}
          onClose={() => setMenuModal(null)}
        />
      )}
      {logModalItem && (
        <LogModal
          menuItem={logModalItem}
          onSave={addLog}
          onClose={() => setLogModalItem(null)}
        />
      )}
    </div>
  )
}
