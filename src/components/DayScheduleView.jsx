import { useMemo } from 'react'

function pad(n) { return String(n).padStart(2, '0') }

function isSameDay(date, d) {
  return date.getFullYear() === d.getFullYear() &&
    date.getMonth() === d.getMonth() &&
    date.getDate() === d.getDate()
}

function getDateRange(start, end, d) {
  const s = new Date(start)
  const e = end ? new Date(end) : s
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
  return d >= startDay && d <= endDay
}

// Format time as "HH:mm"
function fmtTime(iso) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatJa(date) {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
  return `${date.getMonth()+1}月${date.getDate()}日（${dow}）`
}

export default function DayScheduleView({ date, tasks, events, onEditTask, onEditEvent, onAddEvent, onClose }) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(); today.setHours(0,0,0,0)
  const isToday = +d === +today

  // Filter tasks for this day
  const dayTasks = useMemo(() => tasks.filter(t => {
    if (t.completed) return false
    if (t.start_at || t.end_at) {
      const start = t.start_at ? new Date(t.start_at) : null
      const end = t.end_at ? new Date(t.end_at) : null
      const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null
      const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null
      if (startDay && endDay) return d >= startDay && d <= endDay
      if (startDay) return +startDay === +d
      if (endDay) return +endDay === +d
    }
    if (t.due_date) {
      const due = new Date(t.due_date + 'T00:00')
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      return +dueDay === +d
    }
    return false
  }), [tasks, date])

  // Filter events for this day
  const dayEvents = useMemo(() => events.filter(ev => {
    const start = new Date(ev.start_at)
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    if (ev.end_at) {
      const end = new Date(ev.end_at)
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      return d >= startDay && d <= endDay
    }
    return +startDay === +d
  }), [events, date])

  // Split into all-day and timed
  const allDayEvents = dayEvents.filter(e => e.all_day)
  const timedEvents = dayEvents.filter(e => !e.all_day)

  // Tasks with time
  const timedTasks = dayTasks.filter(t => t.start_at && !t.all_day)
  const allDayTasks = dayTasks.filter(t => !t.start_at || t.all_day || t.due_date)

  // Build hour slots 0-23
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Place timed items into hour slots
  function getTimedItems(hour) {
    const items = []
    timedEvents.forEach(ev => {
      const h = new Date(ev.start_at).getHours()
      if (h === hour) items.push({ type: 'event', data: ev })
    })
    timedTasks.forEach(t => {
      const h = new Date(t.start_at).getHours()
      if (h === hour) items.push({ type: 'task', data: t })
    })
    return items
  }

  const nowHour = isToday ? new Date().getHours() : -1
  const nowMin = isToday ? new Date().getMinutes() : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F2F2F7]">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-11">
            <button
              onClick={onClose}
              className="flex items-center text-[#007AFF] active:opacity-50 transition-opacity -ml-1"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[16px]">カレンダー</span>
            </button>
            <button
              onClick={() => onAddEvent(date)}
              className="flex items-center gap-1 text-[#007AFF] text-[15px] font-medium active:opacity-50 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
              </svg>
              予定を追加
            </button>
          </div>
          <div className="pb-3 pt-1">
            <h1 className={`text-[22px] font-bold tracking-tight leading-tight ${isToday ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'}`}>
              {formatJa(date)}
              {isToday && <span className="ml-2 text-[13px] font-semibold bg-[#FF3B30] text-white px-2 py-0.5 rounded-full align-middle">今日</span>}
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-3 pb-10">
          {/* 終日エリア */}
          {(allDayEvents.length > 0 || allDayTasks.length > 0) && (
            <div className="mb-4">
              <p className="text-[12px] font-semibold text-[#8E8E93] mb-2 px-1">終日</p>
              <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
                {allDayEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onEditEvent(ev)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-60 transition-opacity"
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                    <span className="text-[15px] text-[#1C1C1E] font-medium flex-1 truncate">{ev.title}</span>
                    <span className="text-[11px] text-[#8E8E93] flex-shrink-0">予定</span>
                  </button>
                ))}
                {allDayTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-60 transition-opacity"
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0 bg-[#007AFF]" />
                    <span className="text-[15px] text-[#1C1C1E] flex-1 truncate">{t.title}</span>
                    <span className="text-[11px] text-[#8E8E93] flex-shrink-0">タスク</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 時間軸 */}
          <div className="relative">
            {hours.map(h => {
              const items = getTimedItems(h)
              const isCurrentHour = h === nowHour
              return (
                <div key={h} className="flex gap-3 min-h-[56px]">
                  {/* 時刻ラベル */}
                  <div className="w-10 flex-shrink-0 pt-0 text-right">
                    <span className={`text-[12px] tabular-nums ${isCurrentHour ? 'text-[#FF3B30] font-semibold' : 'text-[#AEAEB2]'}`}>
                      {pad(h)}:00
                    </span>
                  </div>

                  {/* 区切り線＋イベントエリア */}
                  <div className="flex-1 border-t border-black/[0.06] pt-0.5 pb-1.5 relative">
                    {/* 現在時刻ライン */}
                    {isCurrentHour && (
                      <div
                        className="absolute left-0 right-0 flex items-center z-10 pointer-events-none"
                        style={{ top: `${(nowMin / 60) * 100}%` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-[#FF3B30] -ml-1 flex-shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-[#FF3B30]" />
                      </div>
                    )}
                    {items.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => item.type === 'event' ? onEditEvent(item.data) : onEditTask(item.data)}
                        className="w-full text-left rounded-[8px] px-2.5 py-1.5 mb-1 active:opacity-60 transition-opacity"
                        style={{ backgroundColor: item.type === 'event' ? `${item.data.color}20` : '#007AFF20' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-[3px] h-full min-h-[20px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.type === 'event' ? item.data.color : '#007AFF' }}
                          />
                          <div className="min-w-0">
                            <p
                              className="text-[13px] font-medium truncate"
                              style={{ color: item.type === 'event' ? item.data.color : '#007AFF' }}
                            >
                              {item.data.title}
                            </p>
                            <p className="text-[11px] text-[#8E8E93]">
                              {fmtTime(item.data.start_at)}
                              {(item.data.end_at) && ` 〜 ${fmtTime(item.data.end_at)}`}
                              <span className="ml-1">{item.type === 'event' ? '予定' : 'タスク'}</span>
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 何もない日 */}
          {dayTasks.length === 0 && dayEvents.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#767680]/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#AEAEB2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[14px] text-[#8E8E93]">予定・タスクなし</p>
              <button
                onClick={() => onAddEvent(date)}
                className="mt-4 text-[14px] text-[#007AFF] font-medium active:opacity-50 transition-opacity"
              >
                ＋ 予定を追加
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
