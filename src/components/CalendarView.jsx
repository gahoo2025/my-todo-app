import { useState, useMemo } from 'react'
import holidayJp from '@holiday-jp/holiday_jp'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// 月の祝日マップを返す（キー: "YYYY-M-D"）
function buildHolidayMap(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const holidays = holidayJp.between(first, last)
  const map = {}
  holidays.forEach(h => {
    const d = new Date(h.date)
    map[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = h.name
  })
  return map
}

// iOSカレンダー風のイベントカラーパレット
const CATEGORY_COLORS = [
  { bg: 'bg-[#007AFF]/12', text: 'text-[#007AFF]', bar: 'bg-[#007AFF]' },
  { bg: 'bg-[#AF52DE]/12', text: 'text-[#AF52DE]', bar: 'bg-[#AF52DE]' },
  { bg: 'bg-[#34C759]/14', text: 'text-[#248A3D]', bar: 'bg-[#34C759]' },
  { bg: 'bg-[#FF3B30]/12', text: 'text-[#FF3B30]', bar: 'bg-[#FF3B30]' },
  { bg: 'bg-[#FF9500]/14', text: 'text-[#C93400]', bar: 'bg-[#FF9500]' },
  { bg: 'bg-[#5AC8FA]/16', text: 'text-[#0071A4]', bar: 'bg-[#5AC8FA]' },
  { bg: 'bg-[#FF2D55]/12', text: 'text-[#FF2D55]', bar: 'bg-[#FF2D55]' },
]

function getCategoryColor(categoryName, categories) {
  const idx = categories.findIndex(c => c.name === categoryName)
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length]
}

// タスクが対象日に表示されるか判定し、そのメタ情報を返す
function getTaskDayInfo(task, date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)

  if (task.start_at || task.end_at) {
    const start = task.start_at ? new Date(task.start_at) : null
    const end = task.end_at ? new Date(task.end_at) : null
    const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null
    const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null

    if (startDay && endDay) {
      if (startDay > d || endDay < d) return null
      return { isStart: +startDay === +d, isEnd: +endDay === +d, isSpan: +startDay !== +endDay }
    }
    if (startDay) return +startDay === +d ? { isStart: true, isEnd: true, isSpan: false } : null
    if (endDay) return +endDay === +d ? { isStart: true, isEnd: true, isSpan: false } : null
  }

  if (task.due_date) {
    const due = new Date(task.due_date + 'T00:00')
    if (+new Date(due.getFullYear(), due.getMonth(), due.getDate()) === +d)
      return { isStart: true, isEnd: true, isSpan: false }
  }
  return null
}

// 予定が対象日に表示されるか判定
function getEventDayInfo(event, date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const start = new Date(event.start_at)
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  if (event.end_at) {
    const end = new Date(event.end_at)
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    if (startDay > d || endDay < d) return null
    return { isStart: +startDay === +d, isEnd: +endDay === +d, isSpan: +startDay !== +endDay }
  }
  if (+startDay === +d) return { isStart: true, isEnd: true, isSpan: false }
  return null
}

