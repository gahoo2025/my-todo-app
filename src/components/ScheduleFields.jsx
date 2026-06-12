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
    <div>
      <p className="text-[13px] font-semibold text-[#8E8E93] mb-2 px-3">スケジュール</p>
      <div className="ios-card overflow-hidden divide-y divide-black/[0.04]">
        {/* 終日トグル（iOSスイッチ風） */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[15px] text-[#1C1C1E]">終日</span>
          <button
            type="button"
            role="switch"
            aria-checked={allDay}
            onClick={() => toggleAllDay(!allDay)}
            className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 ${
              allDay ? 'bg-[#34C759]' : 'bg-[#767680]/25'
            }`}
          >
            <span className={`absolute top-[2px] w-[27px] h-[27px] bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 ${
              allDay ? 'left-[22px]' : 'left-[2px]'
            }`} />
          </button>
        </div>

        {/* 開始 */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[15px] text-[#1C1C1E]">開始</span>
          {allDay ? (
            <input
              type="date"
              value={startDate}
              onChange={e => set({ startDate: e.target.value })}
              className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
            />
          ) : (
            <input
              type="datetime-local"
              value={startTime}
              onChange={e => set({ startTime: e.target.value })}
              className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
            />
          )}
        </div>

        {/* 終了 */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[15px] text-[#1C1C1E]">終了</span>
          {allDay ? (
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => set({ endDate: e.target.value })}
              className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
            />
          ) : (
            <input
              type="datetime-local"
              value={endTime}
              min={startTime || undefined}
              onChange={e => set({ endTime: e.target.value })}
              className="text-[15px] text-[#8E8E93] bg-transparent focus:outline-none text-right"
            />
          )}
        </div>
      </div>
    </div>
  )
}
