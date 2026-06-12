import { useState, useMemo } from 'react'
import { formatSchedule } from '../lib/schedule'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const CATEGORY_COLORS = [
  'bg-violet-400', 'bg-blue-400', 'bg-emerald-400',
  'bg-rose-400', 'bg-amber-400', 'bg-sky-400', 'bg-pink-400',
]

function getCategoryColor(categoryName, categories) {
  const idx = categories.findIndex(c => c.name === categoryName)
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length]
}

// タスクが対象日に表示されるか判定し、そのメタ情報を返す
function getTaskDayInfo(task, date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const next = new Date(d); next.setDate(d.getDate() + 1)

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-800">
            {year}年{month + 1}月
          </h2>
          <button onClick={goToday}
            className="text-xs px-2 py-1 rounded-lg bg-violet-50 text-violet-600 font-medium hover:bg-violet-100 transition-colors">
            今日
          </button>
        </div>
        <button onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-2 text-center text-xs font-semibold ${
            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
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
              className={`min-h-[72px] md:min-h-[88px] border-b border-r border-gray-50 p-1 ${
                !currentMonth ? 'bg-gray-50/50' : ''
              }`}
            >
              {/* 日付数字 */}
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-0.5 ${
                isToday
                  ? 'text-white'
                  : !currentMonth
                    ? 'text-gray-300'
                    : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'
              }`}
                style={isToday ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}}
              >
                {date.getDate()}
              </div>

              {/* タスクチップ */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(({ task, info }) => {
                  const color = getCategoryColor(task.category, categories)
                  return (
                    <button
                      key={task.id}
                      onClick={() => onEdit(task)}
                      className={`w-full text-left text-white text-[10px] font-medium leading-tight px-1.5 py-0.5 transition-opacity hover:opacity-80 truncate ${color} ${
                        info.isSpan
                          ? `${info.isStart ? 'rounded-l-full' : ''} ${info.isEnd ? 'rounded-r-full' : ''} ${!info.isStart && !info.isEnd ? '' : ''}`
                          : 'rounded-full'
                      }`}
                    >
                      {info.isStart || !info.isSpan ? task.title : ''}
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
