// スケジュール関連の共通ヘルパー

// Date → input[type=datetime-local] 用のローカル文字列 (YYYY-MM-DDTHH:mm)
export function toLocalDateTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Date → input[type=date] 用のローカル文字列 (YYYY-MM-DD)
export function toLocalDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 表示用ラベル（例: "6/15 10:00〜11:30", "6/15〜6/17", "6/15 終日"）
export function formatSchedule(task) {
  if (!task.start_at && !task.end_at) return null
  const fmtDate = d => d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  const fmtTime = d => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  const start = task.start_at ? new Date(task.start_at) : null
  const end = task.end_at ? new Date(task.end_at) : null

  if (task.all_day) {
    if (start && end) {
      const sameDay = start.toDateString() === end.toDateString()
      return sameDay ? `${fmtDate(start)} 終日` : `${fmtDate(start)}〜${fmtDate(end)}`
    }
    return `${fmtDate(start ?? end)} 終日`
  }

  if (start && end) {
    const sameDay = start.toDateString() === end.toDateString()
    return sameDay
      ? `${fmtDate(start)} ${fmtTime(start)}〜${fmtTime(end)}`
      : `${fmtDate(start)} ${fmtTime(start)}〜${fmtDate(end)} ${fmtTime(end)}`
  }
  const d = start ?? end
  return `${fmtDate(d)} ${fmtTime(d)}${start ? '〜' : 'まで'}`
}

// フォーム値 → DB 保存値（未入力はすべて null）
export function buildScheduleUpdates({ allDay, startDate, startTime, endDate, endTime }) {
  if (allDay) {
    const hasDate = startDate || endDate
    return {
      start_at: startDate ? new Date(`${startDate}T00:00`).toISOString() : null,
      end_at: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
      all_day: !!hasDate,
    }
  }
  return {
    start_at: startTime ? new Date(startTime).toISOString() : null,
    end_at: endTime ? new Date(endTime).toISOString() : null,
    all_day: false,
  }
}
