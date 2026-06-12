import { useState } from 'react'

const EVENT_COLORS = [
  { value: '#007AFF', label: 'ブルー' },
  { value: '#AF52DE', label: 'パープル' },
  { value: '#34C759', label: 'グリーン' },
  { value: '#FF3B30', label: 'レッド' },
  { value: '#FF9500', label: 'オレンジ' },
  { value: '#FF2D55', label: 'ピンク' },
  { value: '#5AC8FA', label: 'ライトブルー' },
]

function pad(n) { return String(n).padStart(2, '0') }
function toDateTimeLocal(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toDateInput(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function EventForm({ initialDate, event, onSave, onDelete, onClose }) {
  const isEdit = !!event

  const defaultDate = initialDate
    ? `${initialDate.getFullYear()}-${pad(initialDate.getMonth()+1)}-${pad(initialDate.getDate())}`
    : toDateInput(new Date())

  const [title, setTitle] = useState(event?.title ?? '')
  const [allDay, setAllDay] = useState(event?.all_day ?? true)
  const [startDate, setStartDate] = useState(event ? (event.all_day ? toDateInput(event.start_at) : toDateTimeLocal(event.start_at)) : (allDay ? defaultDate : `${defaultDate}T09:00`))
  const [endDate, setEndDate] = useState(event ? (event.end_at ? (event.all_day ? toDateInput(event.end_at) : toDateTimeLocal(event.end_at)) : '') : '')
  const [color, setColor] = useState(event?.color ?? '#007AFF')
  const [memo, setMemo] = useState(event?.memo ?? '')
  const [saving, setSaving] = useState(false)

  function handleAllDayToggle() {
    const next = !allDay
    setAllDay(next)
    if (next) {
      // time → allDay: extract date part
      setStartDate(startDate.slice(0, 10))
      setEndDate(endDate ? endDate.slice(0, 10) : '')
    } else {
      // allDay → time: build datetime
      setStartDate(`${startDate}T09:00`)
      setEndDate(endDate ? `${endDate}T10:00` : '')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    let start_at, end_at
    if (allDay) {
      start_at = new Date(startDate + 'T00:00').toISOString()
      end_at = endDate ? new Date(endDate + 'T00:00').toISOString() : null
    } else {
      start_at = new Date(startDate).toISOString()
      end_at = endDate ? new Date(endDate).toISOString() : null
    }

    await onSave({ title: title.trim(), all_day: allDay, start_at, end_at, color, memo: memo.trim() || null })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm(`「${event.title}」を削除しますか？`)) return
    await onDelete(event.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg md:max-w-md bg-[#F2F2F7] rounded-t-[20px] md:rounded-[20px] shadow-xl overflow-hidden">
        {/* シートヘッダー */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-[#F2F2F7]">
          <button onClick={onClose} className="ios-toolbar-btn">キャンセル</button>
          <span className="text-[17px] font-semibold text-[#1C1C1E]">{isEdit ? '予定を編集' : '予定を追加'}</span>
          <button
            form="event-form"
            type="submit"
            disabled={saving || !title.trim()}
            className="ios-toolbar-btn font-semibold disabled:opacity-40"
          >
            {saving ? '保存中…' : isEdit ? '完了' : '追加'}
          </button>
        </div>

        <form id="event-form" onSubmit={handleSubmit}>
          <div className="px-4 pb-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* タイトル */}
            <div className="ios-card overflow-hidden">
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="タイトル"
                className="w-full px-4 py-3.5 text-[16px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none"
              />
            </div>

            {/* 終日トグル＋日時 */}
            <div className="ios-card overflow-hidden divide-y divide-black/[0.05]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] text-[#1C1C1E]">終日</span>
                <button
                  type="button"
                  onClick={handleAllDayToggle}
                  className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${allDay ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
                >
                  <span className={`absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ${allDay ? 'translate-x-[21px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>

              <div className="flex items-center px-4 py-3 gap-3">
                <span className="text-[15px] text-[#1C1C1E] w-10 flex-shrink-0">開始</span>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 text-[15px] text-[#007AFF] bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center px-4 py-3 gap-3">
                <span className="text-[15px] text-[#1C1C1E] w-10 flex-shrink-0">終了</span>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 text-[15px] text-[#007AFF] bg-transparent focus:outline-none"
                  placeholder="任意"
                />
              </div>
            </div>

            {/* カラー */}
            <div className="ios-card px-4 py-3">
              <p className="text-[13px] text-[#8E8E93] mb-3">カラー</p>
              <div className="flex gap-3 flex-wrap">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className="relative w-8 h-8 rounded-full transition-transform active:scale-90"
                    style={{ backgroundColor: c.value }}
                  >
                    {color === c.value && (
                      <svg className="absolute inset-0 m-auto w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* メモ */}
            <div className="ios-card overflow-hidden">
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="メモ（任意）"
                rows={3}
                className="w-full px-4 py-3.5 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent focus:outline-none resize-none"
              />
            </div>

            {/* 削除ボタン（編集時のみ） */}
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-3 rounded-[12px] text-[15px] text-[#FF3B30] font-medium bg-[#FF3B30]/[0.08] active:opacity-70 transition-opacity"
              >
                予定を削除
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
