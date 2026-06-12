// タスクの開始・終了スケジュール入力欄（終日/時間指定の切替付き・未入力可）
export default function ScheduleFields({ value, onChange }) {
  const { allDay, startDate, startTime, endDate, endTime } = value
  const set = patch => onChange({ ...value, ...patch })

  // 終日切替時に入力済みの日付・時刻を引き継ぐ
  function toggleAllDay(checked) {
    if (checked) {
      set({
        allDay: true,
        startDate: startDate || (startTime ? startTime.slice(0, 10) : ''),
        endDate: endDate || (endTime ? endTime.slice(0, 10) : ''),
      })
    } else {
      set({
        allDay: false,
        startTime: startTime || (startDate ? `${startDate}T00:00` : ''),
        endTime: endTime || (endDate ? `${endDate}T23:59` : ''),
      })
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">スケジュール</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={allDay}
            onChange={e => toggleAllDay(e.target.checked)}
            className="w-4 h-4 accent-violet-500"
          />
          <span className="text-xs font-medium text-gray-500">終日</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">開始</label>
          {allDay ? (
            <input
              type="date"
              value={startDate}
              onChange={e => set({ startDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm text-gray-700"
            />
          ) : (
            <input
              type="datetime-local"
              value={startTime}
              onChange={e => set({ startTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm text-gray-700"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">終了</label>
          {allDay ? (
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => set({ endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm text-gray-700"
            />
          ) : (
            <input
              type="datetime-local"
              value={endTime}
              min={startTime || undefined}
              onChange={e => set({ endTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-100 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm text-gray-700"
            />
          )}
        </div>
      </div>
    </div>
  )
}
