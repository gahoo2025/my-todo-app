import { useState, useMemo } from 'react'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

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

export default function CalendarView({ tasks, categories, onEdit }) {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const { year, month } = current
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

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
          const dayTasks = activeTasks
            .map(t => ({ task: t, info: getTaskDayInfo(t, date) }))
            .filter(x => x.info !== null)

          return (
            <div
              key={idx}
              className={`min-h-[76px] md:min-h-[96px] border-b border-r border-black/[0.04] last:border-r-0 p-1 ${
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
                      : dow === 0 ? 'text-[#FF3B30]/80' : dow === 6 ? 'text-[#007AFF]/80' : 'text-[#1C1C1E]'
                }`}>
                  {date.getDate()}
                </span>
              </div>

              {/* タスクチップ */}
              <div className="space-y-[3px]">
                {dayTasks.slice(0, 3).map(({ task, info }) => {
                  const color = getCategoryColor(task.category, categories)
                  return (
                    <button
                      key={task.id}
                      onClick={() => onEdit(task)}
                      className={`w-full flex items-center gap-1 text-left text-[10px] font-medium leading-tight px-1 py-[3px] transition-opacity hover:opacity-70 active:opacity-50 ${color.bg} ${color.text} ${
                        info.isSpan
                          ? `${info.isStart ? 'rounded-l-[5px] ml-0.5' : ''} ${info.isEnd ? 'rounded-r-[5px] mr-0.5' : ''}`
                          : 'rounded-[5px] mx-0.5'
                      }`}
                    >
                      {(info.isStart || !info.isSpan) && (
                        <span className={`flex-shrink-0 w-[3px] h-[10px] rounded-full ${color.bar}`} />
                      )}
                      <span className="truncate">
                        {info.isStart || !info.isSpan ? task.title : ' '}
                      </span>
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-[#AEAEB2] text-center">+{dayTasks.length - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