export default function CalendarView({ tasks, events, categories, onEdit, onDayPress, onAddEvent }) {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const { year, month } = current
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const holidayMap = useMemo(() => buildHolidayMap(year, month), [year, month])

  // カレンダーグリッド（前月末 padding 込み）
  const cells = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDay.getDay(); i++) {
      const d = new Date(year, month, -firstDay.getDay() + i + 1)
      days.push({ date: d, currentMonth: false })
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), currentMonth: true })
    }
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        days.push({ date: new Date(year, month + 1, d), currentMonth: false })
      }
    }
    return days
  }, [year, month])

  function prevMonth() {
    setCurrent(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  function nextMonth() {
    setCurrent(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }
  function goToday() {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() })
  }

  const activeTasks = tasks.filter(t => !t.completed)

  return (
    <div className="ios-card overflow-hidden">
      {/* カレンダーヘッダー */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[17px] font-bold text-[#1C1C1E] tracking-tight">
          {year}年{month + 1}月
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddEvent(new Date(year, month, today.getDate()))}
            className="text-[13px] font-medium text-[#007AFF] px-2.5 py-1 rounded-full active:opacity-50 transition-opacity"
          >
            ＋ 予定
          </button>
          <button onClick={goToday}
            className="text-[13px] font-medium text-[#007AFF] px-2.5 py-1 rounded-full active:opacity-50 transition-opacity">
            今日
          </button>
          <button onClick={prevMonth} className="ios-icon-btn text-[#007AFF]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={nextMonth} className="ios-icon-btn text-[#007AFF]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-black/[0.06]">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`pb-2 text-center text-[11px] font-semibold ${
            i === 0 ? 'text-[#FF3B30]/70' : i === 6 ? 'text-[#007AFF]/70' : 'text-[#8E8E93]'
          }`}>{w}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, currentMonth }, idx) => {
          const isToday = date.toDateString() === today.toDateString()
          const dow = date.getDay()
          const holidayName = holidayMap[`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`]
          const isHoliday = !!holidayName
          const dayTasks = activeTasks
            .map(t => ({ task: t, info: getTaskDayInfo(t, date) }))
            .filter(x => x.info !== null)
          const dayEvents = (events || [])
            .map(e => ({ event: e, info: getEventDayInfo(e, date) }))
            .filter(x => x.info !== null)

          const totalItems = dayTasks.length + dayEvents.length
          // 予定→タスクの順で最大3件表示
          const allItems = [
            ...dayEvents.map(x => ({ kind: 'event', ...x })),
            ...dayTasks.map(x => ({ kind: 'task', ...x })),
          ]

          return (
            <button
              key={idx}
              onClick={() => onDayPress(date)}
              className={`min-h-[76px] md:min-h-[96px] border-b border-r border-black/[0.04] last:border-r-0 p-1 text-left active:bg-black/[0.03] transition-colors ${
                !currentMonth ? 'bg-[#F2F2F7]/60' : ''
              }`}
            >
              {/* 日付数字 */}
              <div className="flex justify-center mb-1">
                <span className={`w-[22px] h-[22px] flex items-center justify-center rounded-full text-[12px] font-medium tabular-nums ${
                  isToday
                    ? 'bg-[#FF3B30] text-white font-semibold'
                    : !currentMonth
                      ? 'text-[#C7C7CC]'
                      : (dow === 0 || isHoliday) ? 'text-[#FF3B30]/80' : dow === 6 ? 'text-[#007AFF]/80' : 'text-[#1C1C1E]'
                }`}>
                  {date.getDate()}
                </span>
              </div>

              {/* 祝日名 */}
              {holidayName && currentMonth && (
                <p className="text-[8px] leading-tight text-[#FF3B30]/80 text-center truncate px-0.5 mb-0.5">
                  {holidayName}
                </p>
              )}

              {/* 予定・タスクチップ */}
              <div className="space-y-[3px]">
                {allItems.slice(0, 3).map(item => {
                  if (item.kind === 'event') {
                    const { event, info } = item
                    return (
                      <div
                        key={`ev-${event.id}`}
                        className={`w-full flex items-center gap-1 text-[10px] font-medium leading-tight px-1 py-[3px] ${
                          info.isSpan
                            ? `${info.isStart ? 'rounded-l-[5px] ml-0.5' : ''} ${info.isEnd ? 'rounded-r-[5px] mr-0.5' : ''}`
                            : 'rounded-[5px] mx-0.5'
                        }`}
                        style={{ backgroundColor: `${event.color}20`, color: event.color }}
                      >
                        {(info.isStart || !info.isSpan) && (
                          <span className="flex-shrink-0 w-[3px] h-[10px] rounded-full" style={{ backgroundColor: event.color }} />
                        )}
                        <span className="truncate">
                          {info.isStart || !info.isSpan ? event.title : ' '}
                        </span>
                      </div>
                    )
                  }
                  const { task, info } = item
                  const color = getCategoryColor(task.category, categories)
                  return (
                    <div
                      key={`task-${task.id}`}
                      className={`w-full flex items-center gap-1 text-[10px] font-medium leading-tight px-1 py-[3px] ${color.bg} ${color.text} ${
                        info.isSpan
                          ? `${info.isStart ? 'rounded-l-[5px] ml-0.5' : ''} ${info.isEnd ? 'rounded-r-[5px] mr-0.5' : ''}`
                          : 'rounded-[5px] mx-0.5'
                      }`}
                    >
                      {(info.isStart || !info.isSpan) && (
                        <span className={`flex-shrink-0 w-[3px] h-[10px] rounded-full ${color.bar}`} />
                      )}
                      <span className="truncate">
                        {info.isStart || !info.isSpan ? task.title : ' '}
                      </span>
                    </div>
                  )
                })}
                {totalItems > 3 && (
                  <p className="text-[10px] text-[#AEAEB2] text-center">+{totalItems - 3}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
