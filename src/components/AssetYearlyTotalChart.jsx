import { niceTicks } from '../lib/chartTicks'

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })

const CATEGORIES = [
  { key: 'securities', label: '証券', color: '#007AFF' },
  { key: 'cash', label: '現金', color: '#34C759' },
  { key: 'insurance', label: '保険', color: '#FF9500' },
]

// 年別の総資産（証券+現金+保険）推移を、内訳が分かる積み上げ棒グラフで表示する
export default function AssetYearlyTotalChart({ yearly }) {
  if (!yearly || yearly.length === 0) {
    return <p className="text-[12px] text-[#AEAEB2] py-6 text-center">年別の資産データがありません</p>
  }

  const rawMax = Math.max(...yearly.map(y => y.total), 1)
  // 金額なので、キリのいい単位（値が大きければ千万単位など）で縦軸の上限・目盛りを決める
  const { niceMax, ticks } = niceTicks(0, rawMax, 4)
  const max = niceMax
  const yTicks = ticks.filter(t => t > 0 && t <= max)
  const first = yearly[0]
  const last = yearly[yearly.length - 1]

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        {CATEGORIES.map(c => (
          <div key={c.key} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-[10px] text-[#8E8E93]">{c.label}</span>
          </div>
        ))}
      </div>
      <div className="relative h-[160px] md:h-[220px]">
        {/* 縦軸（PCのみ、キリのいい金額で目盛りを打つ） */}
        <div className="hidden md:block absolute left-0 top-0 bottom-0 w-14 text-[10px] text-[#8E8E93] text-right pr-2">
          {yTicks.map(t => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {yen.format(t)}
            </span>
          ))}
        </div>
        {/* 補助線（縦軸目盛りに対応する横線） */}
        <div className="absolute left-0 md:left-16 right-0 top-0 bottom-0">
          {yTicks.map(t => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-[#8E8E93]/25"
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}
        </div>
        <div className="relative flex items-end gap-1.5 md:gap-2.5 h-full overflow-x-auto md:pl-16">
          {yearly.map(y => {
            const barHeightPct = Math.max((y.total / max) * 100, 1)
            return (
              <div key={y.year} className="flex-1 min-w-[20px] flex flex-col items-center justify-end h-full">
                <span className="text-[9px] text-[#AEAEB2] mb-1 whitespace-nowrap tabular-nums">
                  {(y.total / 10000).toFixed(0)}万
                </span>
                <div
                  className="w-full max-w-[28px] rounded-t-[4px] overflow-hidden flex flex-col-reverse"
                  style={{ height: `${barHeightPct}%` }}
                  title={`${y.year}年（${y.as_of}時点）\n証券：${yen.format(y.securities)}\n現金：${yen.format(y.cash)}\n保険：${yen.format(y.insurance)}\n合計：${yen.format(y.total)}`}
                >
                  {CATEGORIES.map(c => {
                    const value = y[c.key] ?? 0
                    const segPct = y.total > 0 ? (value / y.total) * 100 : 0
                    if (segPct <= 0) return null
                    return (
                      <div
                        key={c.key}
                        style={{ height: `${segPct}%`, backgroundColor: c.color }}
                      />
                    )
                  })}
                </div>
                {/* 横軸：年の区切り */}
                <span className="text-[10px] text-[#8E8E93] mt-1.5">{y.year.slice(2)}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-[11px] text-[#AEAEB2]">
        <span>{first.year}年：{yen.format(first.total)}</span>
        <span>{last.year}年：{yen.format(last.total)}</span>
      </div>
    </div>
  )
}
